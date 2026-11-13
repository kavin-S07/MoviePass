from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from Modules.Admin import Service
from Modules.Admin.Schema import (
    AdminMoviesResponse,
    AdminOverview,
    AdminShowsResponse,
    AdminTheatresResponse,
    AdminUsersResponse,
)
from Modules.Auth.Dependencies import get_token
from config.database import get_db


router = APIRouter(prefix="/admin", tags=["Admin"])


@router.get("/overview", response_model=AdminOverview, status_code=status.HTTP_200_OK)
def overview(
    db: Session = Depends(get_db),
    token: str = Depends(get_token),
):
    return Service.get_overview(db, token)


@router.get("/users", response_model=AdminUsersResponse, status_code=status.HTTP_200_OK)
def users(
    q: str | None = Query(default=None),
    role: str | None = Query(default=None),
    approval_status: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=50),
    db: Session = Depends(get_db),
    token: str = Depends(get_token),
):
    return Service.list_users(db, token, q=q, role=role, approval_status=approval_status, page=page, page_size=page_size)


@router.get("/theatres", response_model=AdminTheatresResponse, status_code=status.HTTP_200_OK)
def theatres(
    q: str | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=50),
    db: Session = Depends(get_db),
    token: str = Depends(get_token),
):
    return Service.list_theatres(db, token, q=q, status=status_filter, page=page, page_size=page_size)


@router.get("/movies", response_model=AdminMoviesResponse, status_code=status.HTTP_200_OK)
def movies(
    q: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=50),
    db: Session = Depends(get_db),
    token: str = Depends(get_token),
):
    return Service.list_movies(db, token, q=q, page=page, page_size=page_size)


@router.get("/shows", response_model=AdminShowsResponse, status_code=status.HTTP_200_OK)
def shows(
    q: str | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=50),
    db: Session = Depends(get_db),
    token: str = Depends(get_token),
):
    return Service.list_shows(db, token, q=q, status=status_filter, page=page, page_size=page_size)
