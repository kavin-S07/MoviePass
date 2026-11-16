from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from Modules.Auth import Service as AuthService
from Modules.Notifications import Repository


def _require_ticket_booker(user):
    if user.role != "TICKET_BOOKER":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only ticket bookers can access notifications")


def create_user_notification(db: Session, *, user_id: int, type: str, title: str, message: str, related_booking_id: int | None = None, commit: bool = False):
    n = Repository.create_notification(db, user_id=user_id, type=type, title=title, message=message, related_booking_id=related_booking_id)
    if commit:
        db.commit()
    return n


def list_notifications(db: Session, token: str):
    user = AuthService.get_authenticated_user(db, token)
    _require_ticket_booker(user)
    items = Repository.list_notifications(db, user.id)
    unread = Repository.get_unread_count(db, user.id)
    return {"notifications": items, "unread_count": unread}


def get_unread_count(db: Session, token: str):
    user = AuthService.get_authenticated_user(db, token)
    _require_ticket_booker(user)
    return {"unread_count": Repository.get_unread_count(db, user.id)}


def mark_notification_read(db: Session, token: str, notification_id: int):
    user = AuthService.get_authenticated_user(db, token)
    _require_ticket_booker(user)
    n = Repository.get_notification_for_user(db, user.id, notification_id)
    if not n:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")
    Repository.mark_as_read(db, n)
    db.commit()
    return {"notification_id": n.notification_id, "is_read": n.is_read}


def mark_all_notifications_read(db: Session, token: str):
    user = AuthService.get_authenticated_user(db, token)
    _require_ticket_booker(user)
    updated = Repository.mark_all_as_read(db, user.id)
    unread = Repository.get_unread_count(db, user.id)
    db.commit()
    return {"updated_count": updated, "unread_count": unread}
