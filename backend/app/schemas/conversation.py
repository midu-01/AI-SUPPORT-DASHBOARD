from datetime import datetime

from pydantic import BaseModel, field_validator


class ConversationCreate(BaseModel):
    title: str

    @field_validator("title")
    @classmethod
    def title_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Title cannot be empty")
        return v.strip()


class ConversationUpdate(BaseModel):
    title: str

    @field_validator("title")
    @classmethod
    def title_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Title cannot be empty")
        return v.strip()


class ConversationRead(BaseModel):
    id: str
    user_id: str
    org_id: str
    title: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PaginatedConversations(BaseModel):
    items: list[ConversationRead]
    total: int
    page: int
    size: int
