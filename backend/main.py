import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware

from Middleware.jwtVerify import verify_jwt
from Modules.Auth.Controller import router as auth_router
from Modules.Theatres.Controller import router as theatre_router
from Modules.Screens.Controller import router as screen_router
from Modules.Movies.Controller import router as movies_router
from Modules.Shows.Controller import router as shows_router
from Modules.Auth.Model import User
from config.database import SessionLocal
from config.Jwt import hash_password


load_dotenv()


SESSION_SECRET = os.getenv("SESSION_SECRET", os.environ["JWT_SECRET"])

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

OWNER_FRONTEND_URL = os.getenv("OWNER_FRONTEND_URL", "http://localhost:5174")


# Create the default Admin account once, if it does not exist
def seed_admin():

    db = SessionLocal()

    try:

        admin_email = "admin@moviepass.com"

        existing = db.query(User).filter(
            User.email == admin_email
        ).first()

        if existing:

            return

        hashed = hash_password("Adminmoviepass")

        admin = User(
            name="Admin",
            email=admin_email,
            password=hashed,
            role="ADMIN",
            phone_no=None,
            approval_status="APPROVED"
        )

        db.add(admin)

        db.commit()

    finally:

        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):

    seed_admin()

    yield


app = FastAPI(
    lifespan=lifespan
)


# Session cookie, required by Authlib to verify the OAuth state
app.add_middleware(
    SessionMiddleware,
    secret_key=SESSION_SECRET,
    session_cookie="moviepass_session",
    same_site="lax",
    https_only=FRONTEND_URL.startswith("https://")
)

app.middleware("http")(verify_jwt)


# One origin per frontend application
origins = [
    FRONTEND_URL,
    OWNER_FRONTEND_URL
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin for origin in origins if origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)


app.include_router(auth_router)
app.include_router(theatre_router)
app.include_router(screen_router)
app.include_router(movies_router)
app.include_router(shows_router)


@app.get("/")
def home():

    return {
        "message": "MoviePass API is running"
    }
