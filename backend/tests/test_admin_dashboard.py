import os

os.environ.setdefault("JWT_SECRET", "test-jwt-secret")
os.environ.setdefault("JWT_REFRESH_SECRET", "test-jwt-refresh-secret")
os.environ.setdefault("JWT_EXPIRES_IN", "15m")
os.environ.setdefault("JWT_REFRESH_EXPIRES_IN", "7d")
os.environ.setdefault("SESSION_SECRET", "test-session-secret")
os.environ.setdefault("FRONTEND_URL", "http://localhost:5173")
os.environ.setdefault("OWNER_FRONTEND_URL", "http://localhost:5174")
os.environ.setdefault("ENVIRONMENT", "development")
os.environ.setdefault(
    "DATABASE_URL",
    os.getenv("TEST_DATABASE_URL", "postgresql+psycopg://postgres:1234@127.0.0.1:5432/moviepass_test"),
)
os.environ.setdefault("SEED_DEFAULT_ADMIN", "false")

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

import main
from config.Jwt import hash_password
from config.database import Base, get_db
from Modules.Auth.Model import User

TEST_DATABASE_URL = os.getenv(
    "TEST_DATABASE_URL",
    "postgresql+psycopg://postgres:1234@127.0.0.1:5432/moviepass_test",
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


def reset_db():
    with engine.begin() as conn:
        for table in ["refresh_sessions", "social_accounts", "shows", "seats", "seat_categories", "screens", "theatres", "movies", "users"]:
            try:
                conn.execute(text(f"DELETE FROM {table}"))
            except Exception:
                pass


def seed_admin(email="admin@test.local", password="Adminpass1"):
    db = TestingSessionLocal()
    try:
        admin = User(
            name="Admin",
            email=email,
            password=hash_password(password),
            role="ADMIN",
            phone_no=None,
            approval_status="APPROVED",
        )
        db.add(admin)
        db.commit()
    finally:
        db.close()
    return email, password


def login(email, password):
    res = client.post("/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200, res.text
    return res.json()["access_token"]


def test_admin_overview_requires_admin():
    reset_db()
    # create normal booker
    res = client.post("/auth/signup", json={"name": "Booker", "email": "b@test.local", "password": "password123", "phone_no": "1234567890"})
    assert res.status_code == 201
    token = res.json()["access_token"]
    r = client.get("/admin/overview", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 403


def test_admin_overview_and_users_as_admin():
    reset_db()
    email, password = seed_admin()
    # add pending owner
    db = TestingSessionLocal()
    try:
        owner = User(name="Owner", email="o@test.local", password=hash_password("password123"), role="THEATRE_OWNER", phone_no="9999999999", approval_status="PENDING")
        db.add(owner)
        db.commit()
    finally:
        db.close()

    token = login(email, password)
    r = client.get("/admin/overview", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200, r.text
    data = r.json()
    assert "summary" in data
    assert data["summary"]["pending_owner_approvals"] >= 1

    r2 = client.get("/admin/users?page=1&page_size=10", headers={"Authorization": f"Bearer {token}"})
    assert r2.status_code == 200, r2.text
    users = r2.json()
    assert users["total"] >= 2
    assert "items" in users
