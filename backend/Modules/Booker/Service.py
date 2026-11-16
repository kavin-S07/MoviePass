from datetime import date

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from Modules.Auth import Service as AuthService
from Modules.Booker import Repository


def _release_status(release_date):
    today = date.today()
    if release_date and release_date > today:
        return "coming_soon"
    return "now_showing" if release_date else "released"


def _serialize_movie(row):
    movie, upcoming_show_count, total_show_count = row
    upcoming = int(upcoming_show_count or 0)
    total = int(total_show_count or 0)
    status = _release_status(movie.release_date)
    booking_available = upcoming > 0 and status != "coming_soon"
    return {
        "movie_id": movie.movie_id,
        "movie_name": movie.movie_name,
        "poster_url": movie.poster_url,
        "release_date": movie.release_date,
        "director_name": movie.director_name,
        "description": movie.description,
        "duration_minutes": movie.duration_minutes,
        "language": movie.language,
        "genre": movie.genre,
        "certification": movie.certification,
        "cast_names": movie.cast_names,
        "created_at": movie.created_at,
        "updated_at": movie.updated_at,
        "release_status": status,
        "booking_available": booking_available,
        "upcoming_show_count": upcoming,
        "total_show_count": total,
    }


def _paginate(items, page: int, page_size: int):
    total = len(items)
    start = (page - 1) * page_size
    end = start + page_size
    return items[start:end], total


def _sort_items(items, sort_by: str | None):
    if sort_by == "trending":
        return sorted(items, key=lambda x: (x.get("upcoming_show_count", 0), x.get("total_show_count", 0)), reverse=True)
    if sort_by == "recommended":
        return sorted(items, key=lambda x: (x.get("upcoming_show_count", 0), x.get("release_date") or date.min), reverse=True)
    # repository handled most sorts; keep stable fallback
    return items


def _unique_by_movie_id(items):
    seen = set()
    out = []
    for item in items:
        mid = item.get("movie_id")
        if mid in seen:
            continue
        seen.add(mid)
        out.append(item)
    return out


def get_authenticated_booker(db: Session, token: str):
    # Booker-facing read APIs: require authenticated user. Ticket bookers are primary consumers;
    # allow other authenticated roles to access read-only discovery safely without affecting write APIs.
    return AuthService.get_authenticated_user(db, token)


def list_movies(db: Session, token: str, search=None, language=None, genre=None, certification=None, release_status=None, city=None, sort_by=None, page=1, page_size=12):
    get_authenticated_booker(db, token)

    page = max(1, int(page or 1))
    page_size = min(50, max(1, int(page_size or 12)))

    rows = Repository.list_movies(
        db,
        search=search,
        language=language,
        genre=genre,
        certification=certification,
        release_status=release_status,
        city=city,
        sort_by=sort_by,
    )
    items = [_serialize_movie(r) for r in rows]
    if sort_by in ("trending", "recommended"):
        items = _sort_items(items, sort_by)

    paged, total = _paginate(items, page, page_size)
    return {
        "items": paged,
        "total": total,
        "page": page,
        "page_size": page_size,
        "has_more": (page * page_size) < total,
    }


def get_movie(db: Session, token: str, movie_id: int):
    get_authenticated_booker(db, token)
    row = Repository.get_movie_detail(db, movie_id)
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Movie not found")
    return _serialize_movie(row)


def get_movie_shows(db: Session, token: str, movie_id: int, city: str | None = None, show_date: str | None = None):
    get_authenticated_booker(db, token)
    # ensure movie exists
    row = Repository.get_movie_detail(db, movie_id)
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Movie not found")

    parsed_date = None
    if show_date:
        try:
            parsed_date = date.fromisoformat(show_date)
        except ValueError:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid show_date format. Use YYYY-MM-DD")

    rows = Repository.list_movie_shows(db, movie_id, city=city, show_date=parsed_date)
    return [
        {
            "show_id": r.show_id,
            "movie_id": r.movie_id,
            "screen_id": r.screen_id,
            "theatre_id": r.theatre_id,
            "theatre_name": r.theatre_name,
            "theatre_city": r.theatre_city,
            "screen_name": r.screen_name,
            "show_date": r.show_date,
            "start_time": r.start_time,
            "end_time": r.end_time,
            "status": r.status,
        }
        for r in rows
    ]


