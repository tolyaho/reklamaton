"""Fast tests for the pure CRM, segment, outbox and draft logic. No server, no network, no key."""
import json
from datetime import datetime, timedelta

import pytest

from ad_gen import _channel_limit, _fallback_message, draft_language, generate_ad_message, llm_configured
from models import Business, Campaign, CustomerEvent, OutboundMessage
from sqlmodel import select
from store import (
    apply_profile_patch,
    customer_matches_segment,
    ensure_customer_profile,
    is_rate_limited_approval,
    parse_json_list,
    upsert_customer,
)


def _business(session):
    b = Business(owner_user_id=1, name="Harbor & Bean", brand_voice="warm", products_json="[]", timezone="UTC")
    session.add(b)
    session.commit()
    session.refresh(b)
    return b


def _campaign(session, business, offer="10% off filter coffee this week", channel="sms"):
    c = Campaign(business_id=business.id, name="c", objective="o", offer_text=offer, channel=channel, segment_json="{}")
    session.add(c)
    session.commit()
    session.refresh(c)
    return c


def test_parse_json_list_tolerates_bad_input():
    assert parse_json_list(None) == []
    assert parse_json_list("not json") == []
    assert parse_json_list('{"a": 1}') == []
    assert parse_json_list('["a", 2]') == ["a", "2"]


def test_upsert_dedupes_by_external_id_then_phone_then_email(session):
    b = _business(session)
    first = upsert_customer(session, b.id, email="ana@example.com", name="Ana")
    same_by_email = upsert_customer(session, b.id, email="ana@example.com", phone="+15550101")
    same_by_phone = upsert_customer(session, b.id, phone="+15550101", external_id="tg-7")
    same_by_external = upsert_customer(session, b.id, external_id="tg-7", name="Ana K.")
    assert first.id == same_by_email.id == same_by_phone.id == same_by_external.id
    assert same_by_external.name == "Ana K." and same_by_external.phone == "+15550101"


def test_opt_in_records_a_timestamp(session):
    b = _business(session)
    c = upsert_customer(session, b.id, email="bo@example.com", marketing_opt_in=True)
    assert c.marketing_opt_in and c.marketing_opt_in_at is not None
    c = upsert_customer(session, b.id, email="bo@example.com", marketing_opt_in=False)
    assert not c.marketing_opt_in and c.marketing_opt_in_at is None


def test_profile_patch_merges_lists_clamps_score_and_logs_an_event(session):
    b = _business(session)
    c = upsert_customer(session, b.id, email="cy@example.com")
    apply_profile_patch(session, c.id, {"interests": ["espresso", "decaf"], "lead_score_delta": 70, "notes_append": "asked about grinders"})
    p = apply_profile_patch(session, c.id, {"interests": ["decaf", "beans"], "lead_score_delta": 70, "lead_stage": ""})
    assert json.loads(p.interests_json) == ["espresso", "decaf", "beans"]   # lists only grow, no duplicates
    assert p.lead_score == 100                                                # clamped to 0..100
    assert p.lead_stage == "new"                                              # empty stage is ignored
    assert p.notes.startswith("[") and "asked about grinders" in p.notes      # timestamped note
    p = apply_profile_patch(session, c.id, {"lead_score_delta": -500})
    assert p.lead_score == 0
    events = session.exec(select(CustomerEvent).where(CustomerEvent.customer_id == c.id)).all()
    assert [e.type for e in events] == ["profile_update"] * 3


def test_segment_filter(session):
    b = _business(session)
    c = upsert_customer(session, b.id, email="di@example.com", marketing_opt_in=False)
    apply_profile_patch(session, c.id, {"interests": ["decaf"], "lead_stage": "warm"})
    assert not customer_matches_segment(session, c, {"marketing_opt_in": True})
    assert customer_matches_segment(session, c, {"lead_stage_in": ["warm", "hot"]})
    assert not customer_matches_segment(session, c, {"lead_stage_in": ["hot"]})
    assert customer_matches_segment(session, c, {"interests_any": ["decaf", "tea"]})
    assert not customer_matches_segment(session, c, {"interests_any": ["tea"]})
    # never seen counts as "seen long ago"; seen yesterday does not match a 7-day threshold
    assert customer_matches_segment(session, c, {"last_seen_older_than_days": 7})
    c.last_seen_at = datetime.utcnow() - timedelta(days=1)
    assert not customer_matches_segment(session, c, {"last_seen_older_than_days": 7})
    c.last_seen_at = datetime.utcnow() - timedelta(days=30)
    assert customer_matches_segment(session, c, {"last_seen_older_than_days": 7})


def test_one_approval_per_customer_per_24_hours(session):
    b = _business(session)
    camp = _campaign(session, b)
    c = upsert_customer(session, b.id, email="ed@example.com")
    assert not is_rate_limited_approval(session, c.id)
    old = OutboundMessage(campaign_id=camp.id, customer_id=c.id, channel="sms", content="x", status="approved",
                          approved_at=datetime.utcnow() - timedelta(hours=25))
    session.add(old)
    session.commit()
    assert not is_rate_limited_approval(session, c.id)
    recent = OutboundMessage(campaign_id=camp.id, customer_id=c.id, channel="sms", content="y", status="approved",
                             approved_at=datetime.utcnow() - timedelta(hours=1))
    session.add(recent)
    session.commit()
    assert is_rate_limited_approval(session, c.id)


def test_channel_limits():
    assert (_channel_limit("sms"), _channel_limit("telegram"), _channel_limit("whatsapp")) == (160, 400, 400)
    assert _channel_limit("email") == _channel_limit("web") == 500


def test_draft_language_follows_the_customer_then_the_offer(session):
    b = _business(session)
    c = upsert_customer(session, b.id, email="fa@example.com")
    profile = ensure_customer_profile(session, c.id)
    assert draft_language(_campaign(session, b, offer="10% off this week"), profile) == "en"
    assert draft_language(_campaign(session, b, offer="Скидка 10% на этой неделе"), profile) == "ru"
    profile.language = "EN"
    assert draft_language(_campaign(session, b, offer="Скидка 10%"), profile) == "en"


def test_template_fallback_respects_the_channel_limit(session):
    b = _business(session)
    c = upsert_customer(session, b.id, email="gu@example.com", name="Gus", marketing_opt_in=True)
    profile = ensure_customer_profile(session, c.id)
    camp = _campaign(session, b, offer="a very long offer " * 30, channel="sms")
    text = _fallback_message(b, camp, c, profile)
    assert text.startswith("Hi, Gus!") and len(text) <= 160 and text.endswith("…")


def test_drafts_refuse_customers_without_opt_in(session):
    b = _business(session)
    c = upsert_customer(session, b.id, email="ha@example.com", marketing_opt_in=False)
    with pytest.raises(ValueError):
        generate_ad_message(b, _campaign(session, b), c, ensure_customer_profile(session, c.id))


def test_without_a_key_the_model_is_never_called(session):
    assert not llm_configured()
    b = _business(session)
    c = upsert_customer(session, b.id, email="ia@example.com", name="Ida", marketing_opt_in=True)
    # The function itself degrades to the template; the HTTP route refuses earlier with 503.
    text = generate_ad_message(b, _campaign(session, b, channel="email"), c, ensure_customer_profile(session, c.id))
    assert text.startswith("Hi, Ida!")
