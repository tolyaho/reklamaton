# models.py
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel
from sqlalchemy import UniqueConstraint
from sqlmodel import Field, Relationship, SQLModel


LeadStage = str
OutboundStatus = str
Channel = str


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
    role: str
    content: str
    msg_type: Optional[str] = "chat"
    created_at: datetime

    class Config:
        from_attributes = True


class BusinessCreate(BaseModel):
    name: str = "My Business"
    brand_voice: str = "Friendly and helpful sales assistant"
    products_json: str = "[]"
    timezone: str = "Europe/Moscow"


class BusinessUpdate(BaseModel):
    name: Optional[str] = None
    brand_voice: Optional[str] = None
    products_json: Optional[str] = None
    timezone: Optional[str] = None


class BusinessRead(BaseModel):
    id: int
    owner_user_id: int
    name: str
    brand_voice: str
    products_json: str
    timezone: str
    created_at: datetime

    class Config:
        from_attributes = True


class CustomerUpsert(BaseModel):
    external_id: Optional[str] = None
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    preferred_channel: Optional[str] = None
    marketing_opt_in: Optional[bool] = None


class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    preferred_channel: Optional[str] = None
    marketing_opt_in: Optional[bool] = None


class CustomerRead(BaseModel):
    id: int
    business_id: int
    external_id: Optional[str]
    name: Optional[str]
    phone: Optional[str]
    email: Optional[str]
    preferred_channel: Optional[str]
    marketing_opt_in: bool
    marketing_opt_in_at: Optional[datetime]
    last_seen_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class CustomerProfileRead(BaseModel):
    id: int
    customer_id: int
    language: Optional[str]
    tone: Optional[str]
    interests_json: Optional[str]
    budget_min: Optional[int]
    budget_max: Optional[int]
    location: Optional[str]
    lead_stage: str
    lead_score: int
    objections_json: Optional[str]
    notes: Optional[str]
    updated_at: datetime

    class Config:
        from_attributes = True


class CampaignCreate(BaseModel):
    name: str
    objective: str
    offer_text: str
    channel: str
    segment_json: str = "{}"
    status: str = "draft"


class CampaignRead(BaseModel):
    id: int
    business_id: int
    name: str
    objective: str
    offer_text: str
    channel: str
    segment_json: str
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class OutboundMessageRead(BaseModel):
    id: int
    campaign_id: int
    customer_id: int
    channel: str
    content: str
    status: str
    created_at: datetime
    approved_at: Optional[datetime]
    sent_at: Optional[datetime]
    error: Optional[str]

    class Config:
        from_attributes = True


class ApproveRequest(BaseModel):
    approved: bool = True


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
    image_status: str = Field(default="pending")
    image_prompt: Optional[str] = None
    chats: List["ChatSession"] = Relationship(back_populates="avatar")
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Business(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    owner_user_id: int = Field(foreign_key="user.id", index=True)
    name: str
    brand_voice: str
    products_json: str
    timezone: str = "Europe/Moscow"
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Customer(SQLModel, table=True):
    __table_args__ = (UniqueConstraint("business_id", "external_id", name="uq_customer_business_external"),)
    id: Optional[int] = Field(default=None, primary_key=True)
    business_id: int = Field(foreign_key="business.id", index=True)
    external_id: Optional[str] = Field(default=None, index=True)
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    preferred_channel: Optional[str] = None
    marketing_opt_in: bool = False
    marketing_opt_in_at: Optional[datetime] = None
    last_seen_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


class CustomerProfile(SQLModel, table=True):
    customer_id: int = Field(foreign_key="customer.id", unique=True, index=True)
    id: Optional[int] = Field(default=None, primary_key=True)
    language: Optional[str] = None
    tone: Optional[str] = None
    interests_json: Optional[str] = None
    budget_min: Optional[int] = None
    budget_max: Optional[int] = None
    location: Optional[str] = None
    lead_stage: str = "new"
    lead_score: int = 0
    objections_json: Optional[str] = None
    notes: Optional[str] = None
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class Campaign(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    business_id: int = Field(foreign_key="business.id", index=True)
    name: str
    objective: str
    offer_text: str
    channel: str
    segment_json: str
    status: str = "draft"
    created_at: datetime = Field(default_factory=datetime.utcnow)


class OutboundMessage(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    campaign_id: int = Field(foreign_key="campaign.id", index=True)
    customer_id: int = Field(foreign_key="customer.id", index=True)
    channel: str
    content: str
    status: str = "draft"
    created_at: datetime = Field(default_factory=datetime.utcnow)
    approved_at: Optional[datetime] = None
    sent_at: Optional[datetime] = None
    error: Optional[str] = None


class CustomerEvent(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    customer_id: int = Field(foreign_key="customer.id", index=True)
    type: str
    payload_json: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


class ChatSession(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    thread_id: str = Field(index=True, description="OpenAI Thread ID")
    user_id: int = Field(foreign_key="user.id")
    avatar_id: int = Field(foreign_key="avatar.id")
    business_id: Optional[int] = Field(default=None, foreign_key="business.id", index=True)
    customer_id: Optional[int] = Field(default=None, foreign_key="customer.id", index=True)
    source_channel: str = Field(default="web")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    user: Optional[User] = Relationship(back_populates="chats")
    avatar: Optional[Avatar] = Relationship(back_populates="chats")
    messages: List["Message"] = Relationship(back_populates="chat")


class Message(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    chat_id: int = Field(foreign_key="chatsession.id", index=True)
    role: str
    content: str
    msg_type: str = "chat"
    created_at: datetime = Field(default_factory=datetime.utcnow)
    chat: Optional[ChatSession] = Relationship(back_populates="messages")
