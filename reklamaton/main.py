import csv
import glob
import io
import json
import logging
import os
import threading
from datetime import datetime, timedelta
from typing import Optional

from dotenv import load_dotenv
from fastapi import (
    FastAPI, Depends, HTTPException,
    WebSocket, WebSocketDisconnect,
    BackgroundTasks, Query
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from sqlmodel import SQLModel, Session, select
from sqlalchemy import or_, text

load_dotenv()

from seed import seed_system_avatars
from database import get_session, engine
from models import (
    UserCreate, UserRead, User,
    AvatarCreate, AvatarRead, Avatar,
    ChatRequest, ChatResponse, ChatSession,
    MessageRead, Message,
    Business, BusinessCreate, BusinessRead, BusinessUpdate,
    Customer, CustomerUpsert, CustomerRead, CustomerUpdate, CustomerProfileRead, CustomerProfile,
    Campaign, CampaignCreate, CampaignRead,
    OutboundMessage, OutboundMessageRead,
    ApproveRequest,
)
from store import (
    create_chat_session,
    get_chat_session,
    add_message,
    get_or_create_business_for_user,
    update_business,
    upsert_customer,
    get_customer,
    list_customers,
    update_customer_preferences,
    ensure_customer_profile,
    apply_profile_patch,
    create_campaign,
    list_campaigns,
    generate_outbound_drafts,
    approve_outbound,
    mark_sent_outbound,
    is_rate_limited_approval,
)
from llm import create_conversation, chat_sync, chat_stream
from prompter import build_avatar_prompt, build_image_prompt, build_sales_prompt
from profile_extractor import extract_profile_patch
from ad_gen import generate_ad_message

from image_gen import OpenAIImageAPI

logger = logging.getLogger(__name__)


def _cors_origins() -> list[str]:
    raw = (os.getenv("CORS_ORIGINS") or "").strip()
    if raw:
        return [o.strip() for o in raw.split(",") if o.strip()]
    return [
        "http://localhost:5174",
        "http://127.0.0.1:5174",
    ]


# --- filesystem ---
os.makedirs("static/avatars", exist_ok=True)

# --- app ---
app = FastAPI(
    title="Reklamaton API",
    description="Sales automation MVP: customers, campaigns, AI chat, and outbound drafts.",
    version="1.0.0",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory="static"), name="static")

# --- OpenAI image client ---
image_client = None
AVATAR_PENDING_TIMEOUT_SEC = 600


def _table_columns(session: Session, table_name: str) -> set[str]:
    rows = session.exec(text(f"PRAGMA table_info({table_name})")).all()
    cols = set()
    for r in rows:
        try:
            cols.add(r[1])
        except Exception:
            pass
    return cols


def _ensure_column(session: Session, table_name: str, column_name: str, ddl: str):
    if column_name in _table_columns(session, table_name):
        return
    session.exec(text(f"ALTER TABLE {table_name} ADD COLUMN {ddl}"))
    session.commit()


def _run_schema_migrations(session: Session):
    _ensure_column(session, "chatsession", "business_id", "business_id INTEGER")
    _ensure_column(session, "chatsession", "customer_id", "customer_id INTEGER")
    _ensure_column(session, "chatsession", "source_channel", "source_channel VARCHAR DEFAULT 'web'")
    _ensure_column(session, "message", "msg_type", "msg_type VARCHAR DEFAULT 'chat'")


def _assert_business_owner(session: Session, business_id: int, user_id: int) -> Business:
    business = session.get(Business, business_id)
    if not business:
        raise HTTPException(404, "Business not found")
    if business.owner_user_id != user_id:
        raise HTTPException(403, "Forbidden: business ownership mismatch")
    return business


def _parse_json_list(raw: Optional[str]) -> list[str]:
    if not raw:
        return []
    try:
        parsed = json.loads(raw)
        return [str(x) for x in parsed] if isinstance(parsed, list) else []
    except Exception:
        return []


def _build_chat_instructions(
    avatar: Avatar,
    business: Optional[Business],
    customer: Optional[Customer],
    profile: Optional[CustomerProfile],
) -> str:
    if business and customer and profile:
        sales_prompt = build_sales_prompt(business, avatar, customer, profile)
        return f"{avatar.prompt}\n\n{sales_prompt}"
    return avatar.prompt


