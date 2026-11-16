from datetime import date

from sqlalchemy import case, distinct, func, or_
from sqlalchemy.orm import Session

from Modules.Theatres.Model import Movie, Screen, Show, Theatre


def _base_movie_query(db: Session):
    today = date.today()
    upcoming_show_count = func.count(
        distinct(
            case(
                (
                    (Show.show_date >= today) & (Show.status == "Scheduled"),
                    Show.show_id,
                ),
                else_=None,
            )
        )
    )
    total_show_count = func.count(distinct(Show.show_id))

    return (
        db.query(
            Movie,
            upcoming_show_count.label("upcoming_show_count"),
            total_show_count.label("total_show_count"),
        )
        .outerjoin(Show, Show.movie_id == Movie.movie_id)
        .group_by(Movie.movie_id)
    )


def _apply_movie_filters(query, search=None, language=None, genre=None, certification=None, release_status=None, city=None):
    today = date.today()

    if search:
        like = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Movie.movie_name.ilike(like),
                Movie.description.ilike(like),
                Movie.director_name.ilike(like),
                Movie.cast_names.ilike(like),
            )
        )

    if language and language.strip():
        query = query.filter(func.lower(Movie.language) == language.strip().lower())

    if genre and genre.strip():
        # genre stored as text; allow partial/case-insensitive match for CSV genres
        query = query.filter(Movie.genre.ilike(f"%{genre.strip()}%"))

    if certification and certification.strip():
        query = query.filter(func.lower(Movie.certification) == certification.strip().lower())

    if release_status == "now_showing":
        query = query.filter(Movie.release_date.isnot(None), Movie.release_date <= today)
    elif release_status == "coming_soon":
        query = query.filter(or_(Movie.release_date.is_(None), Movie.release_date > today))

    if city and city.strip():
        # Restrict to movies that have scheduled shows in active theatres in the selected city
        city_show_exists = (
            db.query(Show.show_id)
            .join(Screen, Show.screen_id == Screen.screen_id)
            .join(Theatre, Screen.theatre_id == Theatre.theatre_id)
            .filter(
                Show.movie_id == Movie.movie_id,
                Show.status == "Scheduled",
                func.lower(Theatre.city) == city.strip().lower(),
                Theatre.status == "ACTIVE",
            )
            .exists()
        )
        query = query.filter(city_show_exists)

    return query


def _apply_sort(query, sort_by: str | None):
    # SQLAlchemy labeled aggregate columns from _base_movie_query
    # upcoming_show_count and total_show_count are accessible via labels in query entities,
    # but easier to order by expressions known here where possible.
    if sort_by == "name_asc":
        return query.order_by(Movie.movie_name.asc(), Movie.movie_id.desc())
    if sort_by == "name_desc":
        return query.order_by(Movie.movie_name.desc(), Movie.movie_id.desc())
    if sort_by == "release_date_asc":
        return query.order_by(Movie.release_date.asc().nullslast(), Movie.movie_id.desc())
    if sort_by == "release_date_desc":
        return query.order_by(Movie.release_date.desc().nullslast(), Movie.movie_id.desc())
    if sort_by == "duration_asc":
        return query.order_by(Movie.duration_minutes.asc().nullslast(), Movie.movie_id.desc())
    if sort_by == "duration_desc":
        return query.order_by(Movie.duration_minutes.desc().nullslast(), Movie.movie_id.desc())
    if sort_by == "trending":
        # handled in service via computed ordering fallback if needed; default here by release desc
        return query.order_by(Movie.release_date.desc().nullslast(), Movie.movie_id.desc())
    # default/recommended fallback
    return query.order_by(Movie.release_date.desc().nullslast(), Movie.created_at.desc(), Movie.movie_id.desc())


def list_movies(db: Session, search=None, language=None, genre=None, certification=None, release_status=None, city=None, sort_by=None):
    query = _base_movie_query(db)
    query = _apply_movie_filters(query, search=search, language=language, genre=genre, certification=certification, release_status=release_status, city=city)
    query = _apply_sort(query, sort_by)
    return query.all()


def get_movie_detail(db: Session, movie_id: int):
    query = _base_movie_query(db).filter(Movie.movie_id == movie_id)
    return query.first()


def list_movie_shows(db: Session, movie_id: int, city: str | None = None, show_date: date | None = None):
    query = (
        db.query(
            Show.show_id,
            Show.movie_id,
            Show.screen_id,
            Show.show_date,
            Show.start_time,
            Show.end_time,
            Show.status,
            Theatre.theatre_id,
            Theatre.name.label("theatre_name"),
            Theatre.city.label("theatre_city"),
            Screen.screen_name,
        )
        .join(Screen, Show.screen_id == Screen.screen_id)
        .join(Theatre, Screen.theatre_id == Theatre.theatre_id)
        .filter(Show.movie_id == movie_id)
    )
    if city and city.strip():
        query = query.filter(func.lower(Theatre.city) == city.strip().lower())
    if show_date:
        query = query.filter(Show.show_date == show_date)
    return query.order_by(Show.show_date.asc(), Show.start_time.asc(), Theatre.name.asc()).all()


def list_distinct_values(db: Session):
    languages = [r[0] for r in db.query(distinct(Movie.language)).filter(Movie.language.isnot(None), Movie.language != "").order_by(Movie.language.asc()).all()]
    # genres/certifications may contain comma-separated or simple values; return raw distinct DB values for now
    genres = [r[0] for r in db.query(distinct(Movie.genre)).filter(Movie.genre.isnot(None), Movie.genre != "").order_by(Movie.genre.asc()).all()]
    certifications = [r[0] for r in db.query(distinct(Movie.certification)).filter(Movie.certification.isnot(None), Movie.certification != "").order_by(Movie.certification.asc()).all()]
    cities = [r[0] for r in db.query(distinct(Theatre.city)).filter(Theatre.city.isnot(None), Theatre.city != "", Theatre.status == "ACTIVE").order_by(Theatre.city.asc()).all()]
    return {
        "languages": languages,
        "genres": genres,
        "certifications": certifications,
        "cities": cities,
    }
