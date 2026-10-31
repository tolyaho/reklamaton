"""Chat on the Responses API, tenant checks, consent and export safety.

Model calls go to in-process fakes: no network, no key, no cost. The fakes check the request shape
the code sends; they cannot show that OpenAI accepts it, which only a live run can.
"""
import csv
import io
import json
import uuid
from types import SimpleNamespace

import pytest
from starlette.websockets import WebSocketDisconnect

import ad_gen
import assistant_api
import profile_extractor
from store import csv_safe_cell

FAKE_KEY = "test-key-not-a-real-key"


class FakeResponses:
    def __init__(self, replies):
        self.calls: list[dict] = []
        self.replies = list(replies)

    def create(self, **kwargs):
        self.calls.append(kwargs)
        reply = self.replies.pop(0) if len(self.replies) > 1 else self.replies[0]
        if isinstance(reply, Exception):
            raise reply
        return reply


def fake_client(*replies):
    return SimpleNamespace(responses=FakeResponses(replies))


def text_response(text):
    return SimpleNamespace(output_text=text, output=[])


def event(type_, delta=None):
    return SimpleNamespace(type=type_, delta=delta)


def msg(role, content):
    return SimpleNamespace(role=role, content=content)


# ---------- Responses API chat (unit) ----------

def test_build_input_keeps_the_latest_history_and_appends_the_new_message(monkeypatch):
    monkeypatch.setattr(assistant_api, "HISTORY_LIMIT", 2)
    history = [msg("user", "a"), msg("assistant", "b"), msg("system", "ignored"), msg("user", "c")]
    assert assistant_api.build_input(history, "d") == [
        {"role": "assistant", "content": "b"},
        {"role": "user", "content": "c"},
        {"role": "user", "content": "d"},
    ]


def test_chat_reply_calls_the_responses_api_without_storing_the_conversation(monkeypatch):
    fake = fake_client(text_response("  Hello Ines!  "))
    monkeypatch.setattr(assistant_api, "_get_client", lambda: fake)
    reply = assistant_api.chat_reply("be helpful", [msg("user", "hi"), msg("assistant", "hello")], "price?")
    assert reply == "Hello Ines!"
    (call,) = fake.responses.calls
    assert call["instructions"] == "be helpful"
    assert call["store"] is False
    assert call["input"][-1] == {"role": "user", "content": "price?"}
    assert call["model"] == assistant_api.CHAT_MODEL


def test_chat_reply_falls_back_to_the_second_model(monkeypatch):
    fake = fake_client(RuntimeError("model not available"), text_response("ok"))
    monkeypatch.setattr(assistant_api, "_get_client", lambda: fake)
    monkeypatch.setattr(assistant_api, "CHAT_MODEL", "primary-model")
    monkeypatch.setattr(assistant_api, "CHAT_FALLBACK_MODEL", "fallback-model")
    assert assistant_api.chat_reply("i", [], "q") == "ok"
    assert [c["model"] for c in fake.responses.calls] == ["primary-model", "fallback-model"]


def test_chat_stream_yields_text_deltas_and_raises_on_failure(monkeypatch):
    events = [event("response.created"), event("response.output_text.delta", "Hel"),
              event("response.output_text.delta", "lo"), event("response.completed")]
    fake = fake_client(iter(events))
    monkeypatch.setattr(assistant_api, "_get_client", lambda: fake)
    assert "".join(assistant_api.chat_reply_stream("i", [], "q")) == "Hello"
    assert fake.responses.calls[0]["stream"] is True

    failing = fake_client(iter([event("response.output_text.delta", "x"), event("response.failed")]))
    monkeypatch.setattr(assistant_api, "_get_client", lambda: failing)
    with pytest.raises(RuntimeError):
        list(assistant_api.chat_reply_stream("i", [], "q"))


def test_new_conversation_is_refused_without_a_key(monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "")
    with pytest.raises(assistant_api.OpenAIConfigError):
        assistant_api.new_conversation_id()


def test_csv_safe_cell_neutralises_formulas():
    assert csv_safe_cell("=HYPERLINK(\"http://x\")") == "'=HYPERLINK(\"http://x\")"
    assert csv_safe_cell("+1 555 0100") == "'+1 555 0100"
    assert csv_safe_cell("@SUM(A1)") == "'@SUM(A1)"
    assert csv_safe_cell("Hi Ines, two slots left") == "Hi Ines, two slots left"
    assert csv_safe_cell(None) == ""


