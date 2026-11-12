import os
from datetime import datetime, timezone
from urllib.parse import urlparse

from fastapi import HTTPException, Request, Response, status
from jose import JWTError
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from Modules.Auth import Repository
from config.Jwt import (
    REFRESH_TOKEN_EXPIRY,
    create_access_token,
    create_refresh_token,
    decode_access_token,
    decode_refresh_token,
    expiry_seconds,
    hash_password,
    hash_refresh_token,
    refresh_cookie_secure,
    refresh_tokens_match,
    verify_password,
)

REFRESH_COOKIE_NAME = "refresh_token"
REFRESH_COOKIE_PATH = "/auth"


def _allowed_origins():

    origins = {
        os.getenv("FRONTEND_URL", "http://localhost:5173"),
        os.getenv("OWNER_FRONTEND_URL", "http://localhost:5174"),
    }

    # Development-friendly defaults
    origins.update(
        {
            "http://localhost:5173",
            "http://localhost:5174",
            "http://127.0.0.1:5173",
            "http://127.0.0.1:5174",
        }
    )

    return {origin.rstrip("/") for origin in origins if origin}


def enforce_csrf_for_cookie_auth(request: Request):

    origin = request.headers.get("origin")

    if origin:

        if origin.rstrip("/") in _allowed_origins():

            return

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden"
        )

    referer = request.headers.get("referer")

    if referer:

        referer_origin = "{uri.scheme}://{uri.netloc}".format(
            uri=urlparse(referer)
        )

        if referer_origin.rstrip("/") in _allowed_origins():

            return

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden"
        )

    # Allow non-browser or same-origin clients that do not send origin headers.
    return


def get_client_ip(request: Request):

    if request.client:

        return request.client.host

    return None


def get_device_info(request: Request):

    user_agent = request.headers.get("user-agent")

    device_name = None

    if user_agent:

        device_name = user_agent[:255]

    return {
        "ip_address": get_client_ip(request),
        "user_agent": user_agent,
        "device_name": device_name,
    }


def assess_refresh_risk(session, request: Request):

    current_ip = get_client_ip(request)
    current_ua = request.headers.get("user-agent")

    risk = {
        "ip_changed": bool(session.ip_address and current_ip and session.ip_address != current_ip),
        "user_agent_changed": bool(session.user_agent and current_ua and session.user_agent != current_ua),
    }

    # Risk signal only: do not permanently bind or auto-logout legitimate users.
    return risk


def set_refresh_cookie(response: Response, refresh_token: str):

    response.set_cookie(
        key=REFRESH_COOKIE_NAME,
        value=refresh_token,
        httponly=True,
        secure=refresh_cookie_secure(),
        samesite="lax",
        path=REFRESH_COOKIE_PATH,
        max_age=expiry_seconds(REFRESH_TOKEN_EXPIRY),
    )


def clear_refresh_cookie(response: Response):

    response.delete_cookie(
        key=REFRESH_COOKIE_NAME,
        path=REFRESH_COOKIE_PATH,
        httponly=True,
        secure=refresh_cookie_secure(),
        samesite="lax",
    )


def _create_session_record(db: Session, user_id: int, jti: str, expires_at, request: Request):

    info = get_device_info(request)

    return Repository.create_refresh_session(
        db,
        {
            "user_id": user_id,
            "refresh_token_hash": jti,
            "ip_address": info["ip_address"],
            "user_agent": info["user_agent"],
            "device_name": info["device_name"],
            "expires_at": expires_at,
            "last_used_at": None,
            "revoked_at": None,
            "is_active": True,
        }
    )


def issue_session_tokens(db: Session, user, request: Request):

    access_token = create_access_token(user.id, user.role)

    refresh_token, jti, expires_at = create_refresh_token(user.id)

    _create_session_record(db, user.id, jti, expires_at, request)

    return access_token, refresh_token


def _auth_response(message: str, user, access_token: str):

    return {
        "message": message,
        "user": user,
        "access_token": access_token,
        "token_type": "Bearer",
    }


# Signup service (Ticket Booker)
def signup_user(db: Session, user_data, request: Request, response: Response):

    return _signup(
        db,
        user_data,
        request,
        response,
        role="TICKET_BOOKER",
        approval_status="APPROVED"
    )


# Signup service (Theatre Owner - needs Admin approval)
def signup_owner(db: Session, user_data, request: Request, response: Response):

    return _signup(
        db,
        user_data,
        request,
        response,
        role="THEATRE_OWNER",
        approval_status="PENDING"
    )


