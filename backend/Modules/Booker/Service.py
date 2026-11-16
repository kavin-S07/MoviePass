from datetime import date, datetime, timedelta
import math

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
    rel_status = _release_status(movie.release_date)
    booking_available = upcoming > 0 and rel_status != "coming_soon"
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
        "release_status": rel_status,
        "booking_available": booking_available,
        "upcoming_show_count": upcoming,
        "total_show_count": total,
    }


def _paginate(items, page: int, page_size: int):
    total = len(items)
    start = (page - 1) * page_size
    end = start + page_size
    return items[start:end], total


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
    # Booker-facing read APIs: require authenticated user. Read-only access; does not alter owner/admin write APIs.
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
    if sort_by == "trending":
        items = sorted(items, key=lambda x: (x.get("upcoming_show_count", 0), x.get("total_show_count", 0)), reverse=True)
    elif sort_by == "recommended":
        items = sorted(items, key=lambda x: (x.get("upcoming_show_count", 0), x.get("release_date") or date.min), reverse=True)

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


def _parse_date_param(show_date: str | None):
    if not show_date:
        return None
    try:
        return date.fromisoformat(show_date)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid show_date format. Use YYYY-MM-DD")


def _show_bookability(row, now_dt: datetime):
    show_dt = datetime.combine(row.show_date, row.start_time)
    if show_dt <= now_dt:
        return False, "past"
    if str(row.status).lower() == "cancelled":
        return False, "cancelled"
    if str(row.status).lower() != "scheduled":
        return False, "unavailable"
    if str(getattr(row, "theatre_status", "")).upper() != "ACTIVE" or str(getattr(row, "screen_status", "")).upper() != "ACTIVE":
        return False, "unavailable"
    return True, "available"


def _serialize_show_row(row, now_dt: datetime):
    is_bookable, label = _show_bookability(row, now_dt)
    return {
        "show_id": row.show_id,
        "movie_id": row.movie_id,
        "screen_id": row.screen_id,
        "theatre_id": row.theatre_id,
        "theatre_name": row.theatre_name,
        "theatre_city": row.theatre_city,
        "theatre_address": getattr(row, "theatre_address", None),
        "theatre_status": getattr(row, "theatre_status", None),
        "screen_name": row.screen_name,
        "show_date": row.show_date,
        "start_time": row.start_time,
        "end_time": row.end_time,
        "status": row.status,
        "is_bookable": is_bookable,
        "availability_label": label,
    }


def get_movie_shows(db: Session, token: str, movie_id: int, city: str | None = None, show_date: str | None = None, theatre_id: int | None = None):
    get_authenticated_booker(db, token)
    row = Repository.get_movie_detail(db, movie_id)
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Movie not found")

    parsed_date = _parse_date_param(show_date)
    if parsed_date and parsed_date < date.today():
        return []

    rows = Repository.list_movie_showtimes(db, movie_id, city=city, show_date=parsed_date, theatre_id=theatre_id, include_cancelled=True)
    now_dt = datetime.now()
    serialized = [_serialize_show_row(r, now_dt) for r in rows]
    # Exclude cancelled/unavailable from "valid bookable" listing context? keep visible with indicators but not bookable.
    return serialized


def _haversine_km(lat1, lon1, lat2, lon2):
    try:
        lat1, lon1, lat2, lon2 = map(float, [lat1, lon1, lat2, lon2])
    except (TypeError, ValueError):
        return None
    r = 6371.0
    p1 = math.radians(lat1)
    p2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return round(r * c, 2)


def _build_available_dates(db: Session, movie_id: int, city: str | None, selected_date: date | None):
    today = date.today()
    tomorrow = today + timedelta(days=1)
    rows = Repository.list_movie_available_dates(db, movie_id, city=city, days_ahead=14)
    available_map = {r["date"]: r["show_count"] for r in rows}

    dates = []
    seen = set()
    # Always include today/tomorrow for selector UX (disabled when no shows)
    base_dates = [today, tomorrow] + [r["date"] for r in rows]
    if selected_date and selected_date >= today:
        base_dates.append(selected_date)
    for d in sorted(set(base_dates)):
        if d < today:
            continue
        if d in seen:
            continue
        seen.add(d)
        count = available_map.get(d, 0)
        label = d.strftime("%a, %d %b")
        if d == today:
            label = f"Today, {d.strftime('%d %b')}"
        elif d == tomorrow:
            label = f"Tomorrow, {d.strftime('%d %b')}"
        dates.append({
            "date": d,
            "label": label,
            "is_today": d == today,
            "is_tomorrow": d == tomorrow,
            "show_count": count,
            "is_selectable": count > 0,
        })
    # Keep selector compact
    return dates[:14]


