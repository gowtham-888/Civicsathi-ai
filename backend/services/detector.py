"""Call the configured Roboflow models and select the strongest valid result."""

import logging
import os
from pathlib import Path
from typing import Any

import requests
from dotenv import load_dotenv
from PIL import Image

PROJECT_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(PROJECT_ROOT / "backend" / ".env")
load_dotenv(PROJECT_ROOT / ".env")

logger = logging.getLogger(__name__)
try:
    CONFIDENCE_THRESHOLD = float(os.getenv("ROBOFLOW_CONFIDENCE_THRESHOLD", "0.3"))
except ValueError:
    logger.warning("Invalid ROBOFLOW_CONFIDENCE_THRESHOLD; using 0.30")
    CONFIDENCE_THRESHOLD = 0.3
try:
    POTHOLE_PREFERENCE_THRESHOLD = float(os.getenv("ROBOFLOW_POTHOLE_PREFERENCE_THRESHOLD", "0.85"))
except ValueError:
    logger.warning("Invalid ROBOFLOW_POTHOLE_PREFERENCE_THRESHOLD; using 0.85")
    POTHOLE_PREFERENCE_THRESHOLD = 0.85
REQUEST_TIMEOUT_SECONDS = 30


def _manual_result() -> dict[str, Any]:
    """Return the consistent no-detection result when inference is unavailable."""
    return {"category": "none", "confidence": 0, "source": "manual"}


def detect(image_path: str, category: str | None = None) -> dict[str, Any]:
    """Run pothole and garbage inference and return the best prediction.

    Roboflow's x/y values are box centers. This converts those centers to
    top-left pixel coordinates so the frontend can draw the box directly.
    """
    api_key = os.getenv("ROBOFLOW_API_KEY")
    api_url = os.getenv("ROBOFLOW_API_URL", "https://detect.roboflow.com").rstrip("/")
    model_ids = [
        ("pothole", os.getenv("ROBOFLOW_MODEL_ID")),
        ("garbage", os.getenv("ROBOFLOW_GARBAGE_MODEL_ID")),
    ]
    if category is not None:
        if category not in {"pothole", "garbage"}:
            raise ValueError("category must be 'pothole' or 'garbage'")
        model_ids = [(model_category, model_id) for model_category, model_id in model_ids if model_category == category]

    if not api_key:
        logger.warning("Roboflow detection skipped: ROBOFLOW_API_KEY is not set")
        return _manual_result()

    try:
        with Image.open(image_path) as image:
            image_width, image_height = image.size
        if image_width <= 0 or image_height <= 0:
            logger.warning("Roboflow detection skipped: image has invalid dimensions: %s", image_path)
            return _manual_result()
    except (OSError, ValueError) as exc:
        logger.warning("Roboflow detection could not open image %r: %s", image_path, exc)
        return _manual_result()

    detections = []
    configured_models = 0
    for category, model_id in model_ids:
        # A missing model is simply unavailable; the other model can still run.
        if not model_id:
            logger.warning("Roboflow %s detection skipped: model ID is not configured", category)
            continue
        configured_models += 1
        endpoint = f"{api_url}/{model_id.strip('/')}"
        try:
            with open(image_path, "rb") as image_file:
                response = requests.post(
                    endpoint,
                    params={"api_key": api_key},
                    files={"file": image_file},
                    timeout=REQUEST_TIMEOUT_SECONDS,
                )
            response.raise_for_status()
            predictions = response.json().get("predictions", [])
        except (OSError, requests.RequestException, ValueError) as exc:
            # Do not log exception text: request URLs can include the private API key.
            logger.warning(
                "Roboflow %s request failed for model %s (%s)",
                category,
                model_id,
                type(exc).__name__,
            )
            continue

        for prediction in predictions:
            try:
                confidence = float(prediction.get("confidence", 0))
                if confidence <= CONFIDENCE_THRESHOLD:
                    continue

                box_width = float(prediction["width"])
                box_height = float(prediction["height"])
                center_x = float(prediction["x"])
                center_y = float(prediction["y"])
            except (KeyError, TypeError, ValueError) as exc:
                logger.warning("Ignoring malformed Roboflow %s prediction: %s", category, exc)
                continue

            bbox = {
                "x": center_x - box_width / 2,
                "y": center_y - box_height / 2,
                "w": box_width,
                "h": box_height,
            }
            detections.append(
                {
                    "category": category,
                    "confidence": confidence,
                    "bbox": bbox,
                    "image_area_ratio": (box_width * box_height)
                    / (image_width * image_height),
                    "source": "ai",
                    "image_width": image_width,
                    "image_height": image_height,
                }
            )

    if not detections:
        if configured_models:
            logger.warning(
                "Roboflow returned no predictions above the %.2f confidence threshold for %s",
                CONFIDENCE_THRESHOLD,
                image_path,
            )
        return _manual_result()

    # Independent models are not necessarily confidence-calibrated against one
    # another. Prefer a strong pothole-model result over an overconfident broad
    # garbage false positive, then fall back to the strongest remaining result.
    pothole_detections = [detection for detection in detections if detection["category"] == "pothole"]
    if pothole_detections:
        best_pothole = max(pothole_detections, key=lambda detection: detection["confidence"])
        if best_pothole["confidence"] >= POTHOLE_PREFERENCE_THRESHOLD:
            return best_pothole

    return max(detections, key=lambda detection: detection["confidence"])
