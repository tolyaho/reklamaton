# store.py
import json
from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy import or_
from sqlmodel import Session, select

from models import (
    Business,
    Campaign,
    ChatSession,
    Customer,
    CustomerEvent,
    CustomerProfile,
    Message,
    OutboundMessage,
)


def create_chat_session(
    user_id: int,
    avatar_id: int,
    thread_id: str,
    session: Session,
    business_id: Optional[int] = None,
    customer_id: Optional[int] = None,
    source_channel: str = "web",
) -> ChatSession:
    chat = ChatSession(
        user_id=user_id,
        avatar_id=avatar_id,
        thread_id=thread_id,
        business_id=business_id,
        customer_id=customer_id,
        source_channel=source_channel,
    )
    session.add(chat)
    session.commit()
    session.refresh(chat)
    return chat


def get_chat_session(chat_id: int, session: Session) -> Optional[ChatSession]:
    return session.get(ChatSession, chat_id)


def add_message(session: Session, chat_id: int, role: str, content: str, msg_type: str = "chat") -> Message:
    msg = Message(chat_id=chat_id, role=role, content=content, msg_type=msg_type)
    session.add(msg)
    session.commit()
    session.refresh(msg)
    return msg


def get_or_create_business_for_user(session: Session, user_id: int) -> Business:
    existing = session.exec(select(Business).where(Business.owner_user_id == user_id)).first()
    if existing:
        return existing
    business = Business(
        owner_user_id=user_id,
        name=f"Business {user_id}",
        brand_voice="Friendly and concise sales assistant",
        products_json="[]",
        timezone="Europe/Moscow",
    )
    session.add(business)
    session.commit()
    session.refresh(business)
    return business


def update_business(session: Session, business_id: int, patch: dict) -> Optional[Business]:
    business = session.get(Business, business_id)
    if not business:
        return None
    for k, v in patch.items():
        if v is not None and hasattr(business, k):
            setattr(business, k, v)
    session.add(business)
    session.commit()
    session.refresh(business)
    return business


def ensure_customer_profile(session: Session, customer_id: int) -> CustomerProfile:
    profile = session.exec(select(CustomerProfile).where(CustomerProfile.customer_id == customer_id)).first()
    if profile:
        return profile
    profile = CustomerProfile(customer_id=customer_id)
    session.add(profile)
    session.commit()
    session.refresh(profile)
    return profile


def upsert_customer(
    session: Session,
    business_id: int,
    external_id: Optional[str] = None,
    phone: Optional[str] = None,
    email: Optional[str] = None,
    name: Optional[str] = None,
    preferred_channel: Optional[str] = None,
    marketing_opt_in: Optional[bool] = None,
) -> Customer:
    customer = None
    if external_id:
        customer = session.exec(
            select(Customer).where(Customer.business_id == business_id, Customer.external_id == external_id)
        ).first()
    if not customer and phone:
        customer = session.exec(select(Customer).where(Customer.business_id == business_id, Customer.phone == phone)).first()
    if not customer and email:
        customer = session.exec(select(Customer).where(Customer.business_id == business_id, Customer.email == email)).first()

    if not customer:
        customer = Customer(
            business_id=business_id,
            external_id=external_id,
            phone=phone,
            email=email,
            name=name,
            preferred_channel=preferred_channel,
            marketing_opt_in=bool(marketing_opt_in) if marketing_opt_in is not None else False,
            marketing_opt_in_at=datetime.utcnow() if marketing_opt_in else None,
        )
    else:
        if external_id is not None:
            customer.external_id = external_id
        if phone is not None:
            customer.phone = phone
        if email is not None:
            customer.email = email
        if name is not None:
            customer.name = name
        if preferred_channel is not None:
            customer.preferred_channel = preferred_channel
        if marketing_opt_in is not None:
            customer.marketing_opt_in = marketing_opt_in
            customer.marketing_opt_in_at = datetime.utcnow() if marketing_opt_in else None

    session.add(customer)
    session.commit()
    session.refresh(customer)
    ensure_customer_profile(session, customer.id)
    return customer


def get_customer(session: Session, business_id: int, customer_id: int) -> Optional[Customer]:
    customer = session.get(Customer, customer_id)
    if not customer or customer.business_id != business_id:
        return None
    return customer


def list_customers(session: Session, business_id: int, search: Optional[str] = None) -> list[Customer]:
    stmt = select(Customer).where(Customer.business_id == business_id)
    if search:
        like = f"%{search}%"
        stmt = stmt.where(
            or_(Customer.name.ilike(like), Customer.email.ilike(like), Customer.phone.ilike(like), Customer.external_id.ilike(like))
        )
    stmt = stmt.order_by(Customer.created_at.desc())
    return session.exec(stmt).all()


