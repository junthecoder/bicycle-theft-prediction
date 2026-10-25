"""Print the overall bounding box of the census boundary shapefiles in WGS84."""

from pathlib import Path

import geopandas as gpd
import pandas as pd

BOUNDARY_DIR = Path(__file__).parent / "data" / "raw" / "census" / "boundary"
CRS = "EPSG:4326"


def overall_bounds(paths: list[Path]) -> tuple[float, float, float, float]:
    frames = [gpd.read_file(path).to_crs(CRS) for path in paths]
    minx, miny, maxx, maxy = pd.concat(frames).total_bounds
    return minx, miny, maxx, maxy


def census_bbox(boundary_dir: Path = BOUNDARY_DIR) -> str:
    paths = sorted(boundary_dir.rglob("*.shp"))
    if not paths:
        raise FileNotFoundError(f"no shapefiles found under {boundary_dir}")
    # min_lon,min_lat,max_lon,max_lat, the format `pmtiles extract --bbox` expects.
    return ",".join(f"{v:.6f}" for v in overall_bounds(paths))


def main() -> None:
    print(census_bbox())


if __name__ == "__main__":
    main()
