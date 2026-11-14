"""SQLAlchemy models used by the API."""

from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, Column, DateTime, Float, ForeignKey, Integer, JSON, String

from database import Base


class Report(Base):
    """A civic issue detected or entered by a person."""

    __tablename__ = "reports"
    __table_args__ = (
        CheckConstraint("category IN ('pothole', 'garbage')", name="ck_reports_category"),
        CheckConstraint("detection_source IN ('ai', 'manual')", name="ck_reports_detection_source"),
        CheckConstraint("status IN ('Reported', 'In progress', 'Resolved')", name="ck_reports_status"),
    )

    id = Column(Integer, primary_key=True, index=True)
    category = Column(String, nullable=False)
    confidence = Column(Float, nullable=True)
    bbox = Column(JSON, nullable=True)
    detection_source = Column(String, nullable=False, default="manual")
    image_path = Column(String, nullable=True)
    after_image_path = Column(String, nullable=True)
    description = Column(String, nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    priority_score = Column(Float, nullable=False, default=0)
    score_breakdown = Column(JSON, nullable=True)
    duplicate_of = Column(Integer, ForeignKey("reports.id"), nullable=True)
    duplicate_count = Column(Integer, nullable=False, default=0)
    status = Column(String, nullable=False, default="Reported")
    assigned_to = Column(String, nullable=True)
    deadline = Column(DateTime, nullable=True)
    is_demo_data = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
