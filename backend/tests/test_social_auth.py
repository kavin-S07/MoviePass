import os

os.environ.setdefault("GOOGLE_CLIENT_ID", "test-google-client-id")
os.environ.setdefault("GOOGLE_CLIENT_SECRET", "test-google-client-secret")
os.environ.setdefault("FRONTEND_URL", "http://localhost:5173")
os.environ.setdefault("OWNER_FRONTEND_URL", "http://localhost:5174")
os.environ.setdefault("JWT_SECRET", "test-access-secret")
os.environ.setdefault("JWT_REFRESH_SECRET", "test-refresh-secret")
os.environ.setdefault("JWT_EXPIRES_IN", "15m")
os.environ.setdefault("JWT_REFRESH_EXPIRES_IN", "7d")
os.environ.setdefault("ENVIRONMENT", "development")

import urllib.parse

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from config.Jwt import hash_password
from config.database import Base, get_db
from Modules.Auth import SocialService
from Modules.Auth.Model import RefreshSession, SocialAccount, User
from Modules.Auth.Social import oauth

import main


TEST_DATABASE_URL = os.getenv(
    "TEST_DATABASE_URL",
    "postgresql+psycopg://postgres:1234@127.0.0.1:5432/moviepass_test"
)

engine = create_engine(TEST_DATABASE_URL)

TestingSessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

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


@pytest.fixture(autouse=True)
def clean_and_mock(monkeypatch):

    """Reset client cookies and the test DB, and mock provider calls."""

    client.cookies.clear()

    with engine.begin() as conn:

        for table in [RefreshSession, SocialAccount, User]:

            conn.execute(text(f"DELETE FROM {table.__tablename__}"))

    # Recreate the seeded admin account for each test
    db = TestingSessionLocal()
    db.add(User(
        name="Admin",
        email="admin@moviepass.com",
        password=hash_password("Adminmoviepass"),
        role="ADMIN",
        phone_no=None,
        approval_status="APPROVED"
    ))
    db.commit()
    db.close()

    async def fake_authorize_access_token(request):

        if request.query_params.get("error"):

            from authlib.integrations.base_client.errors import OAuthError

            raise OAuthError(
                error="access_denied",
                description="Authorization was denied"
            )

        # Fake round-robin: state must exist in the session
        if not request.session.get("_state"):

            from authlib.integrations.base_client.errors import OAuthError

            raise OAuthError(
                error="mismatching_state",
                description="State does not match"
            )

        return {
            "access_token": "fake-provider-access-token",
            "id_token": "fake-id-token"
        }

    def fake_create_client(provider):

        class FakeClient:

            client_id = "test-client-id"

            async def authorize_redirect(self, request, redirect_uri):

                request.session["_state"] = "fake-state"

                from starlette.responses import RedirectResponse

                return RedirectResponse(
                    url=f"{redirect_uri}?state=fake-state",
                    status_code=302
                )

            async def authorize_access_token(self, request):

                return await fake_authorize_access_token(request)

        return FakeClient()

    class FakeOAuth:

        def create_client(self, provider):

            return fake_create_client(provider)

    monkeypatch.setattr(
        SocialService,
        "oauth",
        FakeOAuth()
    )

    async def fake_fetch_profile(provider, token):

        return {
            "provider_user_id": "uid-123",
            "email": "tester@example.com",
            "name": "Social Tester",
            "email_verified": True,
        }

    monkeypatch.setattr(
        SocialService,
        "fetch_profile",
        fake_fetch_profile
    )


def start_flow(app: str = "booker"):

    response = client.get(
        f"/auth/google?app={app}",
        follow_redirects=False
    )

    assert response.status_code == 302


def back_to_callback():

    return client.get(
        "/auth/google/callback?code=test-code&state=fake-state",
        follow_redirects=False
    )


def access_token_from(redirect_response):

    fragment = urllib.parse.urlparse(
        redirect_response.headers["location"]
    ).fragment

    return urllib.parse.parse_qs(fragment)["access_token"][0]


def test_google_oauth_signup():

    start_flow()

    response = back_to_callback()

    assert response.status_code == 307
    assert "refresh_token" not in response.headers["location"]
    assert "refresh_token" in response.headers.get("set-cookie", "")

    token = access_token_from(response)

    assert client.get(f"/auth/home?token={token}").status_code == 200

    db = TestingSessionLocal()

    user = db.query(User).filter(User.email == "tester@example.com").first()

    assert user.role == "TICKET_BOOKER"

    assert user.approval_status == "APPROVED"

    assert db.query(SocialAccount).filter(
        SocialAccount.user_id == user.id,
        SocialAccount.provider == "google"
    ).count() == 1

    assert db.query(RefreshSession).filter(
        RefreshSession.user_id == user.id,
        RefreshSession.is_active.is_(True)
    ).count() == 1

    db.close()


