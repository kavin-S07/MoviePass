import os
import uuid
from datetime import datetime, timedelta, timezone

os.environ.setdefault("JWT_SECRET", "test-access-secret")
os.environ.setdefault("JWT_REFRESH_SECRET", "test-refresh-secret")
os.environ.setdefault("JWT_EXPIRES_IN", "15m")
os.environ.setdefault("JWT_REFRESH_EXPIRES_IN", "7d")
os.environ.setdefault("ENVIRONMENT", "development")
os.environ.setdefault("FRONTEND_URL", "http://localhost:5173")
os.environ.setdefault("OWNER_FRONTEND_URL", "http://localhost:5174")

import pytest
from fastapi.testclient import TestClient
from jose import jwt
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

import main
from config import Jwt as JwtConfig
from config.database import Base, get_db
from Modules.Auth.Model import RefreshSession, SocialAccount, User
from Modules.Auth import Repository


TEST_DATABASE_URL = os.getenv(
    "TEST_DATABASE_URL",
    "postgresql+psycopg://postgres:1234@127.0.0.1:5432/moviepass_test"
)

engine = create_engine(TEST_DATABASE_URL)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base.metadata.drop_all(bind=engine)
Base.metadata.create_all(bind=engine)


def override_get_db():

    db = TestingSessionLocal()

    try:

        yield db

    finally:

        db.close()


main.app.dependency_overrides[get_db] = override_get_db

client = TestClient(main.app)


def _seed_admin():

    db = TestingSessionLocal()

    admin = User(
        name="Admin",
        email="admin@moviepass.com",
        password=JwtConfig.hash_password("Adminmoviepass"),
        role="ADMIN",
        phone_no=None,
        approval_status="APPROVED",
    )

    db.add(admin)
    db.commit()
    db.close()


@pytest.fixture(autouse=True)
def clean_db():

    client.cookies.clear()

    with engine.begin() as conn:

        for table in [RefreshSession, SocialAccount, User]:

            conn.execute(text(f"DELETE FROM {table.__tablename__}"))

    _seed_admin()

    yield


def signup_booker(email="booker@example.com"):

    return client.post(
        "/auth/signup",
        json={
            "name": "Booker",
            "email": email,
            "password": "Password123",
            "phone_no": "9876543210",
        },
    )


def login(email, password):

    return client.post(
        "/auth/login",
        json={
            "email": email,
            "password": password,
        },
    )


def test_signup_sets_refresh_cookie_and_not_in_json():

    response = signup_booker()

    assert response.status_code == 201
    body = response.json()

    assert "refresh_token" not in body
    assert body["access_token"]
    assert body["token_type"] == "Bearer"
    assert "refresh_token=" in response.headers.get("set-cookie", "")

    db = TestingSessionLocal()
    user = db.query(User).filter(User.email == "booker@example.com").first()
    assert db.query(RefreshSession).filter(RefreshSession.user_id == user.id).count() == 1
    db.close()


def test_login_sets_refresh_cookie_and_not_in_json():

    signup_booker("login@example.com")
    client.cookies.clear()

    response = login("login@example.com", "Password123")

    assert response.status_code == 200
    body = response.json()

    assert "refresh_token" not in body
    assert "refresh_token=" in response.headers.get("set-cookie", "")


def test_refresh_rotates_token_and_returns_new_access_token():

    signup_booker("refresh@example.com")

    old_cookie = client.cookies.get("refresh_token")
    assert old_cookie

    response = client.post(
        "/auth/refresh",
        headers={"origin": "http://localhost:5173"},
    )

    assert response.status_code == 200
    assert response.json()["access_token"]
    assert "refresh_token=" in response.headers.get("set-cookie", "")
    assert client.cookies.get("refresh_token") != old_cookie

    db = TestingSessionLocal()
    sessions = db.query(RefreshSession).all()
    assert len(sessions) == 2
    assert sum(1 for s in sessions if s.is_active) == 1
    assert sum(1 for s in sessions if s.revoked_at is not None) == 1
    db.close()


