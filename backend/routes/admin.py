"""Password-protected endpoints for simple report administration."""

import hmac
import os
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from dotenv import load_dotenv
from fastapi import APIRouter, Depends, File, Header, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from database import get_db
from models import Report

PROJECT_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(PROJECT_ROOT / "backend" / ".env")
load_dotenv(PROJECT_ROOT / ".env")

router = APIRouter(prefix="/api/admin", tags=["admin"])
UPLOADS_DIR = Path(__file__).resolve().parents[1] / "uploads"
VALID_STATUSES = {"Reported", "In progress", "Resolved"}
VALID_CATEGORIES = {"pothole", "garbage"}


def _check_admin_password(password: str) -> None:
    """Compare the supplied password with the configured secret safely."""
    expected_password = os.getenv("ADMIN_PASSWORD")
    if not expected_password:
        raise HTTPException(status_code=503, detail="Admin password is not configured")
    if not hmac.compare_digest(password, expected_password):
        raise HTTPException(status_code=401, detail="Invalid admin password")


def require_admin_password(
    password: str = Header(..., alias="X-Admin-Password"),
) -> None:
    """Protect each admin operation with the shared admin password header."""
    _check_admin_password(password)


class ReportUpdate(BaseModel):
    """Fields an administrator may change on a report."""

    status: str | None = None
    assigned_to: str | None = None
    deadline: datetime | None = None


@router.post("/login")
def admin_login(password: str = Header(..., alias="X-Admin-Password")):
    """Check the admin password; no session or token is created."""
    _check_admin_password(password)
    return {"ok": True}


@router.patch("/reports/{report_id}", dependencies=[Depends(require_admin_password)])
def update_report(
    report_id: int,
    changes: ReportUpdate,
    db: Session = Depends(get_db),
):
    """Update status, assignee, or deadline for one report."""
    report = db.query(Report).filter(Report.id == report_id).first()
    if report is None:
        raise HTTPException(status_code=404, detail="Report not found")

    updates = changes.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=422, detail="Provide at least one field to update")
    if "status" in updates and updates["status"] is None:
        raise HTTPException(status_code=422, detail="Status cannot be empty")
    if "status" in updates and updates["status"] is not None:
        if updates["status"] not in VALID_STATUSES:
            raise HTTPException(status_code=422, detail="Unsupported report status")
    if "deadline" in updates and updates["deadline"] is not None:
        deadline = updates["deadline"]
        if deadline.tzinfo is not None:
            updates["deadline"] = deadline.astimezone(timezone.utc).replace(tzinfo=None)

    for field, value in updates.items():
        setattr(report, field, value)
    db.commit()
    db.refresh(report)
    return {"id": report.id, "status": report.status, "assigned_to": report.assigned_to,
            "deadline": report.deadline.isoformat() if report.deadline else None}


@router.post("/reports/{report_id}/after-photo", dependencies=[Depends(require_admin_password)])
async def upload_after_photo(
    report_id: int,
    image: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """Attach an after photo to a report that has been marked Resolved."""
    report = db.query(Report).filter(Report.id == report_id).first()
    if report is None:
        raise HTTPException(status_code=404, detail="Report not found")
    if report.status != "Resolved":
        raise HTTPException(status_code=409, detail="Mark the report Resolved before uploading its after photo")
    if not image.content_type or not image.content_type.startswith("image/"):
        raise HTTPException(status_code=415, detail="Upload must be an image")

    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    suffix = Path(image.filename or "").suffix.lower()
    filename = f"after-{uuid4().hex}{suffix}"
    saved_path = UPLOADS_DIR / filename
    try:
        content = await image.read()
        if not content:
            raise HTTPException(status_code=400, detail="Uploaded image is empty")
        saved_path.write_bytes(content)
    finally:
        await image.close()

    previous_path = report.after_image_path
    report.after_image_path = f"/uploads/{filename}"
    try:
        db.commit()
        db.refresh(report)
    except Exception:
        db.rollback()
        saved_path.unlink(missing_ok=True)
        raise

    # Remove an older after photo only after the replacement has been saved.
    if previous_path and previous_path.startswith("/uploads/"):
        old_file = UPLOADS_DIR / Path(previous_path).name
        old_file.unlink(missing_ok=True)
    return {"id": report.id, "after_image_path": report.after_image_path}


@router.get("/stats", dependencies=[Depends(require_admin_password)])
def admin_stats(db: Session = Depends(get_db)):
    """Return overall, priority, status, category, and overdue report counts."""
    now = datetime.utcnow()
    total = db.query(func.count(Report.id)).scalar() or 0
    high_priority = db.query(func.count(Report.id)).filter(Report.priority_score >= 70).scalar() or 0
    in_progress = db.query(func.count(Report.id)).filter(Report.status == "In progress").scalar() or 0
    resolved = db.query(func.count(Report.id)).filter(Report.status == "Resolved").scalar() or 0
    overdue = (
        db.query(func.count(Report.id))
        .filter(Report.deadline.isnot(None), Report.deadline < now, Report.status != "Resolved")
        .scalar()
        or 0
    )

    by_category = {category: 0 for category in sorted(VALID_CATEGORIES)}
    for category, count in db.query(Report.category, func.count(Report.id)).group_by(Report.category):
        by_category[category] = count

    by_status = {status: 0 for status in sorted(VALID_STATUSES)}
    for status, count in db.query(Report.status, func.count(Report.id)).group_by(Report.status):
        by_status[status] = count

    return {
        "total": total,
        "high_priority": high_priority,
        "in_progress": in_progress,
        "resolved": resolved,
        "overdue": overdue,
        "counts_by_category": by_category,
        "counts_by_status": by_status,
    }
