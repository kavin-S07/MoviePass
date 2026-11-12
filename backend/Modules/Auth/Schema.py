from datetime import datetime
from enum import Enum

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserRole(str, Enum):

    TICKET_BOOKER = "TICKET_BOOKER"
    THEATRE_OWNER = "THEATRE_OWNER"
    ADMIN = "ADMIN"


class ApprovalStatus(str, Enum):

    APPROVED = "APPROVED"
    PENDING = "PENDING"
    REJECTED = "REJECTED"


# Signup request. Role is NOT accepted from the client;
# each signup endpoint assigns the correct role server-side.
class UserSignup(BaseModel):

    name: str = Field(min_length=2, max_length=100)

    email: EmailStr

    password: str = Field(min_length=8, max_length=128)

    phone_no: str = Field(pattern=r"^[0-9]{10}$")


# Login request
class UserLogin(BaseModel):

    email: EmailStr

    password: str


# User response
class UserResponse(BaseModel):

    model_config = ConfigDict(from_attributes=True)

    user_id: int = Field(validation_alias="id")

    name: str

    email: EmailStr

    role: str

    approval_status: str = "APPROVED"


# Login and signup response
class AuthResponse(BaseModel):

    message: str

    user: UserResponse

    access_token: str

    token_type: str = "Bearer"


# Refresh response
class RefreshResponse(BaseModel):

    access_token: str

    token_type: str = "Bearer"


# Home page response
class HomeResponse(BaseModel):

    message: str

    user: UserResponse


# Owner approval response
class PendingOwnerResponse(BaseModel):

    model_config = ConfigDict(from_attributes=True)

    user_id: int = Field(validation_alias="id")

    name: str

    email: EmailStr

    phone_no: str | None = None


class ApprovalActionResponse(BaseModel):

    message: str


class MessageResponse(BaseModel):

    message: str


class SessionResponse(BaseModel):

    session_id: int = Field(validation_alias="id")
    ip_address: str | None = None
    device_name: str | None = None
    user_agent: str | None = None
    created_at: datetime
    last_used_at: datetime | None = None
    expires_at: datetime
    is_current: bool = False

    model_config = ConfigDict(from_attributes=True)
