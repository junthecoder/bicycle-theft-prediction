"""Merge the yearly Fukuoka bicycle-theft CSVs in data/raw/ into one typed Parquet file in data/processed/."""

import io
import tempfile
from datetime import date
from pathlib import Path

import polars as pl

from bicycle_theft.paths import PROCESSED_DIR, RAW_DIR

TABLE_NAME = "fukuoka_bicycle_thefts"
DATE_COLUMN = "発生年月日（始期）"
HOUR_COLUMN = "発生時（始期）"
UNKNOWN = "不明"
# Excel's day zero; a few 2025 dates were exported as serial numbers such as 45950.
EXCEL_EPOCH = date(1899, 12, 30)

# Most raw files are cp932 (Microsoft's Shift_JIS superset; strict shift_jis rejects
# characters such as 塚 used in place names), but some years are published as UTF-8 with a BOM.
ENCODINGS = ("utf-8-sig", "cp932")


def decode(path: Path) -> str:
    data = path.read_bytes()
    for encoding in ENCODINGS:
        try:
            return data.decode(encoding)
        except UnicodeDecodeError:
            pass
    raise ValueError(f"{path} is not encoded in any of {ENCODINGS}")


def read_raw_csv(path: Path) -> pl.DataFrame:
    df = pl.read_csv(io.BytesIO(decode(path).encode("utf-8")), infer_schema=False)
    missing = {DATE_COLUMN, HOUR_COLUMN} - set(df.columns)
    if missing:
        raise ValueError(f"{path}: missing required columns {sorted(missing)}")
    # Some files are padded with comma-only rows (2018 has ~1M of them).
    return df.filter(~pl.all_horizontal(pl.all().is_null()))


def parse_types(df: pl.DataFrame) -> pl.DataFrame:
    # Dates come as 2018/2/1, 20241011 or Excel serials depending on the year; hours as
    # 7 or 07. 不明 (unknown) becomes null.
    raw_date = pl.col(DATE_COLUMN)
    # A malformed YYYYMMDD value must not fall through as millions of Excel days.
    # Accept the short positive serials used by these files, excluding compact calendar dates.
    serial = raw_date.cast(pl.Int32, strict=False)
    excel_days = pl.when(raw_date.str.contains(r"^\d{1,5}$") & serial.is_between(1, 99_999)).then(serial)
    hour = pl.col(HOUR_COLUMN).cast(pl.Int8, strict=False)
    typed = df.with_columns(
        pl.coalesce(
            raw_date.str.to_date("%Y/%m/%d", strict=False),
            raw_date.str.to_date("%Y%m%d", strict=False),
            pl.lit(EXCEL_EPOCH) + pl.duration(days=excel_days),
        ),
        pl.when(hour.is_between(0, 23)).then(hour).alias(HOUR_COLUMN),
    )
    for column in (DATE_COLUMN, HOUR_COLUMN):
        unparsed = df[column].filter(typed[column].is_null() & (df[column] != UNKNOWN))
        if len(unparsed):
            raise ValueError(f"unparseable {column} values: {unparsed.unique().to_list()}")
    return typed


def raw_csv_rows(raw_dir: Path | None = None):
    # Resolve at call time so CLI/test callers use the documented directory layout.
    raw_dir = raw_dir if raw_dir is not None else RAW_DIR / "bicycle-thefts"
    paths = sorted(raw_dir.glob("*.csv"))
    if not paths:
        raise FileNotFoundError(f"no theft CSV files found under {raw_dir}")
    frames = [read_raw_csv(path) for path in paths]
    yield parse_types(pl.concat(frames, how="diagonal")).to_arrow()


def main() -> None:
    frame = pl.from_arrow(next(raw_csv_rows()))
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    output = PROCESSED_DIR / f"{TABLE_NAME}.parquet"
    # One complete file, swapped only on success. A per-load-file sink can overwrite
    # earlier shards, and copying directly to the live path exposes partial files.
    with tempfile.NamedTemporaryFile(dir=PROCESSED_DIR, suffix=".parquet", delete=False) as handle:
        temporary = Path(handle.name)
    try:
        frame.write_parquet(temporary)
        temporary.replace(output)
    finally:
        temporary.unlink(missing_ok=True)
    print(f"wrote {frame.height} thefts to {output}")


if __name__ == "__main__":
    main()
