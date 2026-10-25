"""Merge the yearly Fukuoka bicycle-theft CSVs in data/raw/ into one typed Parquet file in data/processed/."""

import io
import shutil
from datetime import date
from pathlib import Path

import dlt
import polars as pl
from dlt.common.typing import TDataItems

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
    # Some files are padded with comma-only rows (2018 has ~1M of them).
    return df.filter(~pl.all_horizontal(pl.all().is_null()))


def parse_types(df: pl.DataFrame) -> pl.DataFrame:
    # Dates come as 2018/2/1, 20241011 or Excel serials depending on the year; hours as
    # 7 or 07. 不明 (unknown) becomes null.
    raw_date = pl.col(DATE_COLUMN)
    typed = df.with_columns(
        pl.coalesce(
            raw_date.str.to_date("%Y/%m/%d", strict=False),
            raw_date.str.to_date("%Y%m%d", strict=False),
            pl.lit(EXCEL_EPOCH) + pl.duration(days=raw_date.cast(pl.Int32, strict=False)),
        ),
        pl.col(HOUR_COLUMN).cast(pl.Int8, strict=False),
    )
    for column in (DATE_COLUMN, HOUR_COLUMN):
        unparsed = df[column].filter(typed[column].is_null() & (df[column] != UNKNOWN))
        if len(unparsed):
            raise ValueError(f"unparseable {column} values: {unparsed.unique().to_list()}")
    return typed


@dlt.resource(name=TABLE_NAME, write_disposition="replace")
def raw_csv_rows(raw_dir: Path = RAW_DIR):
    # Older years use a different set of columns, so union them by name; columns a
    # year doesn't have are left empty.
    frames = [read_raw_csv(path) for path in sorted(raw_dir.glob("*.csv"))]
    yield parse_types(pl.concat(frames, how="diagonal")).to_arrow()


# batch_size=0 hands the sink each whole load file instead of batches of rows, so every
# table is copied to a single Parquet file as dlt wrote it.
@dlt.destination(batch_size=0, loader_file_format="parquet")
def parquet_file(items: TDataItems | str, table) -> None:
    assert isinstance(items, str)  # with batch_size=0, items is the load file's path
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(items, PROCESSED_DIR / f"{table['name']}.parquet")


def main():
    pipeline = dlt.pipeline(pipeline_name="raw_to_processed", destination=parquet_file())
    load_info = pipeline.run(raw_csv_rows())
    print(load_info)


if __name__ == "__main__":
    main()
