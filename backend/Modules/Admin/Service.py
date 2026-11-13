from sqlalchemy.orm import Session

from Modules.Admin import Repository
from Modules.Auth import Service as AuthService
from Modules.Theatres import Repository as TheatreRepository


def _paginate(page: int | None, page_size: int | None, default_size: int = 10, max_size: int = 50):
    page = max(page or 1, 1)
    page_size = min(max(page_size or default_size, 1), max_size)
    return page, page_size


def get_overview(db: Session, token: str):
    AuthService.get_admin_user(db, token)

    summary = {
        "total_users": Repository.count_users(db),
        "total_theatres": TheatreRepository.count_theatres(db, None),
        "total_screens": TheatreRepository.count_screens(db, None),
        "total_movies": TheatreRepository.count_movies(db),
        "total_shows": TheatreRepository.count_shows(db, None),
        "upcoming_shows": TheatreRepository.count_upcoming_shows(db, None),
        "pending_owner_approvals": Repository.count_pending_owners(db),
    }

    pending_owners = [
        {
            "user_id": user.id,
            "name": user.name,
            "email": user.email,
            "phone_no": user.phone_no,
            "approval_status": user.approval_status,
        }
        for user in Repository.list_pending_owners(db, limit=8)
    ]

    recent_theatres = [
        {
            "theatre_id": t.theatre_id,
            "name": t.name,
            "city": t.city,
            "address": t.address,
            "status": t.status,
            "owner_id": t.owner_id,
        }
        for t in TheatreRepository.list_recent_theatres(db, None, limit=8)
    ]

    upcoming_shows = [
        {
            "show_id": row.show_id,
            "movie_name": row.movie_name,
            "screen_name": row.screen_name,
            "theatre_name": row.theatre_name,
            "show_date": row.show_date,
            "start_time": row.start_time,
            "status": row.status,
        }
        for row in TheatreRepository.list_upcoming_shows(db, None, limit=8)
    ]

    return {
        "summary": summary,
        "role_breakdown": Repository.count_users_by_role(db),
        "owner_approval_breakdown": Repository.count_owner_approvals(db),
        "pending_owners": pending_owners,
        "recent_theatres": recent_theatres,
        "upcoming_shows": upcoming_shows,
    }


def list_users(db: Session, token: str, q: str | None = None, role: str | None = None, approval_status: str | None = None, page: int | None = 1, page_size: int | None = 10):
    AuthService.get_admin_user(db, token)
    page, page_size = _paginate(page, page_size)
    items, total = Repository.list_users(db, q, role, approval_status, page, page_size)
    return {"items": items, "total": total, "page": page, "page_size": page_size}


def list_theatres(db: Session, token: str, q: str | None = None, status: str | None = None, page: int | None = 1, page_size: int | None = 10):
    AuthService.get_admin_user(db, token)
    page, page_size = _paginate(page, page_size)
    items, total = Repository.list_theatres(db, q, status, page, page_size)
    return {"items": items, "total": total, "page": page, "page_size": page_size}


def list_movies(db: Session, token: str, q: str | None = None, page: int | None = 1, page_size: int | None = 10):
    AuthService.get_admin_user(db, token)
    page, page_size = _paginate(page, page_size)
    items, total = Repository.list_movies(db, q, page, page_size)
    return {"items": items, "total": total, "page": page, "page_size": page_size}


def list_shows(db: Session, token: str, q: str | None = None, status: str | None = None, page: int | None = 1, page_size: int | None = 10):
    AuthService.get_admin_user(db, token)
    page, page_size = _paginate(page, page_size)
    items, total = Repository.list_shows(db, q, status, page, page_size)
    return {"items": items, "total": total, "page": page, "page_size": page_size}
