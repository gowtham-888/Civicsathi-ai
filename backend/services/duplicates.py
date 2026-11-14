"""Find nearby recent reports and link duplicates to their original report."""

from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from models import Report
from services.scoring import haversine_meters

DUPLICATE_RADIUS_METERS = 50
DUPLICATE_WINDOW_DAYS = 7


def find_duplicate(db: Session, report: Report) -> int | None:
    """Link report to the closest matching primary report, if one is nearby."""
    if report.latitude is None or report.longitude is None:
        return None

    cutoff = report.created_at - timedelta(days=DUPLICATE_WINDOW_DAYS)
    candidates = (
        db.query(Report)
        .filter(
            Report.category == report.category,
            Report.created_at >= cutoff,
            Report.created_at <= report.created_at,
            Report.duplicate_of.is_(None),
            Report.latitude.isnot(None),
            Report.longitude.isnot(None),
        )
        .all()
    )

    nearest_parent = None
    nearest_distance = DUPLICATE_RADIUS_METERS
    for candidate in candidates:
        distance = haversine_meters(
            report.latitude,
            report.longitude,
            candidate.latitude,
            candidate.longitude,
        )
        if distance <= nearest_distance:
            nearest_parent = candidate
            nearest_distance = distance

    if nearest_parent is None:
        return None

    report.duplicate_of = nearest_parent.id
    nearest_parent.duplicate_count += 1
    return nearest_parent.id
