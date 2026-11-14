"""Calculate report priority from detection, location, duplicates, and age."""

import json
from datetime import datetime
from math import asin, cos, radians, sin, sqrt
from pathlib import Path
from typing import Any

ZONES_FILE = Path(__file__).resolve().parents[1] / "config" / "zones.json"
ZONE_RADIUS_METERS = 200
EARTH_RADIUS_METERS = 6_371_000


def haversine_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Measure straight-line distance between two latitude/longitude points."""
    lat1_rad, lat2_rad = radians(lat1), radians(lat2)
    latitude_delta = radians(lat2 - lat1)
    longitude_delta = radians(lon2 - lon1)
    value = (
        sin(latitude_delta / 2) ** 2
        + cos(lat1_rad) * cos(lat2_rad) * sin(longitude_delta / 2) ** 2
    )
    return 2 * EARTH_RADIUS_METERS * asin(sqrt(value))


def _load_zones() -> list[dict[str, Any]]:
    """Read zones from JSON each time so edits take effect without code changes."""
    try:
        with ZONES_FILE.open(encoding="utf-8") as zones_file:
            zones = json.load(zones_file)
        return zones if isinstance(zones, list) else []
    except (OSError, json.JSONDecodeError):
        return []


def compute_priority(
    confidence: float | None,
    image_area_ratio: float | None,
    latitude: float,
    longitude: float,
    duplicate_count: int = 0,
    created_at: datetime | None = None,
    now: datetime | None = None,
) -> tuple[float, dict[str, float]]:
    """Return a 0–100 score and its weighted component points.

    Severity uses 70% model confidence and 30% box area, with area normalized
    so a box covering 25% or more of the image reaches the area maximum.
    Location sensitivity fades linearly to zero at 200 metres from a zone.
    """
    confidence_value = min(max(float(confidence or 0), 0), 1)
    area_value = min(max(float(image_area_ratio or 0) / 0.25, 0), 1)
    severity = (0.7 * confidence_value + 0.3 * area_value) * 40

    # Ignore placeholders until real coordinates are configured.
    nearest_zone_distance = None
    for zone in _load_zones():
        zone_lat = zone.get("latitude")
        zone_lon = zone.get("longitude")
        if zone.get("is_placeholder") or zone_lat is None or zone_lon is None:
            continue
        distance = haversine_meters(latitude, longitude, float(zone_lat), float(zone_lon))
        nearest_zone_distance = distance if nearest_zone_distance is None else min(nearest_zone_distance, distance)

    if nearest_zone_distance is None or nearest_zone_distance >= ZONE_RADIUS_METERS:
        location_sensitivity = 0.0
    else:
        location_sensitivity = (1 - nearest_zone_distance / ZONE_RADIUS_METERS) * 30

    duplicate_component = min(max(int(duplicate_count), 0), 5) / 5 * 20
    current_time = now or datetime.utcnow()
    report_time = created_at or current_time
    age_days = max((current_time - report_time).total_seconds() / 86_400, 0)
    age_component = min(age_days / 7, 1) * 10

    breakdown = {
        "severity": round(severity, 2),
        "location_sensitivity": round(location_sensitivity, 2),
        "duplicate_count": round(duplicate_component, 2),
        "age": round(age_component, 2),
    }
    return round(sum(breakdown.values()), 2), breakdown