def update_customer_preferences(session: Session, customer_id: int, patch: dict) -> Optional[Customer]:
    customer = session.get(Customer, customer_id)
    if not customer:
        return None
    opt_in_before = customer.marketing_opt_in
    for k, v in patch.items():
        if v is not None and hasattr(customer, k):
            setattr(customer, k, v)
    if "marketing_opt_in" in patch and patch["marketing_opt_in"] is not None:
        customer.marketing_opt_in_at = datetime.utcnow() if customer.marketing_opt_in else None
    elif customer.marketing_opt_in and not opt_in_before:
        customer.marketing_opt_in_at = datetime.utcnow()
    session.add(customer)
    session.commit()
    session.refresh(customer)
    return customer


def apply_profile_patch(session: Session, customer_id: int, patch_dict: dict) -> CustomerProfile:
    profile = ensure_customer_profile(session, customer_id)

    def _merge_json_array(old_json: Optional[str], new_vals):
        current = []
        if old_json:
            try:
                current = json.loads(old_json)
            except Exception:
                current = []
        if not isinstance(current, list):
            current = []
        if isinstance(new_vals, list):
            for v in new_vals:
                if isinstance(v, str) and v and v not in current:
                    current.append(v)
        return json.dumps(current, ensure_ascii=False)

    if "language" in patch_dict:
        profile.language = patch_dict.get("language")
    if "tone" in patch_dict:
        profile.tone = patch_dict.get("tone")
    if "budget_min" in patch_dict:
        profile.budget_min = patch_dict.get("budget_min")
    if "budget_max" in patch_dict:
        profile.budget_max = patch_dict.get("budget_max")
    if "location" in patch_dict:
        profile.location = patch_dict.get("location")
    if "lead_stage" in patch_dict and patch_dict.get("lead_stage"):
        profile.lead_stage = patch_dict["lead_stage"]
    if "interests" in patch_dict:
        profile.interests_json = _merge_json_array(profile.interests_json, patch_dict.get("interests"))
    if "objections" in patch_dict:
        profile.objections_json = _merge_json_array(profile.objections_json, patch_dict.get("objections"))

    score_delta = int(patch_dict.get("lead_score_delta") or 0)
    profile.lead_score = max(0, min(100, profile.lead_score + score_delta))

    notes_append = patch_dict.get("notes_append")
    if notes_append:
        ts = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
        old = (profile.notes or "").strip()
        chunk = f"[{ts}] {notes_append}"
        profile.notes = f"{old}\n{chunk}".strip() if old else chunk

    profile.updated_at = datetime.utcnow()
    session.add(profile)
    session.add(
        CustomerEvent(
            customer_id=customer_id,
            type="profile_update",
            payload_json=json.dumps(patch_dict, ensure_ascii=False),
        )
    )
    session.commit()
    session.refresh(profile)
    return profile


def create_campaign(session: Session, business_id: int, payload: dict) -> Campaign:
    campaign = Campaign(business_id=business_id, **payload)
    session.add(campaign)
    session.commit()
    session.refresh(campaign)
    return campaign


def list_campaigns(session: Session, business_id: int) -> list[Campaign]:
    return session.exec(select(Campaign).where(Campaign.business_id == business_id).order_by(Campaign.created_at.desc())).all()


def generate_outbound_drafts(
    session: Session,
    campaign_id: int,
    customer_ids: list[int],
    content_map: Optional[dict[int, str]] = None,
    channel: Optional[str] = None,
) -> list[OutboundMessage]:
    created: list[OutboundMessage] = []
    for customer_id in customer_ids:
        msg = OutboundMessage(
            campaign_id=campaign_id,
            customer_id=customer_id,
            channel=channel or "web",
            content=(content_map or {}).get(customer_id, ""),
            status="draft",
        )
        session.add(msg)
        created.append(msg)
        session.add(
            CustomerEvent(
                customer_id=customer_id,
                type="ad_generated",
                payload_json=json.dumps({"campaign_id": campaign_id}, ensure_ascii=False),
            )
        )
    session.commit()
    for msg in created:
        session.refresh(msg)
    return created


def approve_outbound(session: Session, message_id: int) -> Optional[OutboundMessage]:
    msg = session.get(OutboundMessage, message_id)
    if not msg:
        return None
    if msg.status not in {"draft", "approved"}:
        return msg
    msg.status = "approved"
    msg.approved_at = datetime.utcnow()
    session.add(msg)
    session.add(
        CustomerEvent(
            customer_id=msg.customer_id,
            type="ad_approved",
            payload_json=json.dumps({"message_id": message_id}, ensure_ascii=False),
        )
    )
    session.commit()
    session.refresh(msg)
    return msg


def mark_sent_outbound(session: Session, message_id: int) -> Optional[OutboundMessage]:
    msg = session.get(OutboundMessage, message_id)
    if not msg:
        return None
    msg.status = "sent"
    msg.sent_at = datetime.utcnow()
    session.add(msg)
    session.commit()
    session.refresh(msg)
    return msg


def is_rate_limited_approval(session: Session, customer_id: int) -> bool:
    cutoff = datetime.utcnow() - timedelta(hours=24)
    recent = session.exec(
        select(OutboundMessage).where(
            OutboundMessage.customer_id == customer_id,
            OutboundMessage.approved_at.is_not(None),
            OutboundMessage.approved_at >= cutoff,
        )
    ).first()
    return recent is not None