# Common signup implementation
def _signup(db: Session, user_data, request: Request, response: Response, role: str, approval_status: str):

    existing_user = Repository.get_user_by_email(
        db,
        user_data.email
    )

    if existing_user:

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered"
        )

    hashed_password = hash_password(user_data.password)

    new_user_data = {
        "name": user_data.name,
        "email": user_data.email,
        "password": hashed_password,
        "role": role,
        "phone_no": user_data.phone_no,
        "approval_status": approval_status,
    }

    try:

        new_user = Repository.create_user(
            db,
            new_user_data
        )

        access_token, refresh_token = issue_session_tokens(db, new_user, request)

        db.commit()

        db.refresh(new_user)

    except IntegrityError:

        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered"
        )

    message = "Signup successful"

    if role == "THEATRE_OWNER":

        message = "Signup successful. Your application is pending Admin approval."

    set_refresh_cookie(response, refresh_token)

    return _auth_response(message, new_user, access_token)


# Login service
def login_user(db: Session, login_data, request: Request, response: Response):

    user = Repository.get_user_by_email(
        db,
        login_data.email
    )

    if not user:

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    # Social-only accounts have no password
    if not user.password:

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="This account uses social login"
        )

    if not verify_password(
        login_data.password,
        user.password
    ):

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    access_token, refresh_token = issue_session_tokens(db, user, request)

    db.commit()

    set_refresh_cookie(response, refresh_token)

    return _auth_response("Login successful", user, access_token)


def _auth_error(response: Response, clear_cookie: bool = True):

    if clear_cookie:

        clear_refresh_cookie(response)

    headers = {}

    set_cookie = response.headers.get("set-cookie")

    if set_cookie:

        headers["set-cookie"] = set_cookie

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired refresh token",
        headers=headers or None,
    )


def refresh_user_session(db: Session, request: Request, response: Response):

    enforce_csrf_for_cookie_auth(request)

    token = request.cookies.get(REFRESH_COOKIE_NAME)

    if not token:

        _auth_error(response, clear_cookie=True)

    try:

        payload = decode_refresh_token(token)

    except JWTError:

        _auth_error(response, clear_cookie=True)

    try:

        user_id = int(payload.get("sub"))

    except (TypeError, ValueError):

        _auth_error(response, clear_cookie=True)

    jti = payload.get("jti")

    if not jti:

        _auth_error(response, clear_cookie=True)

    session = Repository.get_refresh_session_by_hash(
        db,
        jti,
        for_update=True
    )

    now = datetime.now(timezone.utc)

    if not session:

        _auth_error(response, clear_cookie=True)

    if session.user_id != user_id:

        _auth_error(response, clear_cookie=True)

    expires_at = session.expires_at

    if expires_at.tzinfo is None:

        expires_at = expires_at.replace(tzinfo=timezone.utc)

    if not session.is_active or session.revoked_at is not None or expires_at <= now:

        # Reuse/replay or revoked/expired session: deny and clear cookie.
        if session.is_active:

            Repository.revoke_refresh_session(session)
            session.last_used_at = now
            db.commit()

        _auth_error(response, clear_cookie=True)

    # Compare presented token identity (hash comparison helper kept centralized).
    if not refresh_tokens_match(hash_refresh_token(jti), hash_refresh_token(session.refresh_token_hash)):

        _auth_error(response, clear_cookie=True)

    assess_refresh_risk(session, request)

    user = Repository.get_user_by_id(db, user_id)

    if not user:

        Repository.revoke_refresh_session(session)
        session.last_used_at = now
        db.commit()
        _auth_error(response, clear_cookie=True)

    # Rotate: invalidate old session and issue a new one atomically.
    Repository.revoke_refresh_session(session)
    session.last_used_at = now

    new_access_token = create_access_token(user.id, user.role)
    new_refresh_token, new_jti, new_expires_at = create_refresh_token(user.id)

    _create_session_record(db, user.id, new_jti, new_expires_at, request)

    db.commit()

    set_refresh_cookie(response, new_refresh_token)

    return {
        "access_token": new_access_token,
        "token_type": "Bearer",
    }


