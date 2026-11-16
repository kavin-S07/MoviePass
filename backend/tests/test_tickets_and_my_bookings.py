import os
from datetime import date, time, timedelta, datetime, timezone

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


def seed_base(show_date=None, show_time=None):
    if show_date is None:
        show_date = date.today() + timedelta(days=2)
    if show_time is None:
        show_time = time(18, 0)
    db = TestingSessionLocal()
    try:
        owner = User(name="Owner", email="owner-t7@example.com", password=hash_password("Password123"), role="THEATRE_OWNER", phone_no="8888888801", approval_status="APPROVED")
        b1 = User(name="Booker1", email="b1-t7@example.com", password=hash_password("Password123"), role="TICKET_BOOKER", phone_no="7777777701", approval_status="APPROVED")
        b2 = User(name="Booker2", email="b2-t7@example.com", password=hash_password("Password123"), role="TICKET_BOOKER", phone_no="7777777702", approval_status="APPROVED")
        admin = User(name="Admin", email="admin-t7@example.com", password=hash_password("Password123"), role="ADMIN", phone_no="6666666601", approval_status="APPROVED")
        db.add_all([owner, b1, b2, admin]); db.flush()
        movie = Movie(movie_name="Ticket Movie", language="English", genre="Drama", certification="UA", release_date=date.today()-timedelta(days=1))
        db.add(movie); db.flush()
        theatre = Theatre(owner_id=owner.id, name="Ticket Theatre", address="123 Main St", city="TestCity", state="TS", status="ACTIVE")
        db.add(theatre); db.flush()
        screen = Screen(theatre_id=theatre.theatre_id, screen_name="Screen A", screen_number=1, no_of_rows=1, no_of_columns=3, has_categories=False, default_price=120.00, status="ACTIVE")
        db.add(screen); db.flush()
        seats = [Seat(screen_id=screen.screen_id, seat_name=f"A{i}", row_number=1, column_number=i, is_active=True) for i in range(1,4)]
        db.add_all(seats); db.flush()
        show = Show(movie_id=movie.movie_id, screen_id=screen.screen_id, show_date=show_date, start_time=show_time, end_time=(datetime.combine(date.today(), show_time)+timedelta(hours=2)).time(), status="scheduled")
        db.add(show); db.commit()
        return {"show_id": show.show_id, "seat_ids": [s.seat_id for s in seats], "b1": b1.email, "b2": b2.email, "owner": owner.email, "admin": admin.email}
    finally:
        db.close()


def confirm_booking(show_id, seat_ids, user_email):
    token = login(user_email)
    lock = client.post(f"/bookings/shows/{show_id}/locks", json={"seat_ids": seat_ids}, headers=auth_header(token))
    assert lock.status_code == 201, lock.text
    lock_token = lock.json()["lock_token"]
    chk = client.post("/bookings/checkout", json={"lock_token": lock_token}, headers=auth_header(token))
    assert chk.status_code == 201, chk.text
    booking_id = chk.json()["booking_id"]
    order_id = chk.json()["payment"]["provider_order_id"]
    provider = get_payment_provider()
    pp_id = f"sandbox_pay_{os.urandom(4).hex()}"
    sig = provider.make_client_signature(order_id, pp_id)
    ver = client.post(f"/bookings/{booking_id}/payments/verify", json={"provider_payment_id": pp_id, "signature": sig}, headers=auth_header(token))
    assert ver.status_code == 200, ver.text
    assert ver.json()["booking_status"] == "CONFIRMED"
    return token, booking_id


def test_ticket_generation_qr_and_retrieve_and_download_and_ownership():
    reset_db()
    data = seed_base()
    token1, booking_id = confirm_booking(data["show_id"], data["seat_ids"][:2], data["b1"])
    token2 = login(data["b2"])

    # ticket retrieval/generation for owner
    t = client.get(f"/bookings/{booking_id}/ticket", headers=auth_header(token1))
    assert t.status_code == 200, t.text
    ticket = t.json()["ticket"]
    assert ticket["booking_reference"]
    assert ticket["ticket_reference"].startswith("TK")
    assert ticket["qr_code_identifier"].startswith("TQR_")
    assert len(ticket["qr_code_identifier"]) >= 20
    assert ticket["ticket_status"] in ("ISSUED", "EXPIRED")
    assert ticket["movie_name"] == "Ticket Movie"
    assert ticket["theatre_name"] == "Ticket Theatre"
    assert ticket["screen_name"] == "Screen A"
    assert len(ticket["seat_numbers"]) == 2
    assert ticket["total_amount"] > 0

    # duplicate retrieve does not create duplicates
    t2 = client.get(f"/bookings/{booking_id}/ticket", headers=auth_header(token1))
    assert t2.status_code == 200
    assert t2.json()["ticket"]["ticket_reference"] == ticket["ticket_reference"]
    db = TestingSessionLocal()
    try:
        assert db.query(Ticket).filter(Ticket.booking_id == booking_id).count() == 1
    finally:
        db.close()

    # download ticket data endpoint
    d = client.get(f"/bookings/{booking_id}/ticket/download", headers=auth_header(token1))
    assert d.status_code == 200, d.text
    assert d.json()["ticket"]["qr_code_identifier"] == ticket["qr_code_identifier"]

    # booking ownership enforcement
    assert client.get(f"/bookings/{booking_id}/ticket", headers=auth_header(token2)).status_code == 404
    assert client.get(f"/bookings/{booking_id}/details", headers=auth_header(token2)).status_code == 404


