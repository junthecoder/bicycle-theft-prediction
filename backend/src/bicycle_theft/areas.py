"""Build the 町丁目 (census small area) layer of Fukuoka city from the e-Stat boundary shapefiles.

Writes two files to data/processed/:
- fukuoka_areas.geojson: one polygon per KEY_CODE with population, for the map.
- fukuoka_areas.parquet: the same attributes without geometry, for joins in the API and notebooks.

Also hosts `normalize_area_name`, which makes the 町丁目 names written by the police
comparable with the census names.
"""

import re
import unicodedata
from pathlib import Path

import geopandas as gpd
import pandas as pd
import polars as pl

from bicycle_theft.paths import PROCESSED_DIR, RAW_DIR

BOUNDARY_DIR = RAW_DIR / "census" / "boundary"
GEOJSON_PATH = PROCESSED_DIR / "fukuoka_areas.geojson"
PARQUET_PATH = PROCESSED_DIR / "fukuoka_areas.parquet"
CRS = "EPSG:4326"
# 8154 marks 水面調査区 (water bodies); nobody lives there and thefts are never geocoded to them.
WATER_HCODE = 8154
# Degrees; roughly 2 m, far below what is visible at the zoom levels the map allows.
SIMPLIFY_TOLERANCE = 0.00002

KANJI_DIGITS = {"〇": 0, "一": 1, "二": 2, "三": 3, "四": 4, "五": 5, "六": 6, "七": 7, "八": 8, "九": 9}
# The police data and the census spell a few place names with different (but equivalent)
# characters. Both sides are mapped onto the census spelling.
VARIANT_CHARACTERS = str.maketrans({"ヶ": "ケ", "洲": "州", "桧": "檜"})
CHOME_PATTERN = re.compile(r"([〇一二三四五六七八九十]+|\d+)丁目$")


def kanji_to_int(text: str) -> int:
    if text.isdecimal():
        return int(text)
    if "十" not in text:
        return KANJI_DIGITS[text]
    tens, _, ones = text.partition("十")
    return (KANJI_DIGITS[tens] if tens else 1) * 10 + (KANJI_DIGITS[ones] if ones else 0)


def normalize_area_name(name: str) -> str:
    """Return a canonical spelling: NFKC (full-width digits -> ASCII), unified variant characters
    and ASCII digits before 丁目 (the census writes 箱崎一丁目, the police 箱崎１丁目)."""
    normalized = unicodedata.normalize("NFKC", name).translate(VARIANT_CHARACTERS)
    return CHOME_PATTERN.sub(lambda m: f"{kanji_to_int(m.group(1))}丁目", normalized)


def read_boundaries(boundary_dir: Path = BOUNDARY_DIR) -> gpd.GeoDataFrame:
    paths = sorted(boundary_dir.rglob("*.shp"))
    if not paths:
        raise FileNotFoundError(f"no shapefiles found under {boundary_dir}")
    frames = [gpd.read_file(path).to_crs(CRS) for path in paths]
    gdf = gpd.GeoDataFrame(pd.concat(frames, ignore_index=True), crs=CRS)
    return gdf[gdf["HCODE"] != WATER_HCODE]


def build_areas(gdf: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    # A few 大字 areas are stored as several rows sharing a KEY_CODE (detached parcels), so
    # merge them into one feature; population and households are per row and add up.
    dissolved = gdf.dissolve(
        by="KEY_CODE",
        aggfunc={"CITY_NAME": "first", "S_NAME": "first", "JINKO": "sum", "SETAI": "sum", "AREA": "sum"},
        as_index=False,
    )
    representative = dissolved.geometry.representative_point()
    areas = gpd.GeoDataFrame(
        {
            "key_code": dissolved["KEY_CODE"],
            "ward_code": dissolved["KEY_CODE"].str[:5],
            "ward": dissolved["CITY_NAME"].str.removeprefix("福岡市"),
            "name": dissolved["S_NAME"],
            "name_normalized": dissolved["S_NAME"].map(normalize_area_name),
            "population": dissolved["JINKO"].astype("int64"),
            "households": dissolved["SETAI"].astype("int64"),
            "area_km2": (dissolved["AREA"] / 1_000_000).round(4),
            "lon": representative.x.round(6),
            "lat": representative.y.round(6),
        },
        geometry=dissolved.geometry.simplify(SIMPLIFY_TOLERANCE, preserve_topology=True),
        crs=CRS,
    )
    return areas.sort_values("key_code").reset_index(drop=True)


def main() -> None:
    areas = build_areas(read_boundaries())
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    # Six decimals is about 10 cm, which keeps the GeoJSON small without visible loss.
    areas.to_file(GEOJSON_PATH, driver="GeoJSON", COORDINATE_PRECISION=6, id_generate="NO")
    pl.from_pandas(areas.drop(columns="geometry")).write_parquet(PARQUET_PATH)
    print(f"wrote {len(areas)} areas to {GEOJSON_PATH} and {PARQUET_PATH}")


if __name__ == "__main__":
    main()
