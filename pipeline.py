"""Merge the yearly Fukuoka bicycle-theft CSVs in data/raw/ into one UTF-8 CSV in data/processed/."""

import io
from pathlib import Path

import dlt
import polars as pl
import pyarrow.csv
import pyarrow.parquet
from dlt.common.typing import TDataItems

DATA_DIR = Path(__file__).parent / "data"
RAW_DIR = DATA_DIR / "raw"
PROCESSED_DIR = DATA_DIR / "processed"
TABLE_NAME = "fukuoka_bicycle_thefts"

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


@dlt.resource(name=TABLE_NAME, write_disposition="replace")
def raw_csv_rows(raw_dir: Path = RAW_DIR):
    # Older years use a different set of columns, so union them by name; columns a
    # year doesn't have are left empty.
    frames = [read_raw_csv(path) for path in sorted(raw_dir.glob("*.csv"))]
    yield pl.concat(frames, how="diagonal").to_arrow()


# batch_size=0 hands the sink each whole load file instead of batches of rows, so every
# table is written to a single CSV with one header.
@dlt.destination(batch_size=0, loader_file_format="parquet")
def csv_file(items: TDataItems | str, table) -> None:
    assert isinstance(items, str)  # with batch_size=0, items is the load file's path
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    pyarrow.csv.write_csv(
        pyarrow.parquet.read_table(items), PROCESSED_DIR / f"{table['name']}.csv"
    )


def main():
    pipeline = dlt.pipeline(pipeline_name="raw_to_processed", destination=csv_file())
    load_info = pipeline.run(raw_csv_rows())
    print(load_info)


if __name__ == "__main__":
    main()