def test_ticket_verification_valid_invalid_cancelled_and_redemption():
    reset_db()
    data = seed_base()
    user_token, booking_id = confirm_booking(data["show_id"], data["seat_ids"][:1], data["b1"])
    owner_token = login(data["owner"])
    ticket = client.get(f"/bookings/{booking_id}/ticket", headers=auth_header(user_token)).json()["ticket"]
    qr = ticket["qr_code_identifier"]

    # owner (ticket booker) can verify own ticket but cannot redeem
    own_verify = client.post("/bookings/tickets/verify", json={"qr_code_identifier": qr, "redeem": False}, headers=auth_header(user_token))
    assert own_verify.status_code == 200, own_verify.text
    assert own_verify.json()["valid"] is True
    assert own_verify.json()["status"] == "VALID"

    cannot_redeem = client.post("/bookings/tickets/verify", json={"qr_code_identifier": qr, "redeem": True}, headers=auth_header(user_token))
    assert cannot_redeem.status_code == 403

    # staff can redeem/check-in once
    redeem = client.post("/bookings/tickets/verify", json={"qr_code_identifier": qr, "redeem": True}, headers=auth_header(owner_token))
    assert redeem.status_code == 200, redeem.text
    assert redeem.json()["valid"] is True
    assert redeem.json()["status"] == "REDEEMED"
    again = client.post("/bookings/tickets/verify", json={"qr_code_identifier": qr, "redeem": True}, headers=auth_header(owner_token))
    assert again.status_code == 200
    assert again.json()["valid"] is False
    assert again.json()["status"] in ("ALREADY_USED", "INVALID", "EXPIRED")

    # invalid ticket
    invalid = client.post("/bookings/tickets/verify", json={"qr_code_identifier": "TQR_invalid_does_not_exist"}, headers=auth_header(owner_token))
    assert invalid.status_code == 200
    assert invalid.json()["valid"] is False

    # cancelled booking/ticket handling
    reset_db()
    data2 = seed_base()
    user_token2, booking_id2 = confirm_booking(data2["show_id"], data2["seat_ids"][:1], data2["b1"])
    owner_token2 = login(data2["owner"])
    qr2 = client.get(f"/bookings/{booking_id2}/ticket", headers=auth_header(user_token2)).json()["ticket"]["qr_code_identifier"]
    db = TestingSessionLocal()
    try:
        b = db.query(Booking).filter(Booking.booking_id == booking_id2).first()
        b.booking_status = "CANCELLED"
        db.commit()
    finally:
        db.close()
    v = client.post("/bookings/tickets/verify", json={"qr_code_identifier": qr2, "redeem": False}, headers=auth_header(owner_token2))
    assert v.status_code == 200
    assert v.json()["valid"] is False
    assert v.json()["status"] in ("CANCELLED", "BOOKING_NOT_CONFIRMED")


