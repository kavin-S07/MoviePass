from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class NotificationItem(BaseModel):
    notification_id: int
    type: str
    title: str
    message: str
    related_booking_id: Optional[int] = None
    is_read: bool
    created_at: datetime
    read_at: Optional[datetime] = None


class NotificationListResponse(BaseModel):
    notifications: List[NotificationItem] = Field(default_factory=list)
    unread_count: int = 0


class UnreadCountResponse(BaseModel):
    unread_count: int


class MarkReadResponse(BaseModel):
    notification_id: int
    is_read: bool


class MarkAllReadResponse(BaseModel):
    updated_count: int
    unread_count: int
