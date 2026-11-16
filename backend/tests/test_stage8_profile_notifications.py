import os
from datetime import date, time, timedelta

os.environ.setdefault("JWT_SECRET", "test-jwt-secret")
os.environ.setdefault("JWT_REFRESH_SECRET", "test-jwt-refresh-secret")
os.environ.setdefault("JWT_EXPIRES_IN", "15m")
os.environ.setdefault("JWT_REFRESH_EXPIRES_IN", "7d")
os.environ.setdefault("SESSION_SECRET", "test-session-secret")
os.environ.setdefault("FRONTEND_URL", "http://localhost:5173")
os.environ.setdefault("OWNER_FRONTEND_URL", "http://localhost:5174")
os.environ.setdefault("ENVIRONMENT", "development")
os.environ.setdefault("SEED_DEFAULT_ADMIN", "false")
os.environ.setdefault("PAYMENT_PROVIDER", "sandbox")
os.environ.setdefault("PAYMENT_SANDBOX_SECRET", "test-sandbox-secret")
os.environ.setdefault(
    "DATABASE_URL",
    os.getenv("TEST_DATABASE_URL", "postgresql+psycopg://postgres:1234@127.0.0.1:5432/moviepass_test"),
)

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import main
from config.database import Base, get_db
from Modules.Auth.Model import User
from Modules.Bookings.Payments import get_payment_provider
from Modules.Notifications.Model import Notification
from Modules.Theatres.Model import Movie, Screen, Seat, Show, Theatre
from config.Jwt import hash_password

TEST_DATABASE_URL = os.getenv("TEST_DATABASE_URL", "postgresql+psycopg://postgres:1234@127.0.0.1:5432/moviepass_test")
engine = create_engine(TEST_DATABASE_URL)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


main.app.dependency_overrides[get_db] = override_get_db
client = TestClient(main.app)


def reset_db():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)


def auth(token):
    return {"Authorization": f"Bearer {token}"}


def signup_login_booker(email="booker8@example.com"):
    res = client.post("/auth/signup", json={"name": "Booker Eight", "email": email, "password": "Password123", "phone_no": "9999999999"})
    assert res.status_code == 201, res.text
    return res.json()["access_token"], res.json()["user"]


def test_profile_load_and_update_and_cannot_change_role():
    reset_db()
    token, user = signup_login_booker()
    p = client.get("/auth/profile", headers=auth(token))
    assert p.status_code == 200, p.text
    body = p.json()
    assert body["email"] == user["email"]
    assert body["name"] == user["name"]
    assert body["role"] == "TICKET_BOOKER"
    assert "phone_no" in body
    assert "account_created_at" in body  # may be null if unavailable

    up = client.patch("/auth/profile", json={"name": "Updated Name", "phone_no": "8888888888"}, headers=auth(token))
    assert up.status_code == 200, up.text
    assert up.json()["name"] == "Updated Name"
    assert up.json()["phone_no"] == "8888888888"
    assert up.json()["role"] == "TICKET_BOOKER"

    bad = client.patch("/auth/profile", json={"role": "ADMIN"}, headers=auth(token))
    assert bad.status_code == 400


def test_session_listing_revoke_and_logout_all():
    reset_db()
    # login twice to create sessions (signup created one, login another)
    signup = client.post("/auth/signup", json={"name": "S User", "email": "sess@example.com", "password": "Password123", "phone_no": "9999999999"})
    assert signup.status_code == 201
    login2 = client.post("/auth/login", json={"email": "sess@example.com", "password": "Password123"})
    assert login2.status_code == 200
    token = login2.json()["access_token"]

    sessions = client.get("/auth/sessions", headers=auth(token))
    assert sessions.status_code == 200, sessions.text
    arr = sessions.json()
    assert isinstance(arr, list)
    assert len(arr) >= 1
    # verify contract fields
    sample = arr[0]
    for key in ["session_id", "ip_address", "device_name", "user_agent", "created_at", "last_used_at", "expires_at", "is_current"]:
        assert key in sample
    assert any(s.get("is_current") for s in arr)

    # revoke a non-current session if possible, else revoke any and then logout-all test separately
    non_current = next((s for s in arr if not s.get("is_current")), None)
    if non_current:
        rev = client.delete(f"/auth/sessions/{non_current['session_id']}", headers=auth(token))
        assert rev.status_code == 200, rev.text
        sessions_after = client.get("/auth/sessions", headers=auth(token)).json()
        assert all(s["session_id"] != non_current["session_id"] for s in sessions_after)

    out_all = client.post("/auth/logout-all", headers=auth(token))
    assert out_all.status_code == 200, out_all.text
    sessions_after_all = client.get("/auth/sessions", headers=auth(token))
    # token remains a valid access token, but active refresh sessions should be gone
    assert sessions_after_all.status_code == 200
    assert sessions_after_all.json() == []


