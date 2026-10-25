"""Extract Fukuoka city from the latest Protomaps daily planet build into data/raw/fukuoka.pmtiles."""

import json
import subprocess
import tempfile
from pathlib import Path
from urllib.request import Request, urlopen

from bicycle_theft.census_bbox import census_bbox
from bicycle_theft.paths import RAW_DIR

OUTPUT = RAW_DIR / "fukuoka.pmtiles"
BUILDS_URL = "https://build-metadata.protomaps.dev/builds.json"
BUILD_URL = "https://build.protomaps.com/{key}"
# Basemap beyond the census extent, so the surroundings render up to the pannable bounds the map
# allows (VIEW_MARGIN_KM in frontend/src/Map.tsx, which must stay smaller than this).
MARGIN_KM = 12


def latest_build_key() -> str:
    # The build listing answers 403 to urllib's default User-Agent.
    request = Request(BUILDS_URL, headers={"User-Agent": "bicycle-theft-prediction (uv run download-pmtiles)"})
    with urlopen(request, timeout=30) as response:
        builds = json.load(response)
    # Keys are <YYYYMMDD>.pmtiles, so the lexicographic max is the newest build.
    return max(build["key"] for build in builds)


def main() -> None:
    key = latest_build_key()
    bbox = census_bbox(margin_km=MARGIN_KM)
    # Extract next to the target and swap at the end, so a failed download keeps the old basemap.
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    print(f"extracting {bbox} from {key} into {OUTPUT}")
    # A unique workspace permits retries/concurrent runs; cleanup also runs on failure.
    # pmtiles expects a path that does not already exist.
    with tempfile.TemporaryDirectory(dir=OUTPUT.parent, prefix="pmtiles-") as staging:
        partial = Path(staging) / OUTPUT.name
        subprocess.run(
            ["pmtiles", "extract", BUILD_URL.format(key=key), str(partial), f"--bbox={bbox}"],
            check=True,
        )
        partial.replace(OUTPUT)



if __name__ == "__main__":
    main()