def logout_user_session(db: Session, request: Request, response: Response):

    enforce_csrf_for_cookie_auth(request)

    token = request.cookies.get(REFRESH_COOKIE_NAME)

    if token:

        try:

            payload = decode_refresh_token(token)
            jti = payload.get("jti")

            if jti:

                session = Repository.get_refresh_session_by_hash(db, jti, for_update=True)

                if session:

                    Repository.revoke_refresh_session(session)
                    session.last_used_at = datetime.now(timezone.utc)
                    db.commit()

        except JWTError:

            db.rollback()

    clear_refresh_cookie(response)

    return {"message": "Logout successful"}


def logout_all_user_sessions(db: Session, token: str, response: Response):

    user = get_authenticated_user(db, token)

    Repository.revoke_all_user_refresh_sessions(db, user.id)

    db.commit()

    clear_refresh_cookie(response)

    return {"message": "All sessions logged out"}


def list_user_sessions(db: Session, token: str, request: Request):

    user = get_authenticated_user(db, token)

    current_jti = None
    cookie_token = request.cookies.get(REFRESH_COOKIE_NAME)

    if cookie_token:

        try:

            payload = decode_refresh_token(cookie_token)
            current_jti = payload.get("jti")

        except JWTError:

            current_jti = None

    sessions = Repository.get_active_refresh_sessions_for_user(db, user.id)

    result = []

    for session in sessions:

        result.append(
            {
                "id": session.id,
                "ip_address": session.ip_address,
                "device_name": session.device_name,
                "user_agent": session.user_agent,
                "created_at": session.created_at,
                "last_used_at": session.last_used_at,
                "expires_at": session.expires_at,
                "is_current": bool(current_jti and session.refresh_token_hash == current_jti),
            }
        )

    return result


def revoke_user_session(db: Session, token: str, session_id: int, request: Request, response: Response):

    user = get_authenticated_user(db, token)

    session = Repository.get_user_refresh_session(db, user.id, session_id)

    if not session:

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found"
        )

    Repository.revoke_refresh_session(session)
    db.commit()

    cookie_token = request.cookies.get(REFRESH_COOKIE_NAME)

    if cookie_token:

        try:

            payload = decode_refresh_token(cookie_token)

            if payload.get("jti") == session.refresh_token_hash:

                clear_refresh_cookie(response)

        except JWTError:

            pass

    return {"message": "Session revoked"}


def get_authenticated_user(db: Session, token: str):

    try:

        payload = decode_access_token(token)

    except JWTError:

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token"
        )

    user = Repository.get_user_by_id(
        db,
        int(payload["sub"])
    )

    if not user:

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token"
        )

    return user


# Home service
def get_home(db: Session, token: str):

    user = get_authenticated_user(db, token)

    return {
        "message": f"Welcome {user.name} to MoviePass web application",
        "user": user
    }


# Verify the caller is an authenticated Admin
def get_admin_user(db: Session, token: str):

    try:

        payload = decode_access_token(token)

    except JWTError:

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token"
        )

    if payload.get("role") != "ADMIN":

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )

    admin = Repository.get_user_by_id(
        db,
        int(payload["sub"])
    )

    if not admin:

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Admin account not found"
        )

    return admin


# Verify the caller is an approved Theatre Owner (or Admin)
def get_current_owner(db: Session, token: str):

    try:

        payload = decode_access_token(token)

    except JWTError:

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token"
        )

    role = payload.get("role")

    if role not in ("THEATRE_OWNER", "ADMIN"):

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Theatre Owners can access this resource"
        )

    user = Repository.get_user_by_id(
        db,
        int(payload["sub"])
    )

    if not user:

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )

    if user.role == "THEATRE_OWNER" and user.approval_status != "APPROVED":

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your Theatre Owner account is pending Admin approval"
        )

    return user


# Admin list pending theatre owners
def get_pending_owners(db: Session):

    return Repository.get_pending_owners(db)


# Admin approve a theatre owner
def approve_owner(db: Session, owner_id: int):

    owner = Repository.set_owner_approval(
        db,
        owner_id,
        "APPROVED"
    )

    if not owner:

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Theatre owner not found"
        )

    db.commit()

    return {
        "message": f"Theatre owner {owner.name} approved"
    }


# Admin reject a theatre owner
def reject_owner(db: Session, owner_id: int):

    owner = Repository.set_owner_approval(
        db,
        owner_id,
        "REJECTED"
    )

    if not owner:

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Theatre owner not found"
        )

    db.commit()

    return {
        "message": f"Theatre owner {owner.name} rejected"
    }
