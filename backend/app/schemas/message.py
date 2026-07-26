from datetime import datetime

from pydantic import BaseModel

from app.models.message import MessageRole


class MessageCreate(BaseModel):
    content: str
    role: MessageRole = MessageRole.user


class MessageRead(BaseModel):
    id: str
    conversation_id: str
    role: MessageRole
    content: str
    created_at: datetime

    model_config = {"from_attributes": True}
