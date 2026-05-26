from pydantic import BaseModel, EmailStr
from datetime import datetime
import uuid


class UserCreate(BaseModel):
    username: str
    email: str
    password: str
    role: str = "user"


class UserUpdate(BaseModel):
    username: str | None = None
    email: str | None = None
    password: str | None = None
    current_password: str | None = None  # required when changing password via /users/me
    role: str | None = None  # only used by admin endpoint


class UserResponse(BaseModel):
    id: uuid.UUID
    username: str
    email: str
    role: str
    created_at: datetime

    model_config = {"from_attributes": True}


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
