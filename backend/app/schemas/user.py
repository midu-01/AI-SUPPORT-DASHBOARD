from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class UserCreate(BaseModel):
    email: EmailStr
    # max_length is bcrypt's 72-byte limit: anything longer is silently ignored
    # by the algorithm, so it is rejected up front rather than quietly truncated.
    password: str = Field(min_length=8, max_length=72)
    full_name: str = Field(min_length=1, max_length=255)


class UserLogin(BaseModel):
    """Login needs only credentials — reusing UserCreate here would force
    clients to send full_name just to sign in.

    Deliberately no length rules: those belong on registration. Applying them
    here would reject existing passwords and leak the policy to attackers.
    """

    email: EmailStr
    password: str


class UserRead(BaseModel):
    id: str
    email: str
    full_name: str
    created_at: datetime

    model_config = {"from_attributes": True}


class LoginResponse(BaseModel):
    """No token in the body on purpose.

    The JWT is delivered only as an httpOnly cookie (Decision #1). Returning it
    here as well would hand JavaScript the very value the cookie exists to keep
    out of its reach, which would defeat the XSS protection entirely.
    """

    message: str = "Login successful"
