from typing import List

from fastapi import APIRouter, Depends, Request, Response, status
from sqlalchemy.orm import Session

from Modules.Auth import Service
from Modules.Auth.Dependencies import get_token
from Modules.Auth.Schema import (
    ApprovalActionResponse,
    AuthResponse,
    HomeResponse,
    MessageResponse,
    PendingOwnerResponse,
    RefreshResponse,
    SessionResponse,
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


# Refresh access token using HttpOnly refresh cookie
@router.post(
    "/refresh",
    response_model=RefreshResponse,
    status_code=status.HTTP_200_OK
)
def refresh(
    request: Request,
    response: Response,
    db: Session = Depends(get_db)
):

    return Service.refresh_user_session(
        db,
        request,
        response
    )


# Logout current session
@router.post(
    "/logout",
    response_model=MessageResponse,
    status_code=status.HTTP_200_OK
)
def logout(
    request: Request,
    response: Response,
    db: Session = Depends(get_db)
):

    return Service.logout_user_session(
        db,
        request,
        response
    )


# Logout all sessions for the authenticated user
@router.post(
    "/logout-all",
    response_model=MessageResponse,
    status_code=status.HTTP_200_OK
)
def logout_all(
    response: Response,
    db: Session = Depends(get_db),
    token: str = Depends(get_token)
):

    return Service.logout_all_user_sessions(
        db,
        token,
        response
    )


# List current user's active sessions
@router.get(
    "/sessions",
    response_model=List[SessionResponse],
    status_code=status.HTTP_200_OK
)
def list_sessions(
    request: Request,
    db: Session = Depends(get_db),
    token: str = Depends(get_token)
):

    return Service.list_user_sessions(
        db,
        token,
        request
    )


# Revoke a specific session
@router.delete(
    "/sessions/{session_id}",
    response_model=MessageResponse,
    status_code=status.HTTP_200_OK
)
def revoke_session(
    session_id: int,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    token: str = Depends(get_token)
):

    return Service.revoke_user_session(
        db,
        token,
        session_id,
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


# Admin list pending Theatre Owner registrations
@router.get(
    "/admin/pending-owners",
    response_model=List[PendingOwnerResponse],
    status_code=status.HTTP_200_OK
)
def pending_owners(
    db: Session = Depends(get_db),
    token: str = Depends(get_token)
):

    Service.get_admin_user(db, token)

    return Service.get_pending_owners(db)


# Admin approve a Theatre Owner registration
@router.post(
    "/admin/approve/{owner_id}",
    response_model=ApprovalActionResponse,
    status_code=status.HTTP_200_OK
)
def approve_owner(
    owner_id: int,
    db: Session = Depends(get_db),
    token: str = Depends(get_token)
):

    Service.get_admin_user(db, token)

    return Service.approve_owner(
        db,
        owner_id
    )


# Admin reject a Theatre Owner registration
@router.post(
    "/admin/reject/{owner_id}",
    response_model=ApprovalActionResponse,
    status_code=status.HTTP_200_OK
)
def reject_owner(
    owner_id: int,
    db: Session = Depends(get_db),
    token: str = Depends(get_token)
):

    Service.get_admin_user(db, token)

    return Service.reject_owner(
        db,
        owner_id
    )