def get_movie_show_discovery(
    db: Session,
    token: str,
    movie_id: int,
    city: str | None = None,
    show_date: str | None = None,
    theatre_id: int | None = None,
    theatre_search: str | None = None,
    sort_by: str | None = None,
    lat: float | None = None,
    lng: float | None = None,
):
    get_authenticated_booker(db, token)
    movie_row = Repository.get_movie_detail(db, movie_id)
    if not movie_row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Movie not found")

    parsed_date = _parse_date_param(show_date)
    if parsed_date and parsed_date < date.today():
        parsed_date = None

    available_dates = _build_available_dates(db, movie_id, city, parsed_date)
    selectable_dates = [d["date"] for d in available_dates if d.get("is_selectable")]

    # Default selected date: requested if valid/selectable, else first selectable
    selected_date = None
    if parsed_date and parsed_date in selectable_dates:
        selected_date = parsed_date
    elif selectable_dates:
        selected_date = selectable_dates[0]

    theatres = []
    total_shows = 0
    if selected_date:
        rows = Repository.list_movie_showtimes(db, movie_id, city=city, show_date=selected_date, theatre_id=theatre_id, include_cancelled=True)
        now_dt = datetime.now()
        grouped = {}
        for r in rows:
            serialized = _serialize_show_row(r, now_dt)
            # Only include theatres that have matching active/scheduled-or-visible shows for selected date context;
            # we include cancelled/unavailable rows for indicators but theatre must have at least one show record returned.
            tid = r.theatre_id
            if tid not in grouped:
                t_lat = float(r.theatre_latitude) if getattr(r, "theatre_latitude", None) is not None else None
                t_lng = float(r.theatre_longitude) if getattr(r, "theatre_longitude", None) is not None else None
                distance_km = _haversine_km(lat, lng, t_lat, t_lng) if (lat is not None and lng is not None) else None
                grouped[tid] = {
                    "theatre_id": tid,
                    "theatre_name": r.theatre_name,
                    "address": r.theatre_address or "",
                    "city": r.theatre_city,
                    "state": getattr(r, "theatre_state", None),
                    "pincode": getattr(r, "theatre_pincode", None),
                    "theatre_status": getattr(r, "theatre_status", "ACTIVE"),
                    "latitude": t_lat,
                    "longitude": t_lng,
                    "distance_km": distance_km,
                    "screens": set(),
                    "shows": [],
                    "active_show_count": 0,
                }
            g = grouped[tid]
            if r.screen_name:
                g["screens"].add(r.screen_name)
            g["shows"].append(serialized)
            if serialized["is_bookable"]:
                g["active_show_count"] += 1
            total_shows += 1

        for g in grouped.values():
            g["screens"] = sorted(g["screens"])
            # sort shows by start time
            g["shows"] = sorted(g["shows"], key=lambda x: (str(x["start_time"]), x["show_id"]))

        theatres = list(grouped.values())
        # Requirement: do not display theatres that have no matching active shows for selected date.
        theatres = [t for t in theatres if t["active_show_count"] > 0]

        if theatre_search and theatre_search.strip():
            q = theatre_search.strip().lower()
            theatres = [t for t in theatres if q in (t["theatre_name"] or "").lower() or q in (t["address"] or "").lower() or q in (t.get("city") or "").lower()]

        # Sorting
        if sort_by == "distance" and lat is not None and lng is not None:
            theatres = sorted(theatres, key=lambda t: (t["distance_km"] is None, t["distance_km"] if t["distance_km"] is not None else 1e9, t["theatre_name"].lower()))
        elif sort_by == "name_desc":
            theatres = sorted(theatres, key=lambda t: t["theatre_name"].lower(), reverse=True)
        elif sort_by == "shows_desc":
            theatres = sorted(theatres, key=lambda t: (-t["active_show_count"], t["theatre_name"].lower()))
        else:  # name_asc default
            theatres = sorted(theatres, key=lambda t: t["theatre_name"].lower())

    return {
        "movie": _serialize_movie(movie_row),
        "selected_city": city or None,
        "selected_date": selected_date,
        "selected_theatre_id": theatre_id,
        "available_dates": available_dates,
        "theatres": theatres,
        "total_theatres": len(theatres),
        "total_shows": sum(t["active_show_count"] for t in theatres),
    }


def get_filters(db: Session, token: str):
    get_authenticated_booker(db, token)
    filters = Repository.list_distinct_values(db)
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

    trending = sorted(
        [m for m in items if m.get("total_show_count", 0) > 0 or m.get("upcoming_show_count", 0) > 0],
        key=lambda x: (x.get("upcoming_show_count", 0), x.get("total_show_count", 0), x.get("release_date") or date.min),
        reverse=True,
    )

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

    trending = _unique_by_movie_id(trending)
    now_showing = sorted(now_showing, key=lambda x: (1 if x.get("booking_available") else 0, x.get("upcoming_show_count", 0), x.get("release_date") or date.min), reverse=True)
    coming_soon = sorted(coming_soon, key=lambda x: (x.get("release_date") or date.max, x.get("movie_name") or ""))

    return {
        "featured_movie": featured,
        "now_showing": now_showing[:12],
        "coming_soon": coming_soon[:12],
        "trending": trending[:12],
        "recommended": recommended[:12],
        "filters": filters,
    }
