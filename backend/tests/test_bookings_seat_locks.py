import os
import threading
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal

os.environ.setdefault("JWT_SECRET", "test-jwt-secret")
os.environ.setdefault("JWT_REFRESH_SECRET", "test-jwt-refresh-secret")
os.environ.setdefault("JWT_EXPIRES_IN", "15m")
os.environ.setdefault("JWT_REFRESH_EXPIRES_IN", "7d")
os.environ.setdefault("SESSION_SECRET", "test-session-secret")
os.environ.setdefault("FRONTEND_URL", "http://localhost:5173")
os.environ.setdefault("OWNER_FRONTEND_URL", "http://localhost:5174")
os.environ.setdefault("ENVIRONMENT", "development")
os.environ.setdefault("SEAT_LOCK_TTL_MINUTES", "5")
os.environ.setdefault(
    "DATABASE_URL",
    os.getenv("TEST_DATABASE_URL", "postgresql+psycopg://postgres:1234@127.0.0.1:5432/moviepass_test"),
)
os.environ.setdefault("SEED_DEFAULT_ADMIN", "false")

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

import main
from config.database import Base, get_db
from config.Jwt import hash_password
from Modules.Auth.Model import RefreshSession, SocialAccount, User
from Modules.Bookings.Model import Booking, BookingSeat, Payment, SeatLock, Ticket
from Modules.Theatres.Model import Movie, Screen, Seat, SeatCategory, Show, Theatre


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
    # Drop/create all tables for isolated, schema-correct test DB (including booking tables)
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)


def auth_header(token: str):
    return {"Authorization": f"Bearer {token}"}


