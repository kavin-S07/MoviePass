from typing import List

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from config.database import get_db
from Modules.Theatres import Service
from Modules.Auth.Dependencies import get_token

from Modules.Theatres.Schema import (
    DashboardStats,
    TheatrePayload,
    TheatreResponse,
    TheatreDetails
)


router = APIRouter(
    tags=["Dashboard & Theatres"]
)


# Dashboard stats
@router.get(
    "/dashboard/stats",
    response_model=DashboardStats,
    status_code=status.HTTP_200_OK
)
def dashboard(
    db: Session = Depends(get_db),
    token: str = Depends(get_token)
):

    return Service.get_dashboard(db, token)


# List owned theatres
@router.get(
    "/theatres",
    response_model=List[TheatreResponse],
    status_code=status.HTTP_200_OK
)
def list_theatres(
    db: Session = Depends(get_db),
    token: str = Depends(get_token)
):

    return Service.list_my_theatres(db, token)


# Theatre details
@router.get(
    "/theatres/{theatre_id}",
    response_model=TheatreDetails,
    status_code=status.HTTP_200_OK
)
def theatre_details(
    theatre_id: int,
    db: Session = Depends(get_db),
    token: str = Depends(get_token)
):

    return Service.get_theatre(db, token, theatre_id)


# Create theatre
@router.post(
    "/theatres",
    response_model=TheatreResponse,
    status_code=status.HTTP_201_CREATED
)
def create_theatre(
    payload: TheatrePayload,
    db: Session = Depends(get_db),
    token: str = Depends(get_token)
):

    return Service.create_theatre(db, token, payload)


# Update theatre
@router.put(
    "/theatres/{theatre_id}",
    response_model=TheatreResponse,
    status_code=status.HTTP_200_OK
)
def update_theatre(
    theatre_id: int,
    payload: TheatrePayload,
    db: Session = Depends(get_db),
    token: str = Depends(get_token)
):

    return Service.update_theatre(db, token, theatre_id, payload)


# Delete theatre
@router.delete(
    "/theatres/{theatre_id}",
    status_code=status.HTTP_200_OK
)
def delete_theatre(
    theatre_id: int,
    db: Session = Depends(get_db),
    token: str = Depends(get_token)
):

    return Service.delete_theatre(db, token, theatre_id)
