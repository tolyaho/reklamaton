# models.py
from datetime import datetime
from typing import Optional, List

from pydantic import BaseModel
from sqlmodel import SQLModel, Field, Relationship


# ─────────── API Schemas (Pydantic) ───────────

class UserCreate(BaseModel):
    username: str
    age: Optional[int] = None
    sex: Optional[str] = None


class UserRead(UserCreate):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class AvatarCreate(BaseModel):
    name: str
    url: str | None = None
    personality: str | None = None
    features: str | None = None
    age: int | None = None
    is_system: bool | None = None
    gender: str | None = None
    hobbies: str | None = None
    prompt: str | None = None


class AvatarRead(AvatarCreate):
    id: int
    owner_id: Optional[int]
    is_system: bool
    created_at: datetime
    prompt: str
    image_url: Optional[str]
    image_status: str

    class Config:
        from_attributes = True


class ChatRequest(BaseModel):
    avatar_id: int
    message: str


class ChatResponse(BaseModel):
    reply: str


class MessageRead(BaseModel):
    id: int
    chat_id: int
    role: str  # "user" | "assistant"
    content: str
    created_at: datetime

    class Config:
        from_attributes = True


# ─────────── ORM Tables (SQLModel) ───────────

class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    username: str = Field(index=True, sa_column_kwargs={"unique": True})
    age: Optional[int] = None
    sex: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    avatars: List["Avatar"] = Relationship(back_populates="owner")
    chats: List["ChatSession"] = Relationship(back_populates="user")


class Avatar(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    url: Optional[str] = Field(default=None)
    personality: str
    features: str
    age: int
    gender: str
    hobbies: str
    prompt: str
    is_system: bool = Field(default=False)

    owner_id: Optional[int] = Field(default=None, foreign_key="user.id")
    owner: Optional[User] = Relationship(back_populates="avatars")

    image_url: Optional[str] = Field(default=None, index=True)
    image_status: str = Field(default="pending")  # pending | ready | failed
    image_prompt: Optional[str] = None

    chats: List["ChatSession"] = Relationship(back_populates="avatar")
    created_at: datetime = Field(default_factory=datetime.utcnow)


class ChatSession(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    thread_id: str = Field(index=True, description="OpenAI Thread ID")

    user_id: int = Field(foreign_key="user.id")
    avatar_id: int = Field(foreign_key="avatar.id")
    created_at: datetime = Field(default_factory=datetime.utcnow)

    user: Optional[User] = Relationship(back_populates="chats")
    avatar: Optional[Avatar] = Relationship(back_populates="chats")
    messages: List["Message"] = Relationship(back_populates="chat")


class Message(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    chat_id: int = Field(foreign_key="chatsession.id", index=True)
    role: str  # "user" or "assistant"
    content: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

    chat: Optional[ChatSession] = Relationship(back_populates="messages")