# ---------- API: a full chat turn and the outbox ----------

@pytest.fixture
def tenant(client):
    """A fresh user + business, so tests do not share state."""
    user = client.post("/users/", json={"username": f"{uuid.uuid4().hex[:8]}@example.com"}).json()
    business = client.post(f"/users/{user['id']}/business", json={"name": "Studio Halden"}).json()
    return user["id"], business["id"]


def _customer(client, user_id, business_id, name, opt_in=True):
    r = client.post(f"/business/{business_id}/customers/upsert?user_id={user_id}",
                    json={"email": f"{uuid.uuid4().hex[:8]}@example.com", "name": name, "marketing_opt_in": opt_in})
    assert r.status_code == 200
    return r.json()["id"]


def _chat(client, monkeypatch, user_id, business_id, customer_id):
    monkeypatch.setenv("OPENAI_API_KEY", FAKE_KEY)
    avatar_id = client.get(f"/users/{user_id}/avatars/").json()[0]["id"]
    r = client.post(f"/business/{business_id}/chats/?avatar_id={avatar_id}&customer_id={customer_id}&user_id={user_id}")
    assert r.status_code == 201, r.text
    return r.json()["id"], avatar_id


def test_a_chat_turn_replies_and_updates_the_customer_profile(client, tenant, monkeypatch):
    user_id, business_id = tenant
    customer_id = _customer(client, user_id, business_id, "Ines")
    chat_id, avatar_id = _chat(client, monkeypatch, user_id, business_id, customer_id)

    chat_fake = fake_client(text_response("Our packaging system starts at 3,900 EUR. When do you open?"))
    patch = {"language": "en", "tone": "friendly", "interests": ["packaging"], "budget_min": 3000,
             "budget_max": 5000, "location": "-", "lead_stage": "qualified", "lead_score_delta": 8,
             "objections": [], "notes_append": "Opening a second shop in March."}
    extract_fake = fake_client(text_response(json.dumps(patch)))
    monkeypatch.setattr(assistant_api, "_get_client", lambda: chat_fake)
    monkeypatch.setattr(profile_extractor, "_get_client", lambda: extract_fake)

    r = client.post(f"/api/assistant/{chat_id}/?user_id={user_id}",
                    json={"avatar_id": avatar_id, "message": "We need new pastry boxes, budget 3-5k EUR."})
    assert r.status_code == 200, r.text
    assert r.json()["reply"].startswith("Our packaging system")

    sent = chat_fake.responses.calls[0]
    assert sent["store"] is False
    assert "Studio Halden" in sent["instructions"]          # business context reaches the prompt
    assert sent["input"][-1]["content"].startswith("We need new pastry boxes")

    profile = client.get(f"/business/{business_id}/customers/{customer_id}/profile?user_id={user_id}").json()
    assert json.loads(profile["interests_json"]) == ["packaging"]
    assert (profile["budget_min"], profile["budget_max"]) == (3000, 5000)
    assert profile["lead_stage"] == "qualified" and profile["lead_score"] == 8
    assert profile["notes"].endswith("Opening a second shop in March.")
    assert profile["location"] is None                       # "-" means "not mentioned"

    messages = client.get(f"/chats/{chat_id}/messages/?user_id={user_id}").json()
    assert [m["role"] for m in messages] == ["user", "assistant"]


def test_the_second_turn_sends_the_first_turn_as_history(client, tenant, monkeypatch):
    user_id, business_id = tenant
    customer_id = _customer(client, user_id, business_id, "Theo")
    chat_id, avatar_id = _chat(client, monkeypatch, user_id, business_id, customer_id)
    chat_fake = fake_client(text_response("first reply"), text_response("second reply"))
    monkeypatch.setattr(assistant_api, "_get_client", lambda: chat_fake)
    monkeypatch.setattr(profile_extractor, "_get_client", lambda: fake_client(text_response("{}")))
    for text in ("first question", "second question"):
        assert client.post(f"/api/assistant/{chat_id}/?user_id={user_id}",
                           json={"avatar_id": avatar_id, "message": text}).status_code == 200
    second = chat_fake.responses.calls[1]["input"]
    assert [i["content"] for i in second] == ["first question", "first reply", "second question"]


