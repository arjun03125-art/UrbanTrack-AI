"""Minimal environment-configured session auth for the UrbanTrack AI demo.

For production deployments, replace the single-account demo setup with a user store,
password hashing, rate limiting, and a managed secret.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import os
import time
from typing import Optional

from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel, Field

COOKIE_NAME = "urbantrack_session"
SESSION_TTL_SECONDS = int(os.getenv("URBANTRACK_SESSION_TTL_SECONDS", str(8 * 60 * 60)))
SESSION_SECRET = os.getenv(
    "URBANTRACK_SESSION_SECRET",
    "local-demo-only-change-this-secret-before-deployment",
).encode("utf-8")

DEMO_USERNAME = os.getenv("URBANTRACK_ADMIN_USERNAME", "admin")
DEMO_PASSWORD = os.getenv("URBANTRACK_ADMIN_PASSWORD", "UrbanTrack@2026!")

router = APIRouter(prefix="/api/auth", tags=["authentication"])


class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=100)
    password: str = Field(min_length=1, max_length=200)


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("ascii").rstrip("=")


def _unb64(value: str) -> bytes:
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))


def create_session_token(username: str, expires_at: int) -> str:
    payload = _b64(f"{username}|{expires_at}".encode("utf-8"))
    signature = _b64(hmac.new(SESSION_SECRET, payload.encode("ascii"), hashlib.sha256).digest())
    return f"{payload}.{signature}"


def get_session_username(token: Optional[str]) -> Optional[str]:
    if not token:
        return None
    try:
        payload, signature = token.rsplit(".", 1)
        expected = _b64(hmac.new(SESSION_SECRET, payload.encode("ascii"), hashlib.sha256).digest())
        if not hmac.compare_digest(signature, expected):
            return None
        username, expiry = _unb64(payload).decode("utf-8").rsplit("|", 1)
        if int(expiry) <= int(time.time()):
            return None
        return username
    except (ValueError, UnicodeDecodeError, TypeError):
        return None


def authenticated_username(request: Request) -> Optional[str]:
    return get_session_username(request.cookies.get(COOKIE_NAME))


@router.post("/login")
def login(body: LoginRequest, response: Response):
    username_ok = hmac.compare_digest(body.username.strip(), DEMO_USERNAME)
    password_ok = hmac.compare_digest(body.password, DEMO_PASSWORD)
    if not (username_ok and password_ok):
        # Keep the message generic so the endpoint does not reveal which field failed.
        raise HTTPException(status_code=401, detail="Invalid username or password.")

    expires_at = int(time.time()) + SESSION_TTL_SECONDS
    response.set_cookie(
        key=COOKIE_NAME,
        value=create_session_token(DEMO_USERNAME, expires_at),
        max_age=SESSION_TTL_SECONDS,
        httponly=True,
        secure=os.getenv("URBANTRACK_COOKIE_SECURE", "0").lower() in {"1", "true", "yes"},
        samesite="lax",
        path="/",
    )
    return {"authenticated": True, "username": DEMO_USERNAME, "expires_at": expires_at}


@router.get("/me")
def me(request: Request):
    username = authenticated_username(request)
    if not username:
        raise HTTPException(status_code=401, detail="Sign in required.")
    return {"authenticated": True, "username": username}


@router.post("/logout")
def logout(response: Response):
    response.delete_cookie(
        key=COOKIE_NAME,
        path="/",
        httponly=True,
        secure=os.getenv("URBANTRACK_COOKIE_SECURE", "0").lower() in {"1", "true", "yes"},
        samesite="lax",
    )
    return {"authenticated": False}
