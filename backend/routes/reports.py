"""Endpoints for creating and reading civic issue reports."""

from datetime import datetime
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session

from database import get_db
from models import Report
from services.detector import detect
from services.duplicates import find_duplicate
from services.scoring import compute_priority

router = APIRouter(prefix="/api/reports", tags=["reports"])
UPLOADS_DIR = Path(__file__).resolve().parents[1] / "uploads"
ALLOWED_CATEGORIES = {"pothole", "garbage"}
ALLOWED_STATUSES = {"Reported", "In progress", "Resolved"}


def _report_json(report: Report) -> dict:
    """Convert a database row to a JSON-ready dictionary."""
    return {
        "id": report.id,
        "category": report.category,
        "confidence": report.confidence,
        "bbox": report.bbox,
        "detection_source": report.detection_source,
        "image_path": report.image_path,
        "after_image_path": report.after_image_path,
        "description": report.description,
        "latitude": report.latitude,
        "longitude": report.longitude,
        "priority_score": report.priority_score,
        "score_breakdown": report.score_breakdown,
        "duplicate_of": report.duplicate_of,
        "duplicate_count": report.duplicate_count,
        "status": report.status,
        "assigned_to": report.assigned_to,
        "deadline": report.deadline.isoformat() if report.deadline else None,
        "is_demo_data": report.is_demo_data,
        "created_at": report.created_at.isoformat() if report.created_at else None,
        "updated_at": report.updated_at.isoformat() if report.updated_at else None,
    }


@router.post("")
async def create_report(
    image: UploadFile = File(...),
    latitude: float = Form(...),
    longitude: float = Form(...),
    description: str = Form(""),
    category: str | None = Form(None),
    db: Session = Depends(get_db),
):
    """Save an image, detect its category, check duplicates, and store its score."""
    if not -90 <= latitude <= 90 or not -180 <= longitude <= 180:
        raise HTTPException(status_code=422, detail="Latitude or longitude is out of range")

    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    suffix = Path(image.filename or "").suffix.lower()
    filename = f"{uuid4().hex}{suffix}"
    saved_path = UPLOADS_DIR / filename
    try:
        contents = await image.read()
        if not contents:
            raise HTTPException(status_code=400, detail="Uploaded image is empty")
        saved_path.write_bytes(contents)
    finally:
        await image.close()

    detection = detect(str(saved_path))
    detection_source = detection.get("source", "manual")
    detected_category = detection.get("category", "none")

    if detection_source == "ai" and detected_category in ALLOWED_CATEGORIES:
        report_category = detected_category
    else:
        if category not in ALLOWED_CATEGORIES:
            saved_path.unlink(missing_ok=True)
            raise HTTPException(
                status_code=422,
                detail="A category of 'pothole' or 'garbage' is required when detection fails",
            )
        report_category = category
        detection_source = "manual"

    created_at = datetime.utcnow()
    report = Report(
        category=report_category,
        confidence=float(detection.get("confidence", 0)) if detection_source == "ai" else 0,
        bbox=detection.get("bbox") if detection_source == "ai" else None,
        detection_source=detection_source,
        image_path=f"/uploads/{filename}",
        description=description,
        latitude=latitude,
        longitude=longitude,
        status="Reported",
        is_demo_data=False,
        created_at=created_at,
    )

    duplicate_parent_id = find_duplicate(db, report)
    duplicate_count = 0
    if duplicate_parent_id is not None:
        parent = db.query(Report).filter(Report.id == duplicate_parent_id).first()
        duplicate_count = parent.duplicate_count if parent else 0

    score, breakdown = compute_priority(
        confidence=report.confidence,
        image_area_ratio=detection.get("image_area_ratio", 0),
        latitude=latitude,
        longitude=longitude,
        duplicate_count=duplicate_count,
        created_at=created_at,
    )
    report.priority_score = score
    report.score_breakdown = breakdown

    try:
        db.add(report)
        db.commit()
        db.refresh(report)
    except Exception:
        db.rollback()
        saved_path.unlink(missing_ok=True)
        raise

    return _report_json(report)


@router.get("")
def list_reports(
    status: str | None = Query(None),
    category: str | None = Query(None),
    db: Session = Depends(get_db),
):
    """List reports with optional filters, highest priority first."""
    if status is not None and status not in ALLOWED_STATUSES:
        raise HTTPException(status_code=422, detail="Unsupported report status")
    if category is not None and category not in ALLOWED_CATEGORIES:
        raise HTTPException(status_code=422, detail="Category must be pothole or garbage")

    query = db.query(Report)
    if status is not None:
        query = query.filter(Report.status == status)
    if category is not None:
        query = query.filter(Report.category == category)
    reports = query.order_by(Report.priority_score.desc()).all()
    return [_report_json(report) for report in reports]


@router.get("/{report_id}")
def get_report(report_id: int, db: Session = Depends(get_db)):
    """Return one report or a 404 response when it does not exist."""
    report = db.query(Report).filter(Report.id == report_id).first()
    if report is None:
        raise HTTPException(status_code=404, detail="Report not found")
    return _report_json(report)
