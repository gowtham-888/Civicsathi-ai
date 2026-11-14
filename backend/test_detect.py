"""Run both configured Roboflow detectors against a local image."""

import argparse
import csv
import json
from pathlib import Path

from services.detector import detect


IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}


def main():
    parser = argparse.ArgumentParser(description="Test Roboflow detection on an image")
    parser.add_argument("image_path", help="Path to an image or directory of images")
    parser.add_argument("--category", choices=("pothole", "garbage"), help="Test only this configured model")
    parser.add_argument("--csv", dest="csv_path", help="Also save one result row per image to a CSV file")
    args = parser.parse_args()

    path = Path(args.image_path)
    if path.is_dir():
        image_paths = sorted(
            candidate for candidate in path.rglob("*")
            if candidate.is_file() and candidate.suffix.lower() in IMAGE_SUFFIXES
        )
    else:
        image_paths = [path]
    if not image_paths:
        raise SystemExit(f"No supported image files found at {path}")

    rows = []
    for image_path in image_paths:
        result = detect(str(image_path), category=args.category)
        rows.append({"image": str(image_path), **result})
    print(json.dumps(rows[0] if len(rows) == 1 else rows, indent=2))

    if args.csv_path:
        columns = ["image", "category", "confidence", "source", "bbox"]
        with Path(args.csv_path).open("w", newline="", encoding="utf-8") as output_file:
            writer = csv.DictWriter(output_file, fieldnames=columns)
            writer.writeheader()
            for row in rows:
                writer.writerow(
                    {
                        "image": row.get("image", ""),
                        "category": row.get("category", "none"),
                        "confidence": row.get("confidence", 0),
                        "source": row.get("source", "manual"),
                        "bbox": json.dumps(row.get("bbox")) if row.get("bbox") else "",
                    }
                )
        print(f"Saved results to {args.csv_path}")


if __name__ == "__main__":
    main()