def _profile_snapshot(profile: CustomerProfile) -> dict:
    return {
        "language": profile.language,
        "tone": profile.tone,
        "interests": _parse_json_list(profile.interests_json),
        "budget_min": profile.budget_min,
        "budget_max": profile.budget_max,
        "location": profile.location,
        "lead_stage": profile.lead_stage,
        "lead_score": profile.lead_score,
        "objections": _parse_json_list(profile.objections_json),
        "notes": profile.notes,
    }


def _update_profile_from_turn(session: Session, chat: ChatSession, user_msg: str, assistant_msg: str):
    if not chat.customer_id:
        return
    profile = ensure_customer_profile(session, chat.customer_id)
    patch = extract_profile_patch(
        prev_profile=_profile_snapshot(profile),
        conversation_snippet={"last_user_message": user_msg, "last_assistant_message": assistant_msg},
    )
    apply_profile_patch(session, chat.customer_id, patch)
    customer = session.get(Customer, chat.customer_id)
    if customer:
        customer.last_seen_at = datetime.utcnow()
        session.add(customer)
        session.commit()


def _set_avatar_status(avatar_id: int, status: str, image_url: str | None = None):
    with Session(engine) as s:
        av = s.get(Avatar, avatar_id)
        if not av:
            return
        av.image_status = status
        if image_url is not None:
            av.image_url = image_url
        s.add(av)
        s.commit()


def _expire_stale_pending_avatars(session: Session):
    cutoff = datetime.utcnow() - timedelta(seconds=AVATAR_PENDING_TIMEOUT_SEC)
    stale = session.exec(
        select(Avatar).where(
            Avatar.image_status == "pending",
            Avatar.created_at <= cutoff,
        )
    ).all()
    if not stale:
        return
    for av in stale:
        av.image_status = "failed"
        session.add(av)
    session.commit()


def generate_avatar_image_async(avatar_id: int, image_prompt: str):
    """Background: generate + save + update DB."""
    global image_client
    if not image_client:
        _set_avatar_status(avatar_id, "failed")
        return

    out_prefix = f"static/avatars/avatar_{avatar_id}"

    try:
        req_id = image_client.generate(image_prompt)
        files = image_client.check_generation(req_id)
        if not files:
            raise RuntimeError("No files returned")

        image_client.save_images(files, out_prefix)

        # The client may save different formats; detect what was saved.
        saved = sorted(glob.glob(out_prefix + "_1.*"))
        if not saved:
            raise RuntimeError("Saved image not found")

        fname = os.path.basename(saved[0])
        _set_avatar_status(avatar_id, "ready", f"/static/avatars/{fname}")

    except Exception as e:
        _set_avatar_status(avatar_id, "failed")
        logger.exception("Avatar generation failed")


def generate_avatar_image_with_timeout(avatar_id: int, image_prompt: str):
    worker = threading.Thread(
        target=generate_avatar_image_async,
        args=(avatar_id, image_prompt),
        daemon=True,
    )
    worker.start()
    worker.join(AVATAR_PENDING_TIMEOUT_SEC)
    if worker.is_alive():
        _set_avatar_status(avatar_id, "failed")


def queue_system_avatar_generation():
    global image_client
    if not image_client:
        return

    with Session(engine) as s:
        pending = s.exec(
            select(Avatar).where(
                Avatar.is_system == True,
                Avatar.image_status == "pending",
            )
        ).all()

    for av in pending:
        threading.Thread(
            target=generate_avatar_image_with_timeout,
            args=(av.id, av.image_prompt),
            daemon=True,
        ).start()


@app.on_event("startup")
def on_startup():
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        _run_schema_migrations(session)
        seed_system_avatars(session)

    global image_client
    if os.getenv("OPENAI_API_KEY"):
        try:
            image_client = OpenAIImageAPI()
            logger.info("OpenAI image client initialized")
        except Exception as e:
            image_client = None
            logger.warning("OpenAI image generation disabled: %s", e)
    else:
        logger.info("OPENAI_API_KEY not set — image generation disabled")

    queue_system_avatar_generation()


