# main.py (relevant parts)

from fastapi import FastAPI, Depends, HTTPException, WebSocket, WebSocketDisconnect, status
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import create_engine, SQLModel, Session, select
from sqlalchemy import or_

from seed import seed_system_avatars

from database import get_session, DATABASE_URL, engine
from models import (
    UserCreate, UserRead, User,
    AvatarCreate, AvatarRead, Avatar,
    ChatRequest, ChatResponse, ChatSession,
    MessageRead, Message
)
from store import create_chat_session, get_chat_session, add_message
from assistant_api import create_new_thread, assistant_chat_sync, assistant_chat_stream

from prompter import build_avatar_prompt

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
engine = create_engine(DATABASE_URL, echo=True)


@app.on_event("startup")
def on_startup():
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        seed_system_avatars(session)


# ---------- Users ----------
@app.post("/users/", response_model=UserRead, status_code=201)
def create_user(user_in: UserCreate, session: Session = Depends(get_session)):
    user = User(**user_in.dict())
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


# ---------- Avatars ----------
@app.post("/users/{user_id}/avatars/", response_model=AvatarRead, status_code=201)
def create_avatar(user_id: int, avatar_in: AvatarCreate, session: Session = Depends(get_session)):
    if not session.get(User, user_id):
        raise HTTPException(404, "User not found")
    if avatar_in.prompt:
        prompt = avatar_in.prompt
    else:
        prompt = build_avatar_prompt(avatar_in)  # handle None fields gracefully
    avatar = Avatar(
        name=avatar_in.name,
        url=avatar_in.url,
        personality=avatar_in.personality or "",
        features=avatar_in.features or "",
        age=avatar_in.age or 0,
        gender=avatar_in.gender or "",
        hobbies=avatar_in.hobbies or "",
        prompt=prompt,
        owner_id=user_id
    )
    session.add(avatar)
    session.commit()
    session.refresh(avatar)
    return avatar


@app.get("/users/{user_id}/avatars/", response_model=list[AvatarRead])
def list_avatars(user_id: int, session: Session = Depends(get_session)):
    stmt = select(Avatar).where(
        or_(Avatar.is_system == True, Avatar.owner_id == user_id)
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
    thread_id = create_new_thread(avatar)
    return create_chat_session(user_id, avatar_id, thread_id, session)


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

    # persist user message
    add_message(session, chat.id, "user", req.message)

    # call OpenAI
    reply_text = assistant_chat_sync(chat.thread_id, avatar, req.message)

    # persist assistant message
    add_message(session, chat.id, "assistant", reply_text)

    return ChatResponse(reply=reply_text)


@app.websocket("/ws/assistant/{chat_id}")
async def assistant_ws(ws: WebSocket, chat_id: int):
    await ws.accept()
    session = next(get_session())
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

        while True:
            user_msg = await ws.receive_text()
            add_message(session, chat.id, "user", user_msg)
            buf = []
            for tok in assistant_chat_stream(chat.thread_id, avatar, user_msg):
                buf.append(tok)
                await ws.send_text(tok)
            full_reply = "".join(buf)
            add_message(session, chat.id, "assistant", full_reply)
    except WebSocketDisconnect:
        pass
