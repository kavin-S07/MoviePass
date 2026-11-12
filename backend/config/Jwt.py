import hashlib
import hmac
import os
import secrets
import uuid
from datetime import datetime, timedelta, timezone

from dotenv import load_dotenv
from jose import JWTError, jwt
from pwdlib import PasswordHash

load_dotenv()


ACCESS_TOKEN_SECRET = os.environ["JWT_SECRET"]
REFRESH_TOKEN_SECRET = os.environ["JWT_REFRESH_SECRET"]
ACCESS_TOKEN_EXPIRY = os.getenv("JWT_EXPIRES_IN", "15m")
REFRESH_TOKEN_EXPIRY = os.getenv("JWT_REFRESH_EXPIRES_IN", "7d")
ENVIRONMENT = os.getenv("ENVIRONMENT", "development").lower()

ALGORITHM = "HS256"

password_hash = PasswordHash.recommended()


# Hash password
def hash_password(password: str):

    return password_hash.hash(password)


# Verify password
def verify_password(plain_password: str, hashed_password: str):

    return password_hash.verify(plain_password, hashed_password)


# Convert "15m", "7d", "30s", "12h" to timedelta
def parse_expiry(value: str):

    amount = int(value[:-1])

    unit = value[-1]

    return {
        "s": timedelta(seconds=amount),
        "m": timedelta(minutes=amount),
        "h": timedelta(hours=amount),
        "d": timedelta(days=amount)
    }[unit]


def expiry_seconds(value: str) -> int:

    return int(parse_expiry(value).total_seconds())


# Creates a short-lived JWT access token for a user.
# Used when a user logs in or refreshes their session.
def create_access_token(user_id: int, role: str, jti: str | None = None):

    expire = datetime.now(timezone.utc) + parse_expiry(ACCESS_TOKEN_EXPIRY)

    payload = {
        "sub": str(user_id),
        "role": role,
        "type": "access",
        "exp": expire,
        "jti": jti or str(uuid.uuid4()),
    }

    return jwt.encode(payload, ACCESS_TOKEN_SECRET, algorithm=ALGORITHM)


# Creates a database-managed JWT refresh token for a user session.
def create_refresh_token(user_id: int, jti: str | None = None):

    expire = datetime.now(timezone.utc) + parse_expiry(REFRESH_TOKEN_EXPIRY)

    session_jti = jti or secrets.token_urlsafe(32)

    payload = {
        "sub": str(user_id),
        "type": "refresh",
        "jti": session_jti,
        "exp": expire,
    }

    token = jwt.encode(payload, REFRESH_TOKEN_SECRET, algorithm=ALGORITHM)

    return token, session_jti, expire


def decode_access_token(token: str):

    payload = jwt.decode(
        token,
        ACCESS_TOKEN_SECRET,
        algorithms=[ALGORITHM]
    )

    if payload.get("type") != "access":

        raise JWTError("Invalid token type")

    return payload


def decode_refresh_token(token: str):

    payload = jwt.decode(
        token,
        REFRESH_TOKEN_SECRET,
        algorithms=[ALGORITHM]
    )

    if payload.get("type") != "refresh":

        raise JWTError("Invalid token type")

    return payload


def hash_refresh_token(token: str) -> str:

    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def refresh_tokens_match(provided_hash: str, stored_hash: str) -> bool:

    return hmac.compare_digest(provided_hash, stored_hash)


def refresh_cookie_secure() -> bool:

    # Always secure outside local development; allow HTTP locally.
    return ENVIRONMENT == "production"