def create_user(name, email, role="TICKET_BOOKER", approval="APPROVED", password="Password123"):
    db = TestingSessionLocal()
    try:
        user = User(
            name=name,
            email=email,
            password=hash_password(password),
            role=role,
            phone_no="9999999999",
            approval_status=approval,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user
    finally:
        db.close()


def login(email, password="Password123"):
    res = client.post("/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200, res.text
    return res.json()["access_token"]


def seed_show_data():
    db = TestingSessionLocal()
    try:
        owner = User(
            name="Owner",
            email="owner@example.com",
            password=hash_password("Password123"),
            role="THEATRE_OWNER",
            phone_no="8888888888",
            approval_status="APPROVED",
        )
        booker1 = User(
            name="Booker1",
            email="booker1@example.com",
            password=hash_password("Password123"),
            role="TICKET_BOOKER",
            phone_no="7777777771",
            approval_status="APPROVED",
        )
        booker2 = User(
            name="Booker2",
            email="booker2@example.com",
            password=hash_password("Password123"),
            role="TICKET_BOOKER",
            phone_no="7777777772",
            approval_status="APPROVED",
        )
        db.add_all([owner, booker1, booker2])
        db.flush()

        movie = Movie(movie_name="Test Movie", language="English", genre="Action", certification="UA")
        db.add(movie)
        db.flush()

        theatre = Theatre(
            owner_id=owner.id,
            name="Test Theatre",
            address="123 Test St",
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
            no_of_rows=5,
            no_of_columns=5,
            has_categories=True,
            default_price=Decimal("100.00"),
            status="ACTIVE",
            layout_config={"row_labels": ["A", "B", "C", "D", "E"], "column_labels": [1, 2, 3, 4, 5], "row_gaps": [], "column_gaps": []},
        )
        db.add(screen)
        db.flush()

        cat = SeatCategory(screen_id=screen.screen_id, category_name="Gold", price=Decimal("150.00"), color="#FFD700")
        db.add(cat)
        db.flush()

        seats = []
        for r in range(1, 4):
            for c in range(1, 4):
                seats.append(
                    Seat(
                        screen_id=screen.screen_id,
                        category_id=cat.category_id,
                        seat_name=f"R{r}C{c}",
                        row_number=r,
                        column_number=c,
                        is_active=True,
                    )
                )
        # one inactive seat
        seats.append(
            Seat(
                screen_id=screen.screen_id,
                category_id=cat.category_id,
                seat_name="R9C9",
                row_number=9,
                column_number=9,
                is_active=False,
            )
        )
        db.add_all(seats)
        db.flush()

        show = Show(
            screen_id=screen.screen_id,
            movie_id=movie.movie_id,
            show_date=date.today() + timedelta(days=1),
            start_time=time(18, 0),
            end_time=time(20, 30),
            status="Scheduled",
        )
        db.add(show)
        db.flush()

        # second screen/show for invalid-combination tests
        screen2 = Screen(
            theatre_id=theatre.theatre_id,
            screen_name="Screen 2",
            screen_number=2,
            no_of_rows=3,
            no_of_columns=3,
            has_categories=False,
            default_price=Decimal("120.00"),
            status="ACTIVE",
            layout_config={},
        )
        db.add(screen2)
        db.flush()
        seat_s2 = Seat(screen_id=screen2.screen_id, category_id=None, seat_name="S2A1", row_number=1, column_number=1, is_active=True)
        db.add(seat_s2)
        db.flush()
        show2 = Show(
            screen_id=screen2.screen_id,
            movie_id=movie.movie_id,
            show_date=date.today() + timedelta(days=1),
            start_time=time(21, 0),
            end_time=time(23, 0),
            status="Scheduled",
        )
        db.add(show2)
        db.commit()

        seat_ids = [s.seat_id for s in seats if s.is_active]
        inactive_seat_id = [s.seat_id for s in seats if not s.is_active][0]
        return {
            "show_id": show.show_id,
            "show2_id": show2.show_id,
            "seat_ids": seat_ids,
            "inactive_seat_id": inactive_seat_id,
            "screen2_seat_id": seat_s2.seat_id,
            "booker1_email": booker1.email,
            "booker2_email": booker2.email,
        }
    finally:
        db.close()


def test_available_seats_for_show():
    reset_db()
    data = seed_show_data()
    token = login(data["booker1_email"])

    res = client.get(f"/bookings/shows/{data['show_id']}/seats", headers=auth_header(token))
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["show_id"] == data["show_id"]
    assert body["screen_name"] == "Screen 1"
    assert len(body["seats"]) >= len(data["seat_ids"]) + 1
    statuses = {s["seat_id"]: s["availability_status"] for s in body["seats"]}
    assert statuses[data["seat_ids"][0]] == "AVAILABLE"
    assert statuses[data["inactive_seat_id"]] == "INACTIVE"
    # server-side category price returned
    seat = next(s for s in body["seats"] if s["seat_id"] == data["seat_ids"][0])
    assert seat["category_price"] == 150.0


def test_lock_seats_and_active_locks_reflected():
    reset_db()
    data = seed_show_data()
    token = login(data["booker1_email"])
    target = data["seat_ids"][:2]

    res = client.post(f"/bookings/shows/{data['show_id']}/locks", json={"seat_ids": target}, headers=auth_header(token))
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["show_id"] == data["show_id"]
    assert body["lock_token"]
    assert body["lock_status"] == "ACTIVE"
    assert body["expires_in_seconds"] > 0
    assert len(body["seats"]) == 2
    assert body["subtotal"] == 300.0  # 2 * 150.00 server-calculated

    # availability shows locked by same user
    res2 = client.get(f"/bookings/shows/{data['show_id']}/seats", headers=auth_header(token))
    assert res2.status_code == 200
    statuses = {s["seat_id"]: s["availability_status"] for s in res2.json()["seats"]}
    for sid in target:
        assert statuses[sid] == "LOCKED_BY_YOU"

    # another user sees LOCKED (not by you)
    token2 = login(data["booker2_email"])
    res3 = client.get(f"/bookings/shows/{data['show_id']}/seats", headers=auth_header(token2))
    statuses2 = {s["seat_id"]: s["availability_status"] for s in res3.json()["seats"]}
    for sid in target:
        assert statuses2[sid] == "LOCKED"


def test_already_booked_or_held_seats_rejected():
    reset_db()
    data = seed_show_data()
    token1 = login(data["booker1_email"])
    token2 = login(data["booker2_email"])
    target = [data["seat_ids"][0]]

    r1 = client.post(f"/bookings/shows/{data['show_id']}/locks", json={"seat_ids": target}, headers=auth_header(token1))
    assert r1.status_code == 201, r1.text

    # other user cannot lock same seat
    r2 = client.post(f"/bookings/shows/{data['show_id']}/locks", json={"seat_ids": target}, headers=auth_header(token2))
    assert r2.status_code == 409


def test_expired_locks_can_be_reacquired():
    reset_db()
    data = seed_show_data()
    token1 = login(data["booker1_email"])
    token2 = login(data["booker2_email"])
    target = [data["seat_ids"][1]]

    r1 = client.post(f"/bookings/shows/{data['show_id']}/locks", json={"seat_ids": target}, headers=auth_header(token1))
    assert r1.status_code == 201

    # expire lock in DB while respecting DB constraints (expires_at > locked_at)
    db = TestingSessionLocal()
    try:
        now = datetime.now(timezone.utc)
        lock = db.query(SeatLock).filter(SeatLock.show_id == data["show_id"], SeatLock.seat_id == target[0]).first()
        assert lock is not None
        lock.locked_at = now - timedelta(minutes=10)
        lock.expires_at = now - timedelta(minutes=1)
        db.commit()
    finally:
        db.close()

    # availability/lock flow should expire stale lock and allow another user to lock
    r2 = client.post(f"/bookings/shows/{data['show_id']}/locks", json={"seat_ids": target}, headers=auth_header(token2))
    assert r2.status_code == 201, r2.text
    # seat availability should show locked by user2
    avail = client.get(f"/bookings/shows/{data['show_id']}/seats", headers=auth_header(token2))
    assert avail.status_code == 200
    status_map = {s["seat_id"]: s["availability_status"] for s in avail.json()["seats"]}
    assert status_map[target[0]] == "LOCKED_BY_YOU"


def test_concurrent_lock_attempts_only_one_succeeds():
    reset_db()
    data = seed_show_data()
    token1 = login(data["booker1_email"])
    token2 = login(data["booker2_email"])
    target = [data["seat_ids"][2]]
    results = []

    def attempt(tok):
        res = client.post(f"/bookings/shows/{data['show_id']}/locks", json={"seat_ids": target}, headers=auth_header(tok))
        results.append(res.status_code)

    t1 = threading.Thread(target=attempt, args=(token1,))
    t2 = threading.Thread(target=attempt, args=(token2,))
    t1.start(); t2.start(); t1.join(); t2.join()

    assert sorted(results) == [201, 409], results

    db = TestingSessionLocal()
    try:
        active = db.query(SeatLock).filter(SeatLock.show_id == data["show_id"], SeatLock.seat_id == target[0], SeatLock.lock_status == "ACTIVE").count()
        held = db.query(BookingSeat).filter(BookingSeat.show_id == data["show_id"], BookingSeat.seat_id == target[0], BookingSeat.seat_status == "HELD").count()
        assert active == 1
        assert held == 1
    finally:
        db.close()


def test_lock_release_and_wrong_user_ownership():
    reset_db()
    data = seed_show_data()
    token1 = login(data["booker1_email"])
    token2 = login(data["booker2_email"])
    target = [data["seat_ids"][3]]

    r1 = client.post(f"/bookings/shows/{data['show_id']}/locks", json={"seat_ids": target}, headers=auth_header(token1))
    assert r1.status_code == 201
    lock_token = r1.json()["lock_token"]

    # wrong user cannot release by token
    r_wrong = client.post(
        f"/bookings/shows/{data['show_id']}/locks/release",
        json={"lock_token": lock_token},
        headers=auth_header(token2),
    )
    assert r_wrong.status_code == 404

    # owner releases
    r_rel = client.post(
        f"/bookings/shows/{data['show_id']}/locks/release",
        json={"lock_token": lock_token},
        headers=auth_header(token1),
    )
    assert r_rel.status_code == 200, r_rel.text
    assert r_rel.json()["released_count"] == 1

    # seat becomes available again
    avail = client.get(f"/bookings/shows/{data['show_id']}/seats", headers=auth_header(token1))
    status_map = {s["seat_id"]: s["availability_status"] for s in avail.json()["seats"]}
    assert status_map[target[0]] == "AVAILABLE"


def test_invalid_show_and_seat_combinations_and_inactive_seat():
    reset_db()
    data = seed_show_data()
    token = login(data["booker1_email"])

    # invalid show
    r = client.post("/bookings/shows/999999/locks", json={"seat_ids": [data["seat_ids"][0]]}, headers=auth_header(token))
    assert r.status_code == 404

    # seat from different screen/show
    r2 = client.post(
        f"/bookings/shows/{data['show_id']}/locks",
        json={"seat_ids": [data["screen2_seat_id"]]},
        headers=auth_header(token),
    )
    assert r2.status_code == 400

    # inactive seat
    r3 = client.post(
        f"/bookings/shows/{data['show_id']}/locks",
        json={"seat_ids": [data["inactive_seat_id"]]},
        headers=auth_header(token),
    )
    assert r3.status_code == 409


def test_transaction_rollback_on_partial_invalid_request():
    reset_db()
    data = seed_show_data()
    token = login(data["booker1_email"])
    valid = data["seat_ids"][4]
    invalid_cross_screen = data["screen2_seat_id"]

    before = {}
    db = TestingSessionLocal()
    try:
        before = {
            "bookings": db.query(Booking).count(),
            "booking_seats": db.query(BookingSeat).count(),
            "seat_locks": db.query(SeatLock).count(),
        }
    finally:
        db.close()

    res = client.post(
        f"/bookings/shows/{data['show_id']}/locks",
        json={"seat_ids": [valid, invalid_cross_screen]},
        headers=auth_header(token),
    )
    assert res.status_code == 400

    db = TestingSessionLocal()
    try:
        after = {
            "bookings": db.query(Booking).count(),
            "booking_seats": db.query(BookingSeat).count(),
            "seat_locks": db.query(SeatLock).count(),
        }
        assert after == before
        # valid seat must remain available
        lock_count = db.query(SeatLock).filter(SeatLock.show_id == data["show_id"], SeatLock.seat_id == valid).count()
        assert lock_count == 0
    finally:
        db.close()