# ---------- Avatars (single route only; removed duplicate) ----------
@app.get("/avatars/{avatar_id}/", response_model=AvatarRead)
def get_avatar(avatar_id: int, session: Session = Depends(get_session)):
    av = session.get(Avatar, avatar_id)
    if not av:
        raise HTTPException(404, "Avatar not found")
    return av


# ---------- Users ----------
@app.post("/users/", response_model=UserRead, status_code=201)
def create_or_get_user(user_in: UserCreate, session: Session = Depends(get_session)):
    stmt = select(User).where(User.username == user_in.username)
    existing = session.exec(stmt).first()
    if existing:
        return existing

    user = User(username=user_in.username, age=user_in.age, sex=user_in.sex)
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


@app.get("/users/{user_id}/", response_model=UserRead)
def read_user(user_id: int, session: Session = Depends(get_session)):
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(404, "User not found")
    return user


# ---------- Business ----------
@app.post("/users/{user_id}/business", response_model=BusinessRead, status_code=201)
def create_or_get_business(
    user_id: int,
    payload: Optional[BusinessCreate] = None,
    session: Session = Depends(get_session),
):
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(404, "User not found")
    business = get_or_create_business_for_user(session, user_id)
    if payload:
        business = update_business(session, business.id, payload.model_dump(exclude_none=True))
    return business


@app.patch("/business/{business_id}", response_model=BusinessRead)
def patch_business(
    business_id: int,
    user_id: int = Query(...),
    patch: BusinessUpdate = ...,
    session: Session = Depends(get_session),
):
    _assert_business_owner(session, business_id, user_id)
    updated = update_business(session, business_id, patch.model_dump(exclude_none=True))
    if not updated:
        raise HTTPException(404, "Business not found")
    return updated


@app.get("/business/{business_id}", response_model=BusinessRead)
def get_business(
    business_id: int,
    user_id: int = Query(...),
    session: Session = Depends(get_session),
):
    return _assert_business_owner(session, business_id, user_id)


# ---------- Customers ----------
@app.post("/business/{business_id}/customers/upsert", response_model=CustomerRead)
def upsert_customer_route(
    business_id: int,
    payload: CustomerUpsert,
    user_id: int = Query(...),
    session: Session = Depends(get_session),
):
    _assert_business_owner(session, business_id, user_id)
    customer = upsert_customer(
        session,
        business_id=business_id,
        external_id=payload.external_id,
        phone=payload.phone,
        email=payload.email,
        name=payload.name,
        preferred_channel=payload.preferred_channel,
        marketing_opt_in=payload.marketing_opt_in,
    )
    return customer


@app.get("/business/{business_id}/customers", response_model=list[CustomerRead])
def list_customers_route(
    business_id: int,
    user_id: int = Query(...),
    search: Optional[str] = Query(None),
    session: Session = Depends(get_session),
):
    _assert_business_owner(session, business_id, user_id)
    return list_customers(session, business_id, search)


@app.get("/business/{business_id}/customers/{customer_id}", response_model=CustomerRead)
def get_customer_route(
    business_id: int,
    customer_id: int,
    user_id: int = Query(...),
    session: Session = Depends(get_session),
):
    _assert_business_owner(session, business_id, user_id)
    customer = get_customer(session, business_id, customer_id)
    if not customer:
        raise HTTPException(404, "Customer not found")
    return customer


@app.patch("/business/{business_id}/customers/{customer_id}", response_model=CustomerRead)
def patch_customer_route(
    business_id: int,
    customer_id: int,
    patch: CustomerUpdate,
    user_id: int = Query(...),
    session: Session = Depends(get_session),
):
    _assert_business_owner(session, business_id, user_id)
    customer = get_customer(session, business_id, customer_id)
    if not customer:
        raise HTTPException(404, "Customer not found")
    updated = update_customer_preferences(session, customer_id, patch.model_dump(exclude_none=True))
    if not updated:
        raise HTTPException(404, "Customer not found")
    return updated


