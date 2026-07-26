from datetime import datetime

from pydantic import BaseModel, EmailStr


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str


class UserLogin(BaseModel):
    """Login needs only credentials — reusing UserCreate here would force
    clients to send full_name just to sign in."""

    email: EmailStr
    password: str


class UserRead(BaseModel):
    id: str
    email: str
    full_name: str
    created_at: datetime

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    message: str = "Login successful"
