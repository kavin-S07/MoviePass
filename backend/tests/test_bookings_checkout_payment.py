import json
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
os.environ.setdefault("SEAT_LOCK_TTL_MINUTES", "5")
os.environ.setdefault("PAYMENT_PROVIDER", "sandbox")
os.environ.setdefault("PAYMENT_SANDBOX_SECRET", "test-sandbox-secret")
os.environ.setdefault("SEED_DEFAULT_ADMIN", "false")
os.environ.setdefault(
    "DATABASE_URL",
    os.getenv("TEST_DATABASE_URL", "postgresql+psycopg://postgres:1234@127.0.0.1:5432/moviepass_test"),
)

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import main
from config.database import Base, get_db
from config.Jwt import hash_password
from Modules.Auth.Model import User
from Modules.Bookings.Model import Booking, BookingSeat, Payment, SeatLock, Ticket
from Modules.Bookings.Payments import get_payment_provider
from Modules.Theatres.Model import Movie, Screen, Seat, Show, Theatre


TEST_DATABASE_URL = os.getenv(
    "TEST_DATABASE_URL",
    "postgresql+psycopg://postgres:1234@127.0.0.1:5432/moviepass_test",
)
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


def auth_header(token: str):
    return {"Authorization": f"Bearer {token}"}


def login(email, password="Password123"):
    res = client.post("/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200, res.text
    return res.json()["access_token"]


def seed_checkout_data():
    db = TestingSessionLocal()
    try:
        owner = User(
            name="Owner User",
            email="owner-stage6@example.com",
            password=hash_password("Password123"),
            role="THEATRE_OWNER",
            phone_no="8888888801",
            approval_status="APPROVED",
        )
        b1 = User(
            name="Booker One",
            email="b1-stage6@example.com",
            password=hash_password("Password123"),
            role="TICKET_BOOKER",
            phone_no="7777777701",
            approval_status="APPROVED",
        )
        b2 = User(
            name="Booker Two",
            email="b2-stage6@example.com",
            password=hash_password("Password123"),
            role="TICKET_BOOKER",
            phone_no="7777777702",
            approval_status="APPROVED",
        )
        db.add_all([owner, b1, b2])
        db.flush()

        movie = Movie(
            movie_name="Checkout Test Movie",
            language="English",
            genre="Action",
            certification="UA",
            release_date=date.today() - timedelta(days=1),
        )
        db.add(movie)
        db.flush()

        theatre = Theatre(
            owner_id=owner.id,
            name="Checkout Theatre",
            address="Main Road",
            city="TestCity",
            state="TS",
            status="ACTIVE",
        )
        db.add(theatre)
        db.flush()

        screen = Screen(
            theatre_id=theatre.theatre_id,
            screen_name="Screen 1",
            screen_number=1,
            no_of_rows=2,
            no_of_columns=3,
            has_categories=False,
            default_price=100.00,
            status="ACTIVE",
            layout_config={"rows": ["A", "B"], "cols": [1, 2, 3]},
        )
        db.add(screen)
        db.flush()

        seats = []
        sid = 1
        for r in range(1, 3):
            for c in range(1, 4):
                seats.append(
                    Seat(
                        screen_id=screen.screen_id,
                        seat_name=f"S{sid}",
                        row_number=r,
                        column_number=c,
                        is_active=True,
                    )
                )
                sid += 1
        db.add_all(seats)
        db.flush()

        show = Show(
            movie_id=movie.movie_id,
            screen_id=screen.screen_id,
            show_date=date.today() + timedelta(days=2),
            start_time=time(18, 0),
            end_time=time(20, 30),
            status="scheduled",
        )
        db.add(show)
        db.commit()

        return {
            "show_id": show.show_id,
            "seat_ids": [s.seat_id for s in seats],
            "b1_email": b1.email,
        }
    finally:
        db.close()


def lock_seats(show_id, seat_ids, token):
    return client.post(f"/bookings/shows/{show_id}/locks", json={"seat_ids": seat_ids}, headers=auth_header(token))


def checkout(lock_token, token):
    return client.post("/bookings/checkout", json={"lock_token": lock_token}, headers=auth_header(token))


def test_successful_sandbox_payment_and_confirmation():
    reset_db()
    data = seed_checkout_data()
    token = login(data["b1_email"])

    lock_res = lock_seats(data["show_id"], data["seat_ids"][:2], token)
    assert lock_res.status_code == 201, lock_res.text
    lock_token = lock_res.json()["lock_token"]

    chk = checkout(lock_token, token)
    assert chk.status_code == 201, chk.text
    body = chk.json()
    booking_id = body["booking_id"]
    provider_order_id = body["payment"]["provider_order_id"]
    assert body["booking_status"] in ("PENDING_PAYMENT", "PAYMENT_PENDING")
    assert body["ticket_subtotal"] > 0
    assert body["total_payable_amount"] >= body["ticket_subtotal"]

    provider = get_payment_provider()
    pp_id = "sandbox_pay_success1"
    sig = provider.make_client_signature(provider_order_id, pp_id)
    ver = client.post(
        f"/bookings/{booking_id}/payments/verify",
        json={"provider_payment_id": pp_id, "signature": sig},
        headers=auth_header(token),
    )
    assert ver.status_code == 200, ver.text
    v = ver.json()
    assert v["booking_status"] == "CONFIRMED"
    assert v["payment_status"] == "CAPTURED"

    st = client.get(f"/bookings/{booking_id}", headers=auth_header(token))
    assert st.status_code == 200
    assert st.json()["booking_status"] == "CONFIRMED"

    db = TestingSessionLocal()
    try:
        assert db.query(Booking).filter(Booking.booking_id == booking_id, Booking.booking_status == "CONFIRMED").count() == 1
        assert db.query(Payment).filter(Payment.booking_id == booking_id, Payment.payment_status == "CAPTURED").count() >= 1
        assert db.query(BookingSeat).filter(BookingSeat.booking_id == booking_id, BookingSeat.seat_status == "CONFIRMED").count() == 2
        assert db.query(SeatLock).filter(SeatLock.booking_id == booking_id, SeatLock.lock_status == "CONVERTED").count() == 2
        assert db.query(Ticket).filter(Ticket.booking_id == booking_id).count() == 1
    finally:
        db.close()


def test_failed_payment_invalid_signature_and_retry():
    reset_db()
    data = seed_checkout_data()
    token = login(data["b1_email"])

    lock_token = lock_seats(data["show_id"], data["seat_ids"][:1], token).json()["lock_token"]
    chk = checkout(lock_token, token)
    assert chk.status_code == 201, chk.text
    booking_id = chk.json()["booking_id"]
    provider_order_id = chk.json()["payment"]["provider_order_id"]

    bad = client.post(
        f"/bookings/{booking_id}/payments/verify",
        json={"provider_payment_id": "sandbox_pay_bad", "signature": "invalidsig"},
        headers=auth_header(token),
    )
    assert bad.status_code == 200, bad.text
    assert bad.json()["payment_status"] == "FAILED"
    assert bad.json()["booking_status"] in ("FAILED", "PAYMENT_FAILED")

    retry = client.post(f"/bookings/{booking_id}/payments/retry", headers=auth_header(token))
    assert retry.status_code == 200, retry.text
    assert retry.json()["payment_status"] == "INITIATED"
    order_id = retry.json().get("provider_order_id") or provider_order_id

    provider = get_payment_provider()
    pp_id = "sandbox_pay_retry_ok"
    sig = provider.make_client_signature(order_id, pp_id)
    ok = client.post(
        f"/bookings/{booking_id}/payments/verify",
        json={"provider_payment_id": pp_id, "signature": sig},
        headers=auth_header(token),
    )
    assert ok.status_code == 200, ok.text
    assert ok.json()["booking_status"] == "CONFIRMED"


def test_expired_lock_checkout_and_duplicate_booking_request_idempotent():
    reset_db()
    data = seed_checkout_data()
    token = login(data["b1_email"])

    lock_token = lock_seats(data["show_id"], data["seat_ids"][:1], token).json()["lock_token"]

    # expire lock while respecting ck_seat_locks_expiry (expires_at > locked_at)
    db = TestingSessionLocal()
    try:
        locks = db.query(SeatLock).filter(SeatLock.lock_token == lock_token).all()
        assert locks
        for l in locks:
            l.locked_at = l.locked_at - timedelta(minutes=10)
            l.expires_at = l.locked_at + timedelta(seconds=1)
            l.lock_status = "ACTIVE"
        db.commit()
    finally:
        db.close()

    res = checkout(lock_token, token)
    assert res.status_code == 400

    # fresh lock for duplicate checkout idempotency
    lock_token2 = lock_seats(data["show_id"], data["seat_ids"][:1], token).json()["lock_token"]
    c1 = checkout(lock_token2, token)
    assert c1.status_code == 201, c1.text
    c2 = checkout(lock_token2, token)
    assert c2.status_code == 201, c2.text
    assert c1.json()["booking_id"] == c2.json()["booking_id"]
    assert c1.json()["payment"]["provider_order_id"] == c2.json()["payment"]["provider_order_id"]
