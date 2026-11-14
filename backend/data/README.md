# Detection photos

`pothole.jpg` is the project's current local smoke-test image. It shows a
gravel-filled repair, not a clear open pothole. Add campus photos to `potholes/`
and `garbage/` for detector smoke tests:

The six user-provided photos in `potholes/` produced pothole boxes on all six
combined-pipeline runs (confidence 0.896–0.933) at the 0.30 threshold. One is a
repaired patch. The garbage model initially overrode three of those results, so
the detector now prefers a pothole-model result at 0.85 or above. This is a
small, positive-only smoke set, not an accuracy measurement; the preference
rule must be checked against normal roads and garbage photos before relying on
it beyond this demo.

```powershell
python test_detect.py .\data\potholes --csv .\data\pothole_smoke_results.csv
python test_detect.py .\data\garbage --csv .\data\garbage_smoke_results.csv
```

Add `--category pothole` or `--category garbage` to isolate a model while
debugging category disagreements.

For accuracy, add 10 clear pothole photos and 10 normal-road photos directly
under this directory. Copy `accuracy_labels.csv.example` to
`accuracy_labels.csv`, add one row per photo with `yes` or `no`, then run
`python evaluate_detector.py`. The script writes a per-photo results table and
summary to `accuracy_results.csv`. Keep this a separate labeled set; do not
report training-set results as test accuracy.
