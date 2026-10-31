"""End-to-end API checks through FastAPI's TestClient, keyless, in a temporary working directory."""
import pytest


@pytest.fixture(scope="module")
def ids(client):
    user = client.post("/users/", json={"username": "demo@example.com"}).json()
    business = client.post(f"/users/{user['id']}/business", json={}).json()
    return user["id"], business["id"]


def test_loading_the_app_does_not_reset_the_business_profile(client, ids):
    user_id, business_id = ids
    patched = client.patch(f"/business/{business_id}?user_id={user_id}",
                           json={"name": "Harbor & Bean", "timezone": "Europe/Chisinau"}).json()
    assert patched["name"] == "Harbor & Bean"
    again = client.post(f"/users/{user_id}/business", json={})   # what the frontend sends on every load
    assert again.status_code == 201
    assert again.json()["name"] == "Harbor & Bean" and again.json()["timezone"] == "Europe/Chisinau"


def test_builtin_personas_are_listed_without_a_key(client, ids):
    user_id, _ = ids
    avatars = client.get(f"/users/{user_id}/avatars/").json()
    assert len([a for a in avatars if a["is_system"]]) == 4


def test_generate_drafts_without_a_key_is_a_clear_503(client, ids):
    user_id, business_id = ids
    client.post(f"/business/{business_id}/customers/upsert?user_id={user_id}",
                json={"email": "ana@example.com", "name": "Ana", "marketing_opt_in": True})
    camp = client.post(f"/business/{business_id}/campaigns?user_id={user_id}",
                       json={"name": "c", "objective": "o", "offer_text": "10% off", "channel": "sms"}).json()
    r = client.post(f"/campaigns/{camp['id']}/generate_drafts?user_id={user_id}")
    assert r.status_code == 503 and "OPENAI_API_KEY" in r.json()["detail"]


def test_business_routes_check_ownership(client, ids):
    _, business_id = ids
    other = client.post("/users/", json={"username": "other@example.com"}).json()
    assert client.get(f"/business/{business_id}?user_id={other['id']}").status_code == 403


def test_csv_export_contains_only_approved_messages(client, ids):
    user_id, business_id = ids
    camp = client.post(f"/business/{business_id}/campaigns?user_id={user_id}",
                       json={"name": "c2", "objective": "o", "offer_text": "x", "channel": "email"}).json()
    r = client.get(f"/outbox/export.csv?campaign_id={camp['id']}&user_id={user_id}")
    assert r.status_code == 200
    assert r.text.strip().splitlines() == ["id,campaign_id,customer_id,channel,content,status,approved_at"]