def test_chats_and_messages_belong_to_their_owner(client, tenant, monkeypatch):
    user_id, business_id = tenant
    customer_id = _customer(client, user_id, business_id, "Mara")
    chat_id, avatar_id = _chat(client, monkeypatch, user_id, business_id, customer_id)
    other = client.post("/users/", json={"username": f"{uuid.uuid4().hex[:8]}@example.com"}).json()["id"]
    assert client.get(f"/chats/{chat_id}/messages/?user_id={other}").status_code == 403
    assert client.get(f"/chats/{chat_id}/messages/").status_code == 422          # user_id is required
    r = client.post(f"/api/assistant/{chat_id}/?user_id={other}", json={"avatar_id": avatar_id, "message": "hi"})
    assert r.status_code == 403
    with client.websocket_connect(f"/ws/assistant/{chat_id}?user_id={other}") as ws:
        with pytest.raises(WebSocketDisconnect) as closed:
            ws.receive_text()
    assert closed.value.code == 4403


def test_websocket_streams_the_reply(client, tenant, monkeypatch):
    user_id, business_id = tenant
    customer_id = _customer(client, user_id, business_id, "Ola")
    chat_id, _ = _chat(client, monkeypatch, user_id, business_id, customer_id)
    stream = iter([event("response.output_text.delta", "Two slots "), event("response.output_text.delta", "left."),
                   event("response.completed")])
    monkeypatch.setattr(assistant_api, "_get_client", lambda: fake_client(stream))
    monkeypatch.setattr(profile_extractor, "_get_client", lambda: fake_client(text_response("{}")))
    with client.websocket_connect(f"/ws/assistant/{chat_id}?user_id={user_id}") as ws:
        ws.send_text("Any slots in March?")
        assert ws.receive_text() + ws.receive_text() == "Two slots left."
    messages = client.get(f"/chats/{chat_id}/messages/?user_id={user_id}").json()
    assert messages[-1]["content"] == "Two slots left."


def test_oversized_chat_message_is_rejected(client, tenant, monkeypatch):
    user_id, business_id = tenant
    customer_id = _customer(client, user_id, business_id, "Long")
    chat_id, avatar_id = _chat(client, monkeypatch, user_id, business_id, customer_id)
    r = client.post(f"/api/assistant/{chat_id}/?user_id={user_id}", json={"avatar_id": avatar_id, "message": "x" * 4001})
    assert r.status_code == 422


def test_model_errors_are_not_echoed_to_the_client(client, tenant, monkeypatch):
    user_id, business_id = tenant
    customer_id = _customer(client, user_id, business_id, "Err")
    chat_id, avatar_id = _chat(client, monkeypatch, user_id, business_id, customer_id)
    monkeypatch.setattr(assistant_api, "_get_client",
                        lambda: fake_client(RuntimeError("Incorrect API key provided: sk-pr****1234")))
    r = client.post(f"/api/assistant/{chat_id}/?user_id={user_id}", json={"avatar_id": avatar_id, "message": "hi"})
    assert r.status_code == 503
    assert "sk-" not in r.text and "Incorrect API key" not in r.text


def _campaign_with_drafts(client, monkeypatch, user_id, business_id, draft_text="Hi! Two March slots left."):
    camp = client.post(f"/business/{business_id}/campaigns?user_id={user_id}",
                       json={"name": "March slots", "objective": "book calls", "offer_text": "Two March slots",
                             "channel": "email", "segment_json": json.dumps({"marketing_opt_in": True})}).json()
    monkeypatch.setenv("OPENAI_API_KEY", FAKE_KEY)
    monkeypatch.setattr(ad_gen, "_get_client", lambda: fake_client(text_response(draft_text)))
    r = client.post(f"/campaigns/{camp['id']}/generate_drafts?user_id={user_id}")
    assert r.status_code == 200, r.text
    return camp["id"], r.json()


