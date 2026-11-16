from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from Modules.Auth.Dependencies import get_token
from Modules.Notifications import Service
from Modules.Notifications.Schema import MarkAllReadResponse, MarkReadResponse, NotificationListResponse, UnreadCountResponse
from config.database import get_db

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("", response_model=NotificationListResponse, status_code=status.HTTP_200_OK)
def list_notifications(db: Session = Depends(get_db), token: str = Depends(get_token)):
    return Service.list_notifications(db, token)


@router.get("/unread-count", response_model=UnreadCountResponse, status_code=status.HTTP_200_OK)
def unread_count(db: Session = Depends(get_db), token: str = Depends(get_token)):
    return Service.get_unread_count(db, token)


@router.post("/{notification_id}/read", response_model=MarkReadResponse, status_code=status.HTTP_200_OK)
def mark_read(notification_id: int, db: Session = Depends(get_db), token: str = Depends(get_token)):
    return Service.mark_notification_read(db, token, notification_id)


@router.post("/read-all", response_model=MarkAllReadResponse, status_code=status.HTTP_200_OK)
def mark_all_read(db: Session = Depends(get_db), token: str = Depends(get_token)):
    return Service.mark_all_notifications_read(db, token)
