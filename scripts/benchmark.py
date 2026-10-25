"""Read-only API benchmark against local processed data; no machine-independent pass threshold.

Run from backend/: uv run python ../scripts/benchmark.py --output ../docs/audit/benchmarks.json
"""

import argparse
import json
import platform
import statistics
import time
from pathlib import Path

from bicycle_theft.api.data import Dataset


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--iterations", type=int, default=30)
    args = parser.parse_args()
    if args.iterations < 2:
        parser.error("--iterations must be at least 2")
    started = time.perf_counter()
    ds = Dataset.load()
    load_ms = (time.perf_counter() - started) * 1000
    window = ds.window(ds.thefts["date"].max(), 90, 0, 23)
    operations = {
        "meta": ds.meta,
        "area_counts": lambda: ds.area_counts(window),
        "summary": lambda: ds.summary(window, None),
        "timeline": lambda: ds.timeline(0, 23, None),
    }
    results = {}
    for name, operation in operations.items():
        operation()
        samples = []
        for _ in range(args.iterations):
            started = time.perf_counter()
            operation()
            samples.append((time.perf_counter() - started) * 1000)
        results[name] = {
            "median_ms": round(statistics.median(samples), 3),
            "p95_ms": round(sorted(samples)[int((len(samples) - 1) * 0.95)], 3),
        }
    report = {
        "python": platform.python_version(),
        "platform": platform.platform(),
        "iterations": args.iterations,
        "theft_rows": ds.thefts.height,
        "areas": ds.areas.height,
        "load_ms": round(load_ms, 3),
        "operations": results,
        "scope": "Warm in-process query timings; excludes HTTP, network, browser and GPU; descriptive baseline only.",
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