def test_outbox_lifecycle_draft_approved_sent(client, tenant, monkeypatch):
    user_id, business_id = tenant
    _customer(client, user_id, business_id, "Ines")
    _customer(client, user_id, business_id, "No consent", opt_in=False)
    campaign_id, drafts = _campaign_with_drafts(client, monkeypatch, user_id, business_id)
    assert len(drafts) == 1                                   # the customer without consent gets no draft
    message_id = drafts[0]["id"]

    assert client.post(f"/outbox/{message_id}/mark_sent?user_id={user_id}").status_code == 409   # not approved yet
    approved = client.post(f"/outbox/{message_id}/approve?user_id={user_id}", json={"approved": True})
    assert approved.status_code == 200 and approved.json()["status"] == "approved"
    sent = client.post(f"/outbox/{message_id}/mark_sent?user_id={user_id}")
    assert sent.status_code == 200 and sent.json()["status"] == "sent"
    again = client.post(f"/outbox/{message_id}/approve?user_id={user_id}", json={"approved": True})
    assert again.status_code == 409


def test_withdrawn_consent_blocks_approval_and_export(client, tenant, monkeypatch):
    user_id, business_id = tenant
    customer_id = _customer(client, user_id, business_id, "Pia")
    campaign_id, drafts = _campaign_with_drafts(client, monkeypatch, user_id, business_id)
    message_id = drafts[0]["id"]
    assert client.post(f"/outbox/{message_id}/approve?user_id={user_id}", json={"approved": True}).status_code == 200
    client.patch(f"/business/{business_id}/customers/{customer_id}?user_id={user_id}", json={"marketing_opt_in": False})
    rows = list(csv.reader(io.StringIO(client.get(f"/outbox/export.csv?campaign_id={campaign_id}&user_id={user_id}").text)))
    assert len(rows) == 1                                     # header only: consent was withdrawn
    second_camp, _ = _campaign_with_drafts(client, monkeypatch, user_id, business_id)
    assert client.get(f"/campaigns/{second_camp}/outbox?user_id={user_id}").json() == []


def test_csv_export_neutralises_spreadsheet_formulas(client, tenant, monkeypatch):
    user_id, business_id = tenant
    _customer(client, user_id, business_id, "Formula")
    campaign_id, drafts = _campaign_with_drafts(client, monkeypatch, user_id, business_id,
                                                draft_text='=HYPERLINK("http://evil.example","Book")')
    client.post(f"/outbox/{drafts[0]['id']}/approve?user_id={user_id}", json={"approved": True})
    rows = list(csv.DictReader(io.StringIO(client.get(f"/outbox/export.csv?campaign_id={campaign_id}&user_id={user_id}").text)))
    assert rows[0]["content"].startswith("'=")


def test_draft_generation_is_capped_per_request(client, tenant, monkeypatch):
    import main

    user_id, business_id = tenant
    _customer(client, user_id, business_id, "A")
    _customer(client, user_id, business_id, "B")
    monkeypatch.setattr(main, "MAX_DRAFTS_PER_REQUEST", 1)
    camp = client.post(f"/business/{business_id}/campaigns?user_id={user_id}",
                       json={"name": "c", "objective": "o", "offer_text": "x", "channel": "sms",
                             "segment_json": "{}"}).json()
    monkeypatch.setenv("OPENAI_API_KEY", FAKE_KEY)
    r = client.post(f"/campaigns/{camp['id']}/generate_drafts?user_id={user_id}")
    assert r.status_code == 413


# ---------- Known gap: there is no authentication ----------
# These describe the behaviour a public deployment needs. They fail today because the backend
# identifies the caller only by a user_id it is given; strict=True makes them fail loudly once
# real authentication exists, so they get turned into ordinary tests.

@pytest.mark.xfail(strict=True, reason="no authentication: POST /users/ returns any existing account by username")
def test_knowing_a_username_does_not_give_access_to_the_account(client, tenant):
    user_id, _ = tenant
    username = client.get(f"/users/{user_id}/").json()["username"]
    r = client.post("/users/", json={"username": username})
    assert r.status_code in (401, 403)


@pytest.mark.xfail(strict=True, reason="no authentication: the user_id query parameter is trusted as the caller")
def test_a_forged_user_id_cannot_read_another_tenants_customers(client, tenant):
    user_id, business_id = tenant
    r = client.get(f"/business/{business_id}/customers?user_id={user_id}")   # nothing proves who sent this
    assert r.status_code in (401, 403)
