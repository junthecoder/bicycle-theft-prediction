"""Print the overall bounding box of the census boundary shapefiles in WGS84."""

import math
from pathlib import Path

import geopandas as gpd
import pandas as pd

from bicycle_theft.paths import RAW_DIR

BOUNDARY_DIR = RAW_DIR / "census" / "boundary"
CRS = "EPSG:4326"


def overall_bounds(paths: list[Path]) -> tuple[float, float, float, float]:
    frames = [gpd.read_file(path).to_crs(CRS) for path in paths]
    minx, miny, maxx, maxy = pd.concat(frames).total_bounds
    return minx, miny, maxx, maxy


KM_PER_DEGREE_LAT = 111.32


def pad(bounds: tuple[float, float, float, float], margin_km: float) -> tuple[float, float, float, float]:
    """Grow the box by `margin_km` on every side; longitude degrees shrink with latitude."""
    minx, miny, maxx, maxy = bounds
    dlat = margin_km / KM_PER_DEGREE_LAT
    dlon = dlat / math.cos(math.radians((miny + maxy) / 2))
    return minx - dlon, miny - dlat, maxx + dlon, maxy + dlat


def census_bbox(boundary_dir: Path = BOUNDARY_DIR, margin_km: float = 0) -> str:
    paths = sorted(boundary_dir.rglob("*.shp"))
    if not paths:
        raise FileNotFoundError(f"no shapefiles found under {boundary_dir}")
    # min_lon,min_lat,max_lon,max_lat, the format `pmtiles extract --bbox` expects.
    return ",".join(f"{v:.6f}" for v in pad(overall_bounds(paths), margin_km))


def main() -> None:
    print(census_bbox())


if __name__ == "__main__":
    main()
