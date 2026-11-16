from datetime import datetime, timezone

from sqlalchemy.orm import Session

from Modules.Notifications.Model import Notification


def utcnow():
    return datetime.now(timezone.utc)


def create_notification(db: Session, *, user_id: int, type: str, title: str, message: str, related_booking_id: int | None = None):
    n = Notification(
        user_id=user_id,
        type=type,
        title=title,
        message=message,
        related_booking_id=related_booking_id,
        is_read=False,
    )
    db.add(n)
    db.flush()
    return n


def list_notifications(db: Session, user_id: int, limit: int = 100):
    return (
        db.query(Notification)
        .filter(Notification.user_id == user_id)
        .order_by(Notification.created_at.desc(), Notification.notification_id.desc())
        .limit(limit)
        .all()
    )


def get_unread_count(db: Session, user_id: int) -> int:
    return db.query(Notification).filter(Notification.user_id == user_id, Notification.is_read.is_(False)).count()


def get_notification_for_user(db: Session, user_id: int, notification_id: int):
    return db.query(Notification).filter(Notification.notification_id == notification_id, Notification.user_id == user_id).first()


def mark_as_read(db: Session, notification: Notification):
    if not notification.is_read:
        notification.is_read = True
        notification.read_at = utcnow()
        db.flush()
    return notification


def mark_all_as_read(db: Session, user_id: int):
    now = utcnow()
    q = db.query(Notification).filter(Notification.user_id == user_id, Notification.is_read.is_(False))
    count = q.count()
    if count:
        q.update({Notification.is_read: True, Notification.read_at: now}, synchronize_session=False)
        db.flush()
    return count
