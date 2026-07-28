from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, field_validator


class OrganizationCreate(BaseModel):
    name: str

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Name cannot be empty")
        return v.strip()


class OrganizationRead(BaseModel):
    id: str
    name: str
    created_at: datetime

    model_config = {"from_attributes": True}


class MembershipRead(BaseModel):
    """The caller's own membership row — returned alongside the org on create."""

    user_id: str
    org_id: str
    role: Literal["member", "admin"]
    joined_at: datetime

    model_config = {"from_attributes": True}


class OrganizationCreated(BaseModel):
    """201 response: the new org plus the creator's membership record."""

    organization: OrganizationRead
    membership: MembershipRead


class AddMemberRequest(BaseModel):
    """Body for POST /organizations/{org_id}/members."""

    user_id: str
    role: Literal["member", "admin"] = "member"


class InviteMemberRequest(BaseModel):
    """Body for POST /organizations/{org_id}/members/invite — email-based."""

    email: EmailStr
    role: Literal["member", "admin"] = "member"


class MemberDetail(BaseModel):
    """A member row enriched with user info, for the members list."""

    user_id: str
    org_id: str
    role: Literal["member", "admin"]
    joined_at: datetime
    email: str
    full_name: str

    model_config = {"from_attributes": True}
