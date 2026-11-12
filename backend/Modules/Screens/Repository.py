from sqlalchemy.orm import Session
from sqlalchemy import func

from Modules.Theatres.Model import Theatre, Screen, SeatCategory, Seat


# Find theatre by id
def get_theatre_by_id(db: Session, theatre_id: int):

    return db.query(Theatre).filter(
        Theatre.theatre_id == theatre_id
    ).first()


# List screens for a theatre
def list_screens_for_theatre(db: Session, theatre_id: int):

    return db.query(Screen).filter(
        Screen.theatre_id == theatre_id
    ).order_by(
        Screen.screen_number.asc().nullslast(),
        Screen.screen_name.asc()
    ).all()


# Get screen by id
def get_screen_by_id(db: Session, screen_id: int):

    return db.query(Screen).filter(
        Screen.screen_id == screen_id
    ).first()


# Create screen
def create_screen(db: Session, theatre_id: int, payload: dict):

    screen = Screen(
        theatre_id=theatre_id,
        **payload
    )

    db.add(screen)

    db.flush()

    return screen


# Create category
def create_category(db: Session, screen_id: int, payload: dict):

    category = SeatCategory(
        screen_id=screen_id,
        **payload
    )

    db.add(category)

    db.flush()

    return category


# Create seat
def create_seat(db: Session, screen_id: int, category_id, seat_name: str, row_number: int, column_number: int, is_active: bool):

    seat = Seat(
        screen_id=screen_id,
        category_id=category_id,
        seat_name=seat_name,
        row_number=row_number,
        column_number=column_number,
        is_active=is_active
    )

    db.add(seat)

    db.flush()

    return seat


# Delete screen (cascades)
def delete_screen(db: Session, screen: Screen):

    db.delete(screen)

    db.flush()


# List categories with seat counts
def list_categories(db: Session, screen_id: int):

    rows = db.query(
        SeatCategory,
        func.count(Seat.seat_id)
    ).outerjoin(
        Seat,
        (Seat.category_id == SeatCategory.category_id)
        & (Seat.is_active.is_(True))
    ).filter(
        SeatCategory.screen_id == screen_id
    ).group_by(
        SeatCategory.category_id
    ).order_by(
        SeatCategory.price.asc()
    ).all()

    return [
        {
            "category_id": category.category_id,
            "category_name": category.category_name,
            "price": float(category.price),
            "color": category.color,
            "seat_count": count,
        }
        for category, count in rows
    ]


# List seats
def list_seats(db: Session, screen_id: int):

    return db.query(Seat).filter(
        Seat.screen_id == screen_id
    ).order_by(
        Seat.row_number.asc(),
        Seat.column_number.asc()
    ).all()
