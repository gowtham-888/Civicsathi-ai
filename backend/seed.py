"""Insert a repeatable set of clearly marked Bengaluru demo reports."""

from datetime import datetime, timedelta

from database import Base, SessionLocal, engine
from models import Report
from services.scoring import compute_priority

# Fixed inputs keep demo data predictable and make it easy to explain in class.
SAMPLE_ROWS = [
    ("pothole", "Reported", 12.9701, 77.5882, 0, 0, 2),
    ("garbage", "In progress", 12.9710, 77.5901, 0, 1, 1),
    ("pothole", "Resolved", 12.9688, 77.5912, 0, 2, -2),
    ("garbage", "Reported", 12.9723, 77.5874, 0, 3, 3),
    ("pothole", "In progress", 12.9694, 77.5931, 0, 4, -1),
    ("garbage", "Resolved", 12.9731, 77.5920, 0, 5, 2),
    ("pothole", "Reported", 12.9679, 77.5869, 0, 6, -3),
    ("garbage", "In progress", 12.9740, 77.5893, 0, 7, 1),
    ("pothole", "Resolved", 12.9718, 77.5951, 0, 8, 3),
    ("garbage", "Reported", 12.9667, 77.5908, 0, 9, -2),
    ("pothole", "In progress", 12.9751, 77.5938, 0, 10, 2),
    ("garbage", "Resolved", 12.9699, 77.5858, 0, 11, -1),
    ("pothole", "Reported", 12.9736, 77.5962, 0, 12, 3),
    ("garbage", "In progress", 12.9681, 77.5942, 0, 13, -3),
    ("pothole", "Resolved", 12.9760, 77.5879, 0, 14, 1),
    ("garbage", "Reported", 12.9707, 77.5971, 0, 15, 2),
    ("pothole", "In progress", 12.9659, 77.5889, 0, 16, -2),
    ("garbage", "Resolved", 12.9747, 77.5957, 0, 17, 3),
]


def seed_reports() -> int:
    """Replace only this script's previous demo rows and insert 18 fresh rows."""
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        # Leave all real reports and any other demo records untouched.
        db.query(Report).filter(
            Report.is_demo_data.is_(True),
            Report.description.like("Seeded demo report #%"),
        ).delete(synchronize_session=False)

        now = datetime.utcnow()
        reports = []
        for index, (category, status, latitude, longitude, duplicate_count, age_days, deadline_days) in enumerate(
            SAMPLE_ROWS, start=1
        ):
            created_at = now - timedelta(days=age_days)
            score, breakdown = compute_priority(
                confidence=None,
                image_area_ratio=None,
                latitude=latitude,
                longitude=longitude,
                duplicate_count=duplicate_count,
                created_at=created_at,
                now=now,
            )
            reports.append(
                Report(
                    category=category,
                    confidence=None,
                    bbox=None,
                    detection_source="manual",
                    description=f"Seeded demo report #{index:02d} for {category}",
                    latitude=latitude,
                    longitude=longitude,
                    priority_score=score,
                    score_breakdown=breakdown,
                    duplicate_count=duplicate_count,
                    status=status,
                    deadline=now + timedelta(days=deadline_days),
                    is_demo_data=True,
                    created_at=created_at,
                )
            )

        db.add_all(reports)
        db.commit()
        return len(reports)
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    print(f"Seeded {seed_reports()} demo reports around Bengaluru.")
