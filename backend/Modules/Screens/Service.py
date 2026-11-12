from sqlalchemy.orm import Session

from fastapi import HTTPException, status

from Modules.Auth import Service as AuthService
from Modules.Screens import Repository


# Verify the theatre belongs to this owner (or ADMIN)
def _authorize_theatre(db: Session, theatre, user):

    if theatre is None:

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Theatre not found"
        )

    if user.role == "ADMIN":

        return theatre

    if theatre.owner_id != user.id:

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This theatre does not belong to you"
        )

    if user.role == "THEATRE_OWNER" and user.approval_status != "APPROVED":

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your Theatre Owner account is pending Admin approval"
        )

    return theatre


def _screen_to_response(screen, categories, seats, seat_count):

    return {
        "screen_id": screen.screen_id,
        "theatre_id": screen.theatre_id,
        "screen_name": screen.screen_name,
        "screen_number": screen.screen_number,
        "no_of_rows": screen.no_of_rows,
        "no_of_columns": screen.no_of_columns,
        "has_categories": screen.has_categories,
        "default_price": float(screen.default_price) if screen.default_price is not None else None,
        "status": screen.status,
        "layout_config": screen.layout_config,
        "seat_count": seat_count,
        "categories": categories,
        "seats": seats,
    }


# Build the list of seats for response
def _seat_briefs(db: Session, screen_id: int):

    from Modules.Theatres.Model import Seat as SeatModel, SeatCategory

    rows = db.query(SeatModel, SeatCategory).outerjoin(
        SeatCategory,
        SeatModel.category_id == SeatCategory.category_id
    ).filter(
        SeatModel.screen_id == screen_id
    ).order_by(
        SeatModel.row_number.asc(),
        SeatModel.column_number.asc()
    ).all()

    result = []

    for seat, category in rows:

        result.append(
            {
                "seat_id": seat.seat_id,
                "seat_name": seat.seat_name,
                "row_number": seat.row_number,
                "column_number": seat.column_number,
                "category_id": seat.category_id,
                "category_name": category.category_name if category else None,
                "price": float(category.price) if category else None,
                "is_active": seat.is_active,
            }
        )

    return result


# Create a screen with categories and seats (transaction)
def create_screen(db: Session, theatre_id: int, payload, token: str):

    user = AuthService.get_current_owner(db, token)

    theatre = Repository.get_theatre_by_id(db, theatre_id)

    _authorize_theatre(db, theatre, user)

    # Validate rows/cols match the seat payload
    seats = payload.seats

    created_seats = []

    try:

        screen = Repository.create_screen(
            db,
            theatre_id=theatre.theatre_id,
            payload={
                "screen_name": payload.screen_name,
                "screen_number": payload.screen_number,
                "no_of_rows": payload.no_of_rows,
                "no_of_columns": payload.no_of_columns,
                "has_categories": payload.has_categories,
                "default_price": payload.default_price,
                "layout_config": payload.layout_config.model_dump(),
                "status": "ACTIVE",
            }
        )

        # Create categories mapped by name
        category_by_name = {}

        if payload.has_categories:

            for category in payload.categories:

                created = Repository.create_category(
                    db,
                    screen.screen_id,
                    {
                        "category_name": category.category_name,
                        "price": category.price,
                        "color": category.color,
                    }
                )

                category_by_name[category.category_name] = created.category_id

        else:

            # Single default category ("Standard") with default_price
            created = Repository.create_category(
                db,
                screen.screen_id,
                {
                    "category_name": "Standard",
                    "price": float(payload.default_price or 100),
                    "color": "#3b82f6",
                }
            )

            category_by_name["Standard"] = created.category_id

        # Map seats to categories
        for seat in seats:

            category_id = None

            if seat.category and seat.category in category_by_name:

                category_id = category_by_name[seat.category]

            elif not payload.has_categories:

                category_id = category_by_name["Standard"]

            else:

                # Default to first category if unmatched
                category_id = next(iter(category_by_name.values()), None)

            new_seat = Repository.create_seat(
                db,
                screen_id=screen.screen_id,
                category_id=category_id,
                seat_name=seat.seat_name,
                row_number=seat.row_number,
                column_number=seat.column_number,
                is_active=seat.is_active
            )

            created_seats.append(new_seat)

        db.commit()

    except Exception:

        db.rollback()

        raise

    categories = Repository.list_categories(db, screen.screen_id)

    seat_briefs = _seat_briefs(db, screen.screen_id)

    seat_count = len([s for s in seat_briefs if s["is_active"]])

    return _screen_to_response(
        screen,
        categories,
        seat_briefs,
        seat_count
    )


# List screens
def list_screens(db: Session, theatre_id: int, token: str):

    user = AuthService.get_current_owner(db, token)

    theatre = Repository.get_theatre_by_id(db, theatre_id)

    _authorize_theatre(db, theatre, user)

    screens = Repository.list_screens_for_theatre(db, theatre_id)

    result = []

    for screen in screens:

        categories = Repository.list_categories(db, screen.screen_id)

        seats = Repository.list_seats(db, screen.screen_id)

        seat_count = len([s for s in seats if s.is_active])

        result.append(
            {
                "screen_id": screen.screen_id,
                "screen_name": screen.screen_name,
                "screen_number": screen.screen_number,
                "no_of_rows": screen.no_of_rows,
                "no_of_columns": screen.no_of_columns,
                "has_categories": screen.has_categories,
                "default_price": float(screen.default_price) if screen.default_price is not None else None,
                "status": screen.status,
                "seat_count": seat_count,
                "categories": categories,
            }
        )

    return result


# Screen details
def get_screen(db: Session, screen_id: int, token: str):

    user = AuthService.get_current_owner(db, token)

    screen = Repository.get_screen_by_id(db, screen_id)

    if not screen:

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Screen not found"
        )

    _authorize_theatre(
        db,
        Repository.get_theatre_by_id(db, screen.theatre_id),
        user
    )

    categories = Repository.list_categories(db, screen_id)

    seats = Repository.list_seats(db, screen_id)

    # Enrich seats with category details
    cat_by_id = {
        c["category_id"]: c for c in categories
    }

    seat_briefs = []

    for seat in seats:

        cat = cat_by_id.get(seat.category_id) if seat.category_id else None

        seat_briefs.append(
            {
                "seat_id": seat.seat_id,
                "seat_name": seat.seat_name,
                "row_number": seat.row_number,
                "column_number": seat.column_number,
                "category_id": seat.category_id,
                "category_name": cat["category_name"] if cat else None,
                "price": cat["price"] if cat else None,
                "is_active": seat.is_active,
            }
        )

    return _screen_to_response(
        screen,
        categories,
        seat_briefs,
        len([s for s in seat_briefs if s["is_active"]])
    )


# Delete screen
def delete_screen(db: Session, screen_id: int, token: str):

    user = AuthService.get_current_owner(db, token)

    screen = Repository.get_screen_by_id(db, screen_id)

    if not screen:

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Screen not found"
        )

    _authorize_theatre(
        db,
        Repository.get_theatre_by_id(db, screen.theatre_id),
        user
    )

    Repository.delete_screen(db, screen)

    db.commit()

    return {"message": "Screen deleted successfully"}