def test_google_repeat_login_does_not_duplicate_user():

    start_flow()
    back_to_callback()

    start_flow()
    response = back_to_callback()

    assert response.status_code == 307

    db = TestingSessionLocal()

    assert db.query(User).filter(User.email == "tester@example.com").count() == 1

    assert db.query(SocialAccount).count() == 1

    user = db.query(User).filter(User.email == "tester@example.com").first()

    assert db.query(RefreshSession).filter(
        RefreshSession.user_id == user.id
    ).count() >= 2

    db.close()


def test_existing_user_linked_by_verified_email():

    signup_response = client.post(
        "/auth/signup",
        json={
            "name": "Email User",
            "email": "tester@example.com",
            "password": "Password123",
            "phone_no": "9876543210",
        }
    )

    assert signup_response.status_code == 201
    assert "refresh_token" not in signup_response.json()
    assert "refresh_token" in signup_response.headers.get("set-cookie", "")

    start_flow()

    response = back_to_callback()

    assert response.status_code == 307

    db = TestingSessionLocal()

    user = db.query(User).filter(User.email == "tester@example.com").first()

    assert user.role == "TICKET_BOOKER"  # existing role untouched

    assert db.query(SocialAccount).filter(
        SocialAccount.user_id == user.id,
        SocialAccount.provider == "google"
    ).count() == 1

    db.close()


def test_oauth_callback_rejects_bad_state():

    response = client.get(
        "/auth/google/callback?code=x&state=no-session",
        follow_redirects=False
    )

    assert "error=" in response.headers["location"]


def test_oauth_cancellation_redirects_with_error():

    start_flow()

    response = client.get(
        "/auth/google/callback?error=access_denied",
        follow_redirects=False
    )

    assert "error=" in response.headers["location"]


def test_oauth_cannot_create_users_with_admin_role():

    start_flow()
    response = back_to_callback()

    token = access_token_from(response)

    db = TestingSessionLocal()

    assert db.query(User).filter(User.role == "ADMIN").count() == 1

    assert db.query(User).filter(
        User.role == "ADMIN",
        User.email == "tester@example.com"
    ).count() == 0

    db.close()


def test_signup_endpoint_cannot_grant_admin_role():

    client.post(
        "/auth/signup",
        json={
            "name": "Sneaky",
            "email": "sneaky@example.com",
            "password": "SneakyPass123",
            "phone_no": "9001234569",
        }
    )

    db = TestingSessionLocal()

    user = db.query(User).filter(User.email == "sneaky@example.com").first()

    assert user.role == "TICKET_BOOKER"

    db.close()


def test_owner_signup_is_pending_and_admin_can_approve():

    # Theatre Owner signs up (not client-chosen role)
    response = client.post(
        "/auth/signup/owner",
        json={
            "name": "Owner Test",
            "email": "owner@example.com",
            "password": "OwnerPass123",
            "phone_no": "9001234567",
        }
    )

    assert response.status_code == 201

    user = response.json()["user"]

    assert user["role"] == "THEATRE_OWNER"

    assert user["approval_status"] == "PENDING"

    # Ticket Booker cannot reach admin endpoints
    tb = client.post(
        "/auth/signup",
        json={
            "name": "Booker Test",
            "email": "booker@example.com",
            "password": "BookerPass123",
            "phone_no": "9001234568",
        }
    ).json()

    assert client.get(
        f"/auth/admin/pending-owners?token={tb['access_token']}"
    ).status_code == 403

    # Pending theatre owner cannot approve their own registration either
    assert client.get(
        f"/auth/admin/pending-owners?token={response.json()['access_token']}"
    ).status_code == 403

    # Admin sees the pending owner, approves it
    admin = client.post(
        "/auth/login",
        json={
            "email": "admin@moviepass.com",
            "password": "Adminmoviepass",
        }
    ).json()

    pending = client.get(
        f"/auth/admin/pending-owners?token={admin['access_token']}"
    ).json()

    assert len(pending) == 1

    approve = client.post(
        f"/auth/admin/approve/{pending[0]['user_id']}?token={admin['access_token']}"
    )

    assert approve.status_code == 200

    db = TestingSessionLocal()

    owner = db.query(User).filter(User.email == "owner@example.com").first()

    assert owner.approval_status == "APPROVED"

    db.close()


def test_existing_email_password_still_works():

    client.post(
        "/auth/signup",
        json={
            "name": "Regression Test",
            "email": "regression@example.com",
            "password": "RegressionPass1",
            "phone_no": "9876543211",
        }
    )

    response = client.post(
        "/auth/login",
        json={
            "email": "regression@example.com",
            "password": "RegressionPass1",
        }
    )

    assert response.status_code == 200
