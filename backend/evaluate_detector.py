"""Measure binary pothole detection accuracy from a labeled CSV in data/."""

import argparse
import csv
from pathlib import Path

from services.detector import detect

DATA_DIR = Path(__file__).resolve().parent / "data"
LABELS_FILE = DATA_DIR / "accuracy_labels.csv"
POSITIVE_VALUES = {"1", "true", "yes", "y", "pothole"}
NEGATIVE_VALUES = {"0", "false", "no", "n", "none", "other"}


def main() -> None:
    parser = argparse.ArgumentParser(description="Evaluate pothole detection on labeled images")
    parser.add_argument("--labels", type=Path, default=LABELS_FILE, help="CSV with image,has_pothole columns")
    args = parser.parse_args()

    with args.labels.open(newline="", encoding="utf-8-sig") as labels_file:
        rows = list(csv.DictReader(labels_file))
    if not rows:
        raise SystemExit(f"No labeled images found in {args.labels}")

    true_positive = true_negative = false_positive = false_negative = 0
    results = []
    for row in rows:
        image_name = (row.get("image") or "").strip()
        label = (row.get("has_pothole") or "").strip().lower()
        if label not in POSITIVE_VALUES | NEGATIVE_VALUES:
            raise SystemExit(f"Invalid has_pothole value for {image_name!r}: use yes/no")

        image_path = (DATA_DIR / image_name).resolve()
        if image_path.parent != DATA_DIR.resolve() or not image_path.is_file():
            raise SystemExit(f"Image must exist directly under {DATA_DIR}: {image_name!r}")

        expected_positive = label in POSITIVE_VALUES
        prediction = detect(str(image_path))
        detected = prediction.get("category")
        predicted_positive = detected == "pothole"
        correct = expected_positive == predicted_positive
        results.append({
            "image": image_name,
            "expected": "pothole" if expected_positive else "no pothole",
            "detected": detected,
            "correct": "yes" if correct else "no",
        })
        if expected_positive and predicted_positive:
            true_positive += 1
        elif expected_positive:
            false_negative += 1
        elif predicted_positive:
            false_positive += 1
        else:
            true_negative += 1

    total = len(rows)
    correct = true_positive + true_negative
    results_file = args.labels.with_name("accuracy_results.csv")
    with results_file.open("w", newline="", encoding="utf-8") as output_file:
        writer = csv.DictWriter(output_file, fieldnames=["image", "expected", "detected", "correct"])
        writer.writeheader()
        writer.writerows(results)
    print("Photo | Expected | Detected | Correct")
    for result in results:
        print("{image} | {expected} | {detected} | {correct}".format(**result))
    print(f"Images: {total}")
    print(f"Accuracy: {correct}/{total} = {correct / total:.1%}")
    print(f"True positives: {true_positive}; true negatives: {true_negative}")
    print(f"False positives: {false_positive}; false negatives: {false_negative}")
    print(f"Per-photo table saved to {results_file}")
    if true_positive + false_negative != 10 or true_negative + false_positive != 10:
        print("Note: this set is not the requested balanced 10 pothole / 10 no-pothole sample.")
    print("Use a separate labeled set; results depend on the photo mix and the configured models.")


if __name__ == "__main__":
    main()
