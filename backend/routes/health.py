"""Health check endpoint."""

from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
def health_check():
    """Report that the API process is responding."""
    return {"status": "ok"}
