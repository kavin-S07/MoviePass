from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from typing import List

from config.database import get_db
from Modules.Screens import Service
from Modules.Auth.Dependencies import get_token

from Modules.Screens.Schema import (
    ScreenCreate,
    ScreenResponse,
    ScreenBrief,
)


router = APIRouter(
    tags=["Screens & Seats"]
)


# Create a screen with seats
@router.post(
    "/theatres/{theatre_id}/screens",
    response_model=ScreenResponse,
    status_code=status.HTTP_201_CREATED
)
def create_screen(
    theatre_id: int,
    payload: ScreenCreate,
    db: Session = Depends(get_db),
    token: str = Depends(get_token)
):

    return Service.create_screen(
        db,
        theatre_id,
        payload,
        token
    )


# List screens for a theatre
@router.get(
    "/theatres/{theatre_id}/screens",
    response_model=List[ScreenBrief],
    status_code=status.HTTP_200_OK
)
def list_screens(
    theatre_id: int,
    db: Session = Depends(get_db),
    token: str = Depends(get_token)
):

    return Service.list_screens(
        db,
        theatre_id,
        token
    )


# Screen details
@router.get(
    "/screens/{screen_id}",
    response_model=ScreenResponse,
    status_code=status.HTTP_200_OK
)
def get_screen(
    screen_id: int,
    db: Session = Depends(get_db),
    token: str = Depends(get_token)
):

    return Service.get_screen(
        db,
        screen_id,
        token
    )


# Delete screen
@router.delete(
    "/screens/{screen_id}",
    status_code=status.HTTP_200_OK
)
def delete_screen(
    screen_id: int,
    db: Session = Depends(get_db),
    token: str = Depends(get_token)
):

    return Service.delete_screen(
        db,
        screen_id,
        token
    )