def get_filters(db: Session, token: str):
    get_authenticated_booker(db, token)
    filters = Repository.list_distinct_values(db)
    # split comma-separated genres into distinct tokens for better UX where applicable
    raw_genres = filters.get("genres", [])
    genre_set = []
    seen = set()
    for g in raw_genres:
        parts = [p.strip() for p in str(g).split(",")] if g else []
        for p in parts:
            if not p:
                continue
            key = p.lower()
            if key in seen:
                continue
            seen.add(key)
            genre_set.append(p)
    genre_set = sorted(genre_set, key=lambda x: x.lower())
    filters["genres"] = genre_set
    return filters


def get_home(db: Session, token: str, city: str | None = None):
    get_authenticated_booker(db, token)
    filters = get_filters(db, token)

    all_rows = Repository.list_movies(db, city=city)
    items = [_serialize_movie(r) for r in all_rows]

    now_showing = [m for m in items if m["release_status"] == "now_showing"]
    coming_soon = [m for m in items if m["release_status"] == "coming_soon"]

    # Trending: real data heuristic based on upcoming/total scheduled shows
    trending = sorted(
        [m for m in items if m.get("total_show_count", 0) > 0 or m.get("upcoming_show_count", 0) > 0],
        key=lambda x: (x.get("upcoming_show_count", 0), x.get("total_show_count", 0), x.get("release_date") or date.min),
        reverse=True,
    )

    # Featured: prefer bookable now-showing movie with most upcoming shows
    featured_candidates = sorted(
        [m for m in now_showing if m.get("booking_available")],
        key=lambda x: (x.get("upcoming_show_count", 0), x.get("release_date") or date.min),
        reverse=True,
    )
    if not featured_candidates:
        featured_candidates = sorted(now_showing, key=lambda x: (x.get("upcoming_show_count", 0), x.get("release_date") or date.min), reverse=True)
    if not featured_candidates and items:
        featured_candidates = sorted(items, key=lambda x: (x.get("upcoming_show_count", 0), x.get("release_date") or date.min), reverse=True)
    featured = featured_candidates[0] if featured_candidates else None

    # Recommended: only when relevant real data/strategy is available.
    # Strategy: use featured movie's language/genre to recommend other available movies from existing catalog.
    recommended = []
    if featured:
        f_lang = (featured.get("language") or "").strip().lower()
        f_genres = {g.strip().lower() for g in str(featured.get("genre") or "").split(",") if g.strip()}
        for m in items:
            if m["movie_id"] == featured["movie_id"]:
                continue
            m_lang = (m.get("language") or "").strip().lower()
            m_genres = {g.strip().lower() for g in str(m.get("genre") or "").split(",") if g.strip()}
            lang_match = bool(f_lang and m_lang and f_lang == m_lang)
            genre_match = bool(f_genres and m_genres and (f_genres & m_genres))
            if lang_match or genre_match:
                recommended.append(m)
        recommended = sorted(
            recommended,
            key=lambda x: (1 if x.get("booking_available") else 0, x.get("upcoming_show_count", 0), x.get("release_date") or date.min),
            reverse=True,
        )
        recommended = _unique_by_movie_id(recommended)

    # keep sections meaningful and non-duplicative
    trending = _unique_by_movie_id(trending)
    now_showing = sorted(now_showing, key=lambda x: (1 if x.get("booking_available") else 0, x.get("upcoming_show_count", 0), x.get("release_date") or date.min), reverse=True)
    coming_soon = sorted(coming_soon, key=lambda x: (x.get("release_date") or date.max, x.get("movie_name") or ""))

    # If recommendation strategy/data not available, return empty list as required.
    return {
        "featured_movie": featured,
        "now_showing": now_showing[:12],
        "coming_soon": coming_soon[:12],
        "trending": trending[:12],
        "recommended": recommended[:12],
        "filters": filters,
    }
