"""
UrbanTrack AI — FastAPI Application Entrypoint
Provides REST APIs and serves static files / video outputs.
"""

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path
import os
from app.routers import api, auth
from app.routers.auth import get_session_username

app = FastAPI(
    title="UrbanTrack AI — Dashboard API",
    description="Multi-Camera Vehicle Intelligence System Application Layer",
    version="1.0.0"
)

# Enable CORS for Next.js frontend dev and prod
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in os.getenv("URBANTRACK_ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",") if origin.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(api.router)


@app.middleware("http")
async def require_dashboard_session(request: Request, call_next):
    """Protect API/data resources; leave sign-in endpoints and preflight requests public."""
    path = request.url.path
    if request.method == "OPTIONS":
        return await call_next(request)
    protected = path.startswith("/api/") or path.startswith("/data/")
    public_auth = path.startswith("/api/auth/")
    if protected and not public_auth and not get_session_username(request.cookies.get("urbantrack_session")):
        return JSONResponse(status_code=401, content={"detail": "Sign in required."})
    return await call_next(request)

# Serve video and data files if directory exists
project_root = Path(__file__).resolve().parent.parent
data_dir = project_root / "data"
if data_dir.exists():
    app.mount("/data", StaticFiles(directory=str(data_dir)), name="data")


@app.get("/")
def root():
    return {
        "system": "UrbanTrack AI",
        "role": "Member 3 Dashboard Backend",
        "docs": "/docs",
        "api_status": "/api/status"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
