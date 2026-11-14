"""FastAPI application entry point for CivicSathi AI."""

from pathlib import Path
import logging
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from database import Base, engine
import models  # Import models so SQLAlchemy knows which tables to create.
from routes.health import router as health_router
from routes.reports import router as reports_router
from routes.admin import router as admin_router
from routes.understand_text import router as understand_text_router

BACKEND_DIR = Path(__file__).resolve().parent
UPLOADS_DIR = BACKEND_DIR / "uploads"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="CivicSathi AI API")
logger = logging.getLogger(__name__)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_origin_regex=(
        r"^http://(?:localhost|127\.0\.0\.1|10(?:\.\d{1,3}){3}|"
        r"192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2}):5173$"
    ),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(reports_router)
app.include_router(admin_router)
app.include_router(understand_text_router)
app.mount("/uploads", StaticFiles(directory=UPLOADS_DIR), name="uploads")


@app.on_event("startup")
def create_tables_and_uploads_folder():
    """Create the upload directory and any missing database tables at startup."""
    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    Base.metadata.create_all(bind=engine)
    if not os.getenv("ROBOFLOW_API_KEY"):
        logger.warning("ROBOFLOW_API_KEY is not configured; image detection will use manual categories")
    if not os.getenv("GEMINI_API_KEY"):
        logger.warning("GEMINI_API_KEY is not configured; text understanding is unavailable")
