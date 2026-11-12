import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware

from Middleware.jwtVerify import verify_jwt


load_dotenv()


SESSION_SECRET = os.getenv("SESSION_SECRET", os.environ["JWT_SECRET"])

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

OWNER_FRONTEND_URL = os.getenv("OWNER_FRONTEND_URL", "http://localhost:5174")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Domain-module startup hooks (e.g. seed_admin) will be added in later stages.
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


@app.get("/")
def home():

    return {
        "message": "MoviePass API is running"
    }
