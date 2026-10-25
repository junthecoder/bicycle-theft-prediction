"""Extract Fukuoka city from the latest Protomaps daily planet build into data/raw/fukuoka.pmtiles."""

import json
import subprocess
from pathlib import Path
from urllib.request import urlopen

from census_bbox import census_bbox

RAW_DIR = Path(__file__).parent / "data" / "raw"
OUTPUT = RAW_DIR / "fukuoka.pmtiles"
BUILDS_URL = "https://build-metadata.protomaps.dev/builds.json"
BUILD_URL = "https://build.protomaps.com/{key}"


def latest_build_key() -> str:
    with urlopen(BUILDS_URL) as response:
        builds = json.load(response)
    # Keys are <YYYYMMDD>.pmtiles, so the lexicographic max is the newest build.
    return max(build["key"] for build in builds)


def main() -> None:
    key = latest_build_key()
    bbox = census_bbox()
    print(f"extracting {bbox} from {key} into {OUTPUT}")
    subprocess.run(
        [
            "pmtiles",
            "extract",
            BUILD_URL.format(key=key),
            str(OUTPUT),
            f"--bbox={bbox}",
        ],
        check=True,
    )


if __name__ == "__main__":
    main()