def test_my_bookings_upcoming_past_cancelled_filters_and_details():
    reset_db()
    future = seed_base(show_date=date.today()+timedelta(days=3), show_time=time(19,0))
    token_f, future_booking = confirm_booking(future["show_id"], future["seat_ids"][:1], future["b1"])

    # build past and cancelled scenarios for the SAME user (b1-t7@example.com) to be testable; easier to reset+seed but preserve user expectations by reusing emails - so reset fully and seed all-in-one is cleaner
    reset_db()
    db = TestingSessionLocal()
    try:
        owner = User(name="Owner", email="owner-t7@example.com", password=hash_password("Password123"), role="THEATRE_OWNER", phone_no="8888888801", approval_status="APPROVED")
        b1 = User(name="Booker1", email="b1-t7@example.com", password=hash_password("Password123"), role="TICKET_BOOKER", phone_no="7777777701", approval_status="APPROVED")
        db.add_all([owner, b1]); db.flush()
        movie = Movie(movie_name="Ticket Movie", language="English", genre="Drama", certification="UA", release_date=date.today()-timedelta(days=1))
        db.add(movie); db.flush()
        theatre = Theatre(owner_id=owner.id, name="Ticket Theatre", address="123 Main St", city="TestCity", state="TS", status="ACTIVE")
        db.add(theatre); db.flush()
        screen = Screen(theatre_id=theatre.theatre_id, screen_name="Screen A", screen_number=1, no_of_rows=1, no_of_columns=3, has_categories=False, default_price=120.00, status="ACTIVE")
        db.add(screen); db.flush()
        seats = [Seat(screen_id=screen.screen_id, seat_name=f"A{i}", row_number=1, column_number=i, is_active=True) for i in range(1,4)]
        db.add_all(seats); db.flush()
        # future confirmed
        future_show = Show(movie_id=movie.movie_id, screen_id=screen.screen_id, show_date=date.today()+timedelta(days=3), start_time=time(19,0), end_time=time(21,0), status="scheduled")
        db.add(future_show); db.flush()
        fb = Booking(booking_reference="BKFUT0001", user_id=b1.id, show_id=future_show.show_id, booking_status="CONFIRMED", subtotal=120, tax_amount=21.6, convenience_fee=20, total_amount=161.6, currency="INR", confirmed_at=datetime.now(timezone.utc))
        db.add(fb); db.flush()
        db.add(BookingSeat(booking_id=fb.booking_id, show_id=future_show.show_id, seat_id=seats[0].seat_id, user_id=b1.id, seat_name_snapshot=seats[0].seat_name, category_name_snapshot=None, seat_price=120, seat_status="CONFIRMED"))
        db.add(Ticket(booking_id=fb.booking_id, user_id=b1.id, show_id=future_show.show_id, ticket_reference="TKFUT0001", qr_code_identifier="TQR_fut_test_12345678", ticket_status="ISSUED"))
        future_booking_id = fb.booking_id
        # past confirmed
        past_show = Show(movie_id=movie.movie_id, screen_id=screen.screen_id, show_date=date.today()-timedelta(days=2), start_time=time(10,0), end_time=time(12,0), status="scheduled")
        db.add(past_show); db.flush()
        pb = Booking(booking_reference="BKPAST0001", user_id=b1.id, show_id=past_show.show_id, booking_status="CONFIRMED", subtotal=120, tax_amount=21.6, convenience_fee=20, total_amount=161.6, currency="INR", confirmed_at=datetime.now(timezone.utc))
        db.add(pb); db.flush()
        db.add(BookingSeat(booking_id=pb.booking_id, show_id=past_show.show_id, seat_id=seats[1].seat_id, user_id=b1.id, seat_name_snapshot=seats[1].seat_name, category_name_snapshot=None, seat_price=120, seat_status="CONFIRMED"))
        db.add(Ticket(booking_id=pb.booking_id, user_id=b1.id, show_id=past_show.show_id, ticket_reference="TKPAST0001", qr_code_identifier="TQR_past_test_12345678", ticket_status="ISSUED"))
        past_booking_id = pb.booking_id
        # cancelled
        canc_show = Show(movie_id=movie.movie_id, screen_id=screen.screen_id, show_date=date.today()+timedelta(days=4), start_time=time(20,0), end_time=time(22,0), status="scheduled")
        db.add(canc_show); db.flush()
        cb = Booking(booking_reference="BKCANC0001", user_id=b1.id, show_id=canc_show.show_id, booking_status="CANCELLED", subtotal=120, tax_amount=21.6, convenience_fee=20, total_amount=161.6, currency="INR", cancelled_at=datetime.now(timezone.utc))
        db.add(cb)
        db.commit()
        cancelled_booking_id = cb.booking_id
    finally:
        db.close()

    token_f = login("b1-t7@example.com")
    my = client.get("/bookings/my", headers=auth_header(token_f))
    assert my.status_code == 200, my.text
    body = my.json()
    assert any(b["booking_id"] == future_booking_id for b in body["upcoming"])
    assert any(b["booking_id"] == past_booking_id for b in body["past"])
    assert any(b["booking_id"] == cancelled_booking_id for b in body["cancelled"])

    det = client.get(f"/bookings/{future_booking_id}/details", headers=auth_header(token_f))
    assert det.status_code == 200, det.text
    assert det.json()["booking_reference"]


def test_failed_payment_booking_has_no_valid_ticket():
    reset_db()
    data = seed_base()
    token = login(data["b1"])
    lock_token = client.post(f"/bookings/shows/{data['show_id']}/locks", json={"seat_ids": data["seat_ids"][:1]}, headers=auth_header(token)).json()["lock_token"]
    booking_id = client.post("/bookings/checkout", json={"lock_token": lock_token}, headers=auth_header(token)).json()["booking_id"]
    # mark failed without confirmation
    db = TestingSessionLocal()
    try:
        b = db.query(Booking).filter(Booking.booking_id == booking_id).first()
        b.booking_status = "FAILED"
        db.commit()
    finally:
        db.close()
    r = client.get(f"/bookings/{booking_id}/ticket", headers=auth_header(token))
    assert r.status_code == 400