@app.get("/business/{business_id}/customers/{customer_id}/profile", response_model=CustomerProfileRead)
def get_customer_profile_route(
    business_id: int,
    customer_id: int,
    user_id: int = Query(...),
    session: Session = Depends(get_session),
):
    _assert_business_owner(session, business_id, user_id)
    customer = get_customer(session, business_id, customer_id)
    if not customer:
        raise HTTPException(404, "Customer not found")
    return ensure_customer_profile(session, customer_id)


# ---------- Avatars ----------
@app.post("/users/{user_id}/avatars/", response_model=AvatarRead, status_code=201)
def create_avatar(
    user_id: int,
    avatar_in: AvatarCreate,
    background: BackgroundTasks,
    session: Session = Depends(get_session),
):
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(404, "User not found")

    persona_prompt = build_avatar_prompt(avatar_in)
    image_prompt = build_image_prompt(avatar_in)

    avatar = Avatar(
        name=avatar_in.name,
        personality=avatar_in.personality,
        features=avatar_in.features,
        age=avatar_in.age,
        gender=avatar_in.gender,
        hobbies=avatar_in.hobbies,
        prompt=persona_prompt,
        owner_id=user_id,
        image_prompt=image_prompt,
        image_status="pending",
        image_url=None,
    )
    session.add(avatar)
    session.commit()
    session.refresh(avatar)

    background.add_task(generate_avatar_image_with_timeout, avatar.id, image_prompt)
    return avatar


@app.get("/users/{user_id}/avatars/", response_model=list[AvatarRead])
def list_avatars(user_id: int, session: Session = Depends(get_session)):
    _expire_stale_pending_avatars(session)
    stmt = select(Avatar).where(
        or_(Avatar.is_system == True, Avatar.owner_id == user_id),
        Avatar.image_status != "failed",
    )
    return session.exec(stmt).all()


# ---------- Chats ----------
@app.post("/users/{user_id}/chats/", response_model=ChatSession, status_code=201)
def new_chat(user_id: int, avatar_id: int, session: Session = Depends(get_session)):
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(404, "User not found")

    avatar = session.get(Avatar, avatar_id)
    if not avatar or (avatar.owner_id != user_id and not avatar.is_system):
        raise HTTPException(404, "Avatar not found")

    try:
        thread_id = create_conversation()
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"LLM unavailable: {e}")

    return create_chat_session(user_id, avatar_id, thread_id, session)


@app.post("/business/{business_id}/chats/", response_model=ChatSession, status_code=201)
def new_business_chat(
    business_id: int,
    avatar_id: int,
    customer_id: int,
    user_id: int = Query(...),
    source_channel: str = Query("web"),
    session: Session = Depends(get_session),
):
    _assert_business_owner(session, business_id, user_id)
    avatar = session.get(Avatar, avatar_id)
    if not avatar:
        raise HTTPException(404, "Avatar not found")
    customer = get_customer(session, business_id, customer_id)
    if not customer:
        raise HTTPException(404, "Customer not found")
    try:
        thread_id = create_conversation()
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"LLM unavailable: {e}")
    return create_chat_session(
        user_id=user_id,
        avatar_id=avatar_id,
        thread_id=thread_id,
        session=session,
        business_id=business_id,
        customer_id=customer_id,
        source_channel=source_channel,
    )


@app.get("/users/{user_id}/chats/", response_model=list[ChatSession])
def list_chats(user_id: int, session: Session = Depends(get_session)):
    stmt = select(ChatSession).where(ChatSession.user_id == user_id)
    return session.exec(stmt).all()


# ---------- Messages ----------
@app.get("/chats/{chat_id}/messages/", response_model=list[MessageRead])
def list_messages(chat_id: int, session: Session = Depends(get_session)):
    chat = get_chat_session(chat_id, session)
    if not chat:
        raise HTTPException(404, "Chat not found")

    stmt = select(Message).where(Message.chat_id == chat_id).order_by(Message.created_at.asc())
    return session.exec(stmt).all()


