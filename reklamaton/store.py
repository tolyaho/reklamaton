# store.py
from typing import Optional
from sqlmodel import Session

from models import ChatSession, Message


def create_chat_session(user_id: int, avatar_id: int, thread_id: str, session: Session) -> ChatSession:
    chat = ChatSession(user_id=user_id, avatar_id=avatar_id, thread_id=thread_id)
    session.add(chat)
    session.commit()
    session.refresh(chat)
    return chat


def get_chat_session(chat_id: int, session: Session) -> Optional[ChatSession]:
    return session.get(ChatSession, chat_id)


def add_message(session: Session, chat_id: int, role: str, content: str) -> Message:
    msg = Message(chat_id=chat_id, role=role, content=content)
    session.add(msg)
    session.commit()
    session.refresh(msg)
    return msg