def test_invalid_refresh_token_rejected_and_cookie_cleared():

    client.cookies.set("refresh_token", "not-a-jwt", path="/auth")

    response = client.post(
        "/auth/refresh",
        headers={"origin": "http://localhost:5173"},
    )

    assert response.status_code == 401
    assert "refresh_token=" in response.headers.get("set-cookie", "")


def test_expired_refresh_token_rejected():

    signup_booker("expired@example.com")

    db = TestingSessionLocal()
    user = db.query(User).filter(User.email == "expired@example.com").first()
    session = db.query(RefreshSession).filter(RefreshSession.user_id == user.id).first()

    expired = datetime.now(timezone.utc) - timedelta(minutes=5)
    token = jwt.encode(
        {
            "sub": str(user.id),
            "type": "refresh",
            "jti": session.refresh_token_hash,
            "exp": expired,
        },
        JwtConfig.REFRESH_TOKEN_SECRET,
        algorithm=JwtConfig.ALGORITHM,
    )

    session.expires_at = expired
    db.commit()
    db.close()

    client.cookies.set("refresh_token", token, path="/auth")

    response = client.post(
        "/auth/refresh",
        headers={"origin": "http://localhost:5173"},
    )

    assert response.status_code == 401


def test_revoked_session_cannot_refresh():

    signup_booker("revoked@example.com")

    token = client.cookies.get("refresh_token")

    logout = client.post(
        "/auth/logout",
        headers={"origin": "http://localhost:5173"},
    )
    assert logout.status_code == 200

    client.cookies.set("refresh_token", token, path="/auth")

    response = client.post(
        "/auth/refresh",
        headers={"origin": "http://localhost:5173"},
    )

    assert response.status_code == 401


def test_refresh_token_reuse_is_rejected():

    signup_booker("reuse@example.com")

    old_token = client.cookies.get("refresh_token")

    first = client.post(
        "/auth/refresh",
        headers={"origin": "http://localhost:5173"},
    )
    assert first.status_code == 200

    client.cookies.clear()
    client.cookies.set("refresh_token", old_token, path="/auth")

    second = client.post(
        "/auth/refresh",
        headers={"origin": "http://localhost:5173"},
    )

    assert second.status_code == 401


def test_logout_revokes_session_and_clears_cookie():

    signup = signup_booker("logout@example.com")
    token = signup.json()["access_token"]

    response = client.post(
        "/auth/logout",
        headers={"origin": "http://localhost:5173"},
    )

    assert response.status_code == 200

    db = TestingSessionLocal()
    assert db.query(RefreshSession).filter(RefreshSession.is_active.is_(True)).count() == 0
    db.close()

    # Access token still valid until expiry; session APIs still work with it.
    sessions = client.get(
        "/auth/sessions",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert sessions.status_code == 200
    assert sessions.json() == []


def test_session_listing_and_revocation_do_not_expose_secrets():

    signup = signup_booker("sessions@example.com")
    token = signup.json()["access_token"]

    listed = client.get(
        "/auth/sessions",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert listed.status_code == 200
    body = listed.json()
    assert len(body) == 1
    assert "refresh_token_hash" not in body[0]
    assert body[0]["is_current"] is True

    session_id = body[0]["session_id"]

    revoked = client.delete(
        f"/auth/sessions/{session_id}",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert revoked.status_code == 200

    listed_after = client.get(
        "/auth/sessions",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert listed_after.status_code == 200
    assert listed_after.json() == []


def test_concurrent_refresh_allows_only_one_rotation():

    signup_booker("concurrent@example.com")

    cookie = client.cookies.get("refresh_token")

    results = []

    def worker():

        with TestClient(main.app) as local_client:

            local_client.cookies.set("refresh_token", cookie, path="/auth")
            resp = local_client.post(
                "/auth/refresh",
                headers={"origin": "http://localhost:5173"},
            )
            results.append(resp.status_code)

    import threading

    t1 = threading.Thread(target=worker)
    t2 = threading.Thread(target=worker)
    t1.start()
    t2.start()
    t1.join()
    t2.join()

    assert sorted(results) == [200, 401]

    db = TestingSessionLocal()
    sessions = db.query(RefreshSession).all()
    assert sum(1 for s in sessions if s.is_active) == 1
    db.close()