# ---------- Assistant ----------
@app.post("/api/assistant/{chat_id}/", response_model=ChatResponse)
def assistant_send(chat_id: int, req: ChatRequest, session: Session = Depends(get_session)):
    chat = get_chat_session(chat_id, session)
    if not chat:
        raise HTTPException(404, "Chat not found")
    if chat.avatar_id != req.avatar_id:
        raise HTTPException(400, "Avatar mismatch for this chat")

    avatar = session.get(Avatar, chat.avatar_id)
    if not avatar:
        raise HTTPException(404, "Avatar not found")

    add_message(session, chat.id, "user", req.message)
    business = session.get(Business, chat.business_id) if chat.business_id else None
    customer = session.get(Customer, chat.customer_id) if chat.customer_id else None
    profile = ensure_customer_profile(session, chat.customer_id) if chat.customer_id else None
    instructions = _build_chat_instructions(avatar, business, customer, profile)

    try:
        reply_text = chat_sync(chat.thread_id, instructions, req.message)
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"LLM unavailable: {e}")

    add_message(session, chat.id, "assistant", reply_text)
    _update_profile_from_turn(session, chat, req.message, reply_text)
    return ChatResponse(reply=reply_text)


# ---------- Campaigns / Outbox ----------
def _customer_matches_segment(session: Session, customer: Customer, segment: dict) -> bool:
    if segment.get("marketing_opt_in") is True and not customer.marketing_opt_in:
        return False
    profile = ensure_customer_profile(session, customer.id)
    stages = segment.get("lead_stage_in") or segment.get("lead_stage")
    if isinstance(stages, list) and stages and profile.lead_stage not in stages:
        return False
    interests_any = segment.get("interests_any")
    if isinstance(interests_any, list) and interests_any:
        customer_interests = set(_parse_json_list(profile.interests_json))
        if not customer_interests.intersection({str(x) for x in interests_any}):
            return False
    older_days = segment.get("last_seen_older_than_days")
    if isinstance(older_days, int):
        if not customer.last_seen_at:
            return True
        cutoff = datetime.utcnow() - timedelta(days=older_days)
        if customer.last_seen_at > cutoff:
            return False
    return True


@app.post("/business/{business_id}/campaigns", response_model=CampaignRead, status_code=201)
def create_campaign_route(
    business_id: int,
    payload: CampaignCreate,
    user_id: int = Query(...),
    session: Session = Depends(get_session),
):
    _assert_business_owner(session, business_id, user_id)
    return create_campaign(session, business_id, payload.model_dump())


@app.get("/business/{business_id}/campaigns", response_model=list[CampaignRead])
def list_campaigns_route(
    business_id: int,
    user_id: int = Query(...),
    session: Session = Depends(get_session),
):
    _assert_business_owner(session, business_id, user_id)
    return list_campaigns(session, business_id)


@app.post("/campaigns/{campaign_id}/generate_drafts", response_model=list[OutboundMessageRead])
def generate_drafts_route(
    campaign_id: int,
    user_id: int = Query(...),
    customer_ids: Optional[str] = Query(None),
    session: Session = Depends(get_session),
):
    campaign = session.get(Campaign, campaign_id)
    if not campaign:
        raise HTTPException(404, "Campaign not found")
    business = _assert_business_owner(session, campaign.business_id, user_id)
    try:
        segment = json.loads(campaign.segment_json or "{}")
    except Exception:
        segment = {}

    if customer_ids:
        wanted_ids = {int(x) for x in customer_ids.split(",") if x.strip().isdigit()}
        customers = [
            c for c in list_customers(session, campaign.business_id)
            if c.id in wanted_ids
        ]
    else:
        customers = list_customers(session, campaign.business_id)

    selected: list[Customer] = []
    for customer in customers:
        if not _customer_matches_segment(session, customer, segment):
            continue
        if not customer.marketing_opt_in:
            continue
        selected.append(customer)

    content_map: dict[int, str] = {}
    for customer in selected:
        profile = ensure_customer_profile(session, customer.id)
        content_map[customer.id] = generate_ad_message(business, campaign, customer, profile)

    return generate_outbound_drafts(
        session=session,
        campaign_id=campaign_id,
        customer_ids=[c.id for c in selected],
        content_map=content_map,
        channel=campaign.channel,
    )


