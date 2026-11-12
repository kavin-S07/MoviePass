from fastapi import APIRouter, Depends, Request, Response, status
from sqlalchemy.orm import Session

from Modules.Auth import Service
from Modules.Auth.Dependencies import get_token
from Modules.Auth.Schema import (
    AuthResponse,
    HomeResponse,
    UserLogin,
    UserSignup,
)
from config.database import get_db


router = APIRouter(
    prefix="/auth",
    tags=["Authentication"]
)


# Signup API (Ticket Booker)
@router.post(
    "/signup",
    response_model=AuthResponse,
    status_code=status.HTTP_201_CREATED
)
def signup(
    user_data: UserSignup,
    request: Request,
    response: Response,
    db: Session = Depends(get_db)
):

    return Service.signup_user(
        db,
        user_data,
        request,
        response
    )


# Signup API (Theatre Owner - needs Admin approval)
@router.post(
    "/signup/owner",
    response_model=AuthResponse,
    status_code=status.HTTP_201_CREATED
)
def signup_owner(
    user_data: UserSignup,
    request: Request,
    response: Response,
    db: Session = Depends(get_db)
):

    return Service.signup_owner(
        db,
        user_data,
        request,
        response
    )


# Login API
@router.post(
    "/login",
    response_model=AuthResponse,
    status_code=status.HTTP_200_OK
)
def login(
    login_data: UserLogin,
    request: Request,
    response: Response,
    db: Session = Depends(get_db)
):

    return Service.login_user(
        db,
        login_data,
        request,
        response
    )


# Home API (requires token)
@router.get(
    "/home",
    response_model=HomeResponse,
    status_code=status.HTTP_200_OK
)
def home(
    db: Session = Depends(get_db),
    token: str = Depends(get_token)
):

    return Service.get_home(db, token)
