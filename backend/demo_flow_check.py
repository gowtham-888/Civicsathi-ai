"""Exercise the report-to-admin demo flow twice against the local API."""

import os
from pathlib import Path

import requests
from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BACKEND_DIR.parent
load_dotenv(BACKEND_DIR / ".env")
load_dotenv(PROJECT_ROOT / ".env")

BASE_URL = os.getenv("DEMO_API_URL", "http://127.0.0.1:8001").rstrip("/")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD")
IMAGE_PATH = BACKEND_DIR / "data" / "potholes" / "pothole1.jpeg"
UPLOADS_DIR = BACKEND_DIR / "uploads"


def create_report(latitude: float, longitude: float, description: str) -> dict:
    with IMAGE_PATH.open("rb") as image_file:
        response = requests.post(
            f"{BASE_URL}/api/reports",
            data={
                "latitude": latitude,
                "longitude": longitude,
                "description": description,
            },
            files={"image": (IMAGE_PATH.name, image_file, "image/jpeg")},
            timeout=90,
        )
    response.raise_for_status()
    return response.json()


def main() -> None:
    if not ADMIN_PASSWORD:
        raise SystemExit("ADMIN_PASSWORD is not configured in backend/.env or the root .env")
    if not IMAGE_PATH.is_file():
        raise SystemExit(f"Test image not found: {IMAGE_PATH}")

    headers = {"X-Admin-Password": ADMIN_PASSWORD}
    login = requests.post(f"{BASE_URL}/api/admin/login", headers=headers, timeout=10)
    login.raise_for_status()
    created_rows = []
    uploaded_paths = []

    try:
        for cycle, (latitude, longitude) in enumerate(
            ((12.9716, 77.5946), (12.98334, 77.60469)), start=1
        ):
            primary = create_report(latitude, longitude, f"Demo flow check {cycle}: pothole")
            duplicate = create_report(latitude + 0.0001, longitude + 0.0001, f"Demo flow check {cycle}: nearby")
            created_rows.extend((primary, duplicate))
            uploaded_paths.extend((primary["image_path"], duplicate["image_path"]))

            if primary["detection_source"] != "ai" or primary["category"] != "pothole" or not primary["bbox"]:
                raise AssertionError(f"Cycle {cycle}: pothole box was not returned")
            if not primary["priority_score"] or not primary["score_breakdown"]:
                raise AssertionError(f"Cycle {cycle}: priority score or breakdown is missing")
            if duplicate["duplicate_of"] != primary["id"]:
                raise AssertionError(f"Cycle {cycle}: nearby report did not link to the first report")

            in_progress = requests.patch(
                f"{BASE_URL}/api/admin/reports/{primary['id']}",
                headers=headers,
                json={"status": "In progress", "assigned_to": "Demo verification team"},
                timeout=10,
            )
            in_progress.raise_for_status()
            resolved = requests.patch(
                f"{BASE_URL}/api/admin/reports/{primary['id']}",
                headers=headers,
                json={"status": "Resolved"},
                timeout=10,
            )
            resolved.raise_for_status()

            with IMAGE_PATH.open("rb") as after_image:
                after_photo = requests.post(
                    f"{BASE_URL}/api/admin/reports/{primary['id']}/after-photo",
                    headers=headers,
                    files={"image": ("after.jpg", after_image, "image/jpeg")},
                    timeout=20,
                )
            after_photo.raise_for_status()
            uploaded_paths.append(after_photo.json()["after_image_path"])

            tracked = requests.get(f"{BASE_URL}/api/reports/{primary['id']}", timeout=10)
            tracked.raise_for_status()
            tracked_report = tracked.json()
            mapped = requests.get(f"{BASE_URL}/api/reports", timeout=10)
            mapped.raise_for_status()
            map_report = next((row for row in mapped.json() if row["id"] == primary["id"]), None)
            if tracked_report["status"] != "Resolved" or not tracked_report["after_image_path"]:
                raise AssertionError(f"Cycle {cycle}: tracking did not show resolution and after photo")
            if map_report is None or map_report["latitude"] != latitude:
                raise AssertionError(f"Cycle {cycle}: report is missing from the map feed")

            print(
                f"Cycle {cycle}: report #{primary['id']} detected at "
                f"{primary['confidence']:.3f}; score {primary['priority_score']}; "
                f"duplicate #{duplicate['id']} linked; resolved and after photo verified."
            )
    finally:
        for saved_path in uploaded_paths:
            filename = Path(saved_path).name
            candidate = (UPLOADS_DIR / filename).resolve()
            if candidate.parent == UPLOADS_DIR.resolve() and candidate.is_file():
                candidate.unlink()


if __name__ == "__main__":
    main()