@app.get("/campaigns/{campaign_id}/outbox", response_model=list[OutboundMessageRead])
def list_outbox_route(
    campaign_id: int,
    user_id: int = Query(...),
    session: Session = Depends(get_session),
):
    campaign = session.get(Campaign, campaign_id)
    if not campaign:
        raise HTTPException(404, "Campaign not found")
    _assert_business_owner(session, campaign.business_id, user_id)
    return session.exec(select(OutboundMessage).where(OutboundMessage.campaign_id == campaign_id)).all()


@app.post("/outbox/{message_id}/approve", response_model=OutboundMessageRead)
def approve_outbox_route(
    message_id: int,
    payload: ApproveRequest,
    user_id: int = Query(...),
    session: Session = Depends(get_session),
):
    msg = session.get(OutboundMessage, message_id)
    if not msg:
        raise HTTPException(404, "Outbox message not found")
    campaign = session.get(Campaign, msg.campaign_id)
    if not campaign:
        raise HTTPException(404, "Campaign not found")
    _assert_business_owner(session, campaign.business_id, user_id)
    if payload.approved and is_rate_limited_approval(session, msg.customer_id):
        raise HTTPException(429, "Rate limit: already approved message for this customer within 24h")
    updated = approve_outbound(session, message_id) if payload.approved else msg
    return updated


@app.post("/outbox/{message_id}/mark_sent", response_model=OutboundMessageRead)
def mark_outbox_sent_route(
    message_id: int,
    user_id: int = Query(...),
    session: Session = Depends(get_session),
):
    msg = session.get(OutboundMessage, message_id)
    if not msg:
        raise HTTPException(404, "Outbox message not found")
    campaign = session.get(Campaign, msg.campaign_id)
    if not campaign:
        raise HTTPException(404, "Campaign not found")
    _assert_business_owner(session, campaign.business_id, user_id)
    updated = mark_sent_outbound(session, message_id)
    if not updated:
        raise HTTPException(404, "Outbox message not found")
    return updated


@app.get("/outbox/export.csv")
def export_outbox_csv(
    campaign_id: int,
    user_id: int = Query(...),
    session: Session = Depends(get_session),
):
    campaign = session.get(Campaign, campaign_id)
    if not campaign:
        raise HTTPException(404, "Campaign not found")
    _assert_business_owner(session, campaign.business_id, user_id)
    rows = session.exec(
        select(OutboundMessage).where(
            OutboundMessage.campaign_id == campaign_id,
            OutboundMessage.status == "approved",
        )
    ).all()
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["id", "campaign_id", "customer_id", "channel", "content", "status", "approved_at"])
    for m in rows:
        writer.writerow([m.id, m.campaign_id, m.customer_id, m.channel, m.content, m.status, m.approved_at or ""])
    data = io.BytesIO(buf.getvalue().encode("utf-8"))
    return StreamingResponse(
        data,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="outbox_campaign_{campaign_id}.csv"'},
    )


@app.websocket("/ws/assistant/{chat_id}")
async def assistant_ws(ws: WebSocket, chat_id: int):
    await ws.accept()
    session = Session(engine)
    try:
        chat = get_chat_session(chat_id, session)
        if not chat:
            await ws.close(code=4404)
            return

        avatar_id = int(ws.query_params.get("avatar_id", chat.avatar_id))
        avatar = session.get(Avatar, avatar_id)
        if not avatar:
            await ws.close(code=4404)
            return
        business = session.get(Business, chat.business_id) if chat.business_id else None
        customer = session.get(Customer, chat.customer_id) if chat.customer_id else None
        profile = ensure_customer_profile(session, chat.customer_id) if chat.customer_id else None
        instructions = _build_chat_instructions(avatar, business, customer, profile)

        while True:
            user_msg = await ws.receive_text()
            add_message(session, chat.id, "user", user_msg)

            buf = []
            try:
                for tok in chat_stream(chat.thread_id, instructions, user_msg):
                    buf.append(tok)
                    await ws.send_text(tok)
            except Exception as e:
                await ws.send_text(f"\n[LLM unavailable: {e}]\n")
                continue

            full_reply = "".join(buf)
            add_message(session, chat.id, "assistant", full_reply)
            _update_profile_from_turn(session, chat, user_msg, full_reply)

    except WebSocketDisconnect:
        pass
    finally:
        session.close()