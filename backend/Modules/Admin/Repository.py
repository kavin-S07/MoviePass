from datetime import date

from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from Modules.Auth.Model import User
from Modules.Theatres.Model import Movie, Screen, Show, Theatre


def count_users(db: Session):
    return db.query(func.count(User.id)).scalar() or 0


def count_users_by_role(db: Session):
    rows = db.query(User.role, func.count(User.id)).group_by(User.role).all()
    return [{"role": role, "count": count} for role, count in rows]


def count_owner_approvals(db: Session):
    rows = db.query(User.approval_status, func.count(User.id)).filter(
        User.role == "THEATRE_OWNER"
    ).group_by(User.approval_status).all()
    return [{"status": status, "count": count} for status, count in rows]


def count_pending_owners(db: Session):
    return db.query(func.count(User.id)).filter(
        User.role == "THEATRE_OWNER",
        User.approval_status == "PENDING",
    ).scalar() or 0


def list_pending_owners(db: Session, limit: int = 10):
    return db.query(User).filter(
        User.role == "THEATRE_OWNER",
        User.approval_status == "PENDING",
    ).order_by(User.id.desc()).limit(limit).all()


def list_users(db: Session, q: str | None, role: str | None, approval_status: str | None, page: int, page_size: int):
    query = db.query(User)
    if q:
        term = f"%{q.strip()}%"
        query = query.filter(or_(User.name.ilike(term), User.email.ilike(term)))
    if role:
        query = query.filter(User.role == role)
    if approval_status:
        query = query.filter(User.approval_status == approval_status)

    total = query.with_entities(func.count(User.id)).scalar() or 0
    items = query.order_by(User.id.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return items, total


def list_theatres(db: Session, q: str | None, status: str | None, page: int, page_size: int):
    screen_counts = db.query(
        Screen.theatre_id.label("theatre_id"),
        func.count(Screen.screen_id).label("screen_count"),
    ).group_by(Screen.theatre_id).subquery()

    query = db.query(
        Theatre,
        User.name.label("owner_name"),
        User.email.label("owner_email"),
        func.coalesce(screen_counts.c.screen_count, 0).label("screen_count"),
    ).join(User, Theatre.owner_id == User.id).outerjoin(
        screen_counts, Theatre.theatre_id == screen_counts.c.theatre_id
    )

    if q:
        term = f"%{q.strip()}%"
        query = query.filter(or_(Theatre.name.ilike(term), Theatre.city.ilike(term), User.name.ilike(term), User.email.ilike(term)))
    if status:
        query = query.filter(Theatre.status == status)

    total = query.with_entities(func.count(Theatre.theatre_id)).scalar() or 0
    rows = query.order_by(Theatre.created_at.desc(), Theatre.theatre_id.desc()).offset((page - 1) * page_size).limit(page_size).all()

    items = []
    for theatre, owner_name, owner_email, screen_count in rows:
        items.append({
            "theatre_id": theatre.theatre_id,
            "owner_id": theatre.owner_id,
            "owner_name": owner_name,
            "owner_email": owner_email,
            "name": theatre.name,
            "address": theatre.address,
            "city": theatre.city,
            "state": theatre.state,
            "contact_number": theatre.contact_number,
            "status": theatre.status,
            "screen_count": int(screen_count or 0),
            "created_at": theatre.created_at,
        })
    return items, total


def list_movies(db: Session, q: str | None, page: int, page_size: int):
    query = db.query(Movie)
    if q:
        term = f"%{q.strip()}%"
        query = query.filter(or_(Movie.movie_name.ilike(term), Movie.language.ilike(term), Movie.genre.ilike(term)))
    total = query.with_entities(func.count(Movie.movie_id)).scalar() or 0
    items = query.order_by(Movie.created_at.desc(), Movie.movie_id.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return items, total


def list_shows(db: Session, q: str | None, status: str | None, page: int, page_size: int):
    query = db.query(
        Show.show_id,
        Show.movie_id,
        Show.screen_id,
        Show.show_date,
        Show.start_time,
        Show.end_time,
        Show.status,
        Show.created_at,
        Movie.movie_name,
        Screen.screen_name,
        Theatre.theatre_id,
        Theatre.name.label("theatre_name"),
        User.name.label("owner_name"),
    ).join(Screen, Show.screen_id == Screen.screen_id).join(
        Theatre, Screen.theatre_id == Theatre.theatre_id
    ).join(Movie, Show.movie_id == Movie.movie_id).join(User, Theatre.owner_id == User.id)

    if q:
        term = f"%{q.strip()}%"
        query = query.filter(or_(Movie.movie_name.ilike(term), Theatre.name.ilike(term), Screen.screen_name.ilike(term), User.name.ilike(term)))
    if status:
        query = query.filter(Show.status == status)

    total = query.with_entities(func.count(Show.show_id)).scalar() or 0
    rows = query.order_by(Show.show_date.desc(), Show.start_time.desc(), Show.show_id.desc()).offset((page - 1) * page_size).limit(page_size).all()

    items = []
    for row in rows:
        items.append({
            "show_id": row.show_id,
            "movie_id": row.movie_id,
            "screen_id": row.screen_id,
            "theatre_id": row.theatre_id,
            "movie_name": row.movie_name,
            "theatre_name": row.theatre_name,
            "screen_name": row.screen_name,
            "owner_name": row.owner_name,
            "show_date": row.show_date,
            "start_time": row.start_time,
            "end_time": row.end_time,
            "status": row.status,
            "created_at": row.created_at,
        })
    return items, total