def test_notifications_list_read_unread_and_authorization():
    reset_db()
    token1, user1 = signup_login_booker("n1@example.com")
    token2, user2 = signup_login_booker("n2@example.com")

    # create notifications directly (real event simulation in DB) for user1
    db = TestingSessionLocal()
    try:
        u1 = db.query(User).filter(User.email == "n1@example.com").first()
        u2 = db.query(User).filter(User.email == "n2@example.com").first()
        n1 = Notification(user_id=u1.id, type="PAYMENT_SUCCESS", title="Payment successful", message="msg1", is_read=False)
        n2 = Notification(user_id=u1.id, type="BOOKING_CONFIRMED", title="Booking confirmed", message="msg2", is_read=False)
        n3 = Notification(user_id=u2.id, type="PAYMENT_SUCCESS", title="Other", message="other", is_read=False)
        db.add_all([n1, n2, n3]); db.commit()
        nid1 = n1.notification_id
        nid3 = n3.notification_id
    finally:
        db.close()

    lst = client.get("/notifications", headers=auth(token1))
    assert lst.status_code == 200, lst.text
    body = lst.json()
    assert body["unread_count"] == 2
    assert len(body["notifications"]) == 2
    assert all(n["is_read"] is False for n in body["notifications"])

    unread = client.get("/notifications/unread-count", headers=auth(token1))
    assert unread.status_code == 200 and unread.json()["unread_count"] == 2

    # cannot read other user's notification
    forbidden = client.post(f"/notifications/{nid3}/read", headers=auth(token1))
    assert forbidden.status_code == 404

    mr = client.post(f"/notifications/{nid1}/read", headers=auth(token1))
    assert mr.status_code == 200 and mr.json()["is_read"] is True
    unread2 = client.get("/notifications/unread-count", headers=auth(token1)).json()["unread_count"]
    assert unread2 == 1

    allr = client.post("/notifications/read-all", headers=auth(token1))
    assert allr.status_code == 200
    assert client.get("/notifications/unread-count", headers=auth(token1)).json()["unread_count"] == 0

    # non-booker role cannot access notifications
    db = TestingSessionLocal()
    try:
        owner = User(name="Owner", email="owner8@example.com", password=hash_password("Password123"), role="THEATRE_OWNER", phone_no="7777777777", approval_status="APPROVED")
        db.add(owner); db.commit()
    finally:
        db.close()
    owner_login = client.post("/auth/login", json={"email": "owner8@example.com", "password": "Password123"})
    assert owner_login.status_code == 200
    owner_token = owner_login.json()["access_token"]
    assert client.get("/notifications", headers=auth(owner_token)).status_code == 403


def test_real_notification_created_on_booking_confirmation():
    reset_db()
    # seed minimal show and confirm booking to trigger payment/booking notifications
    db = TestingSessionLocal()
    try:
        owner = User(name="Owner", email="owner-notif@example.com", password=hash_password("Password123"), role="THEATRE_OWNER", phone_no="8888888801", approval_status="APPROVED")
        booker = User(name="Booker", email="booker-notif@example.com", password=hash_password("Password123"), role="TICKET_BOOKER", phone_no="7777777701", approval_status="APPROVED")
        db.add_all([owner, booker]); db.flush()
        movie = Movie(movie_name="M", language="English", genre="Drama", certification="UA", release_date=date.today()-timedelta(days=1))
        db.add(movie); db.flush()
        theatre = Theatre(owner_id=owner.id, name="T", address="A", city="C", state="S", status="ACTIVE")
        db.add(theatre); db.flush()
        screen = Screen(theatre_id=theatre.theatre_id, screen_name="S1", screen_number=1, no_of_rows=1, no_of_columns=1, has_categories=False, default_price=100.00, status="ACTIVE")
        db.add(screen); db.flush()
        seat = Seat(screen_id=screen.screen_id, seat_name="A1", row_number=1, column_number=1, is_active=True)
        db.add(seat); db.flush()
        show = Show(movie_id=movie.movie_id, screen_id=screen.screen_id, show_date=date.today()+timedelta(days=2), start_time=time(18,0), end_time=time(20,0), status="scheduled")
        db.add(show); db.commit()
        show_id = show.show_id; seat_id = seat.seat_id
    finally:
        db.close()

    token = client.post("/auth/login", json={"email": "booker-notif@example.com", "password": "Password123"}).json()["access_token"]
    lock = client.post(f"/bookings/shows/{show_id}/locks", json={"seat_ids": [seat_id]}, headers=auth(token)).json()["lock_token"]
    chk = client.post("/bookings/checkout", json={"lock_token": lock}, headers=auth(token)).json()
    booking_id = chk["booking_id"]; order_id = chk["payment"]["provider_order_id"]
    provider = get_payment_provider()
    pp = "sandbox_pay_stage8"
    sig = provider.make_client_signature(order_id, pp)
    ver = client.post(f"/bookings/{booking_id}/payments/verify", json={"provider_payment_id": pp, "signature": sig}, headers=auth(token))
    assert ver.status_code == 200 and ver.json()["booking_status"] == "CONFIRMED"

    notifs = client.get("/notifications", headers=auth(token))
    assert notifs.status_code == 200
    types = [n["type"] for n in notifs.json()["notifications"]]
    assert "PAYMENT_SUCCESS" in types
    assert "BOOKING_CONFIRMED" in types
