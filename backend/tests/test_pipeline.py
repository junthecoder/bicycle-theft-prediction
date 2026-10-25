import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import polars as pl

from bicycle_theft import pipeline


class PipelineTests(unittest.TestCase):
    def test_atomic_output_preserves_all_input_files(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            raw = root / "raw" / "bicycle-thefts"
            raw.mkdir(parents=True)
            for i in range(2):
                (raw / f"{i}.csv").write_text(
                    f"{pipeline.DATE_COLUMN},{pipeline.HOUR_COLUMN}\n2025/1/{i + 1},12\n", encoding="utf-8"
                )
            processed = root / "processed"
            with patch.object(pipeline, "RAW_DIR", root / "raw"), patch.object(pipeline, "PROCESSED_DIR", processed):
                pipeline.main()
            output = processed / f"{pipeline.TABLE_NAME}.parquet"
            self.assertEqual(pl.read_parquet(output).height, 2)
            before = output.read_bytes()
            (raw / "bad.csv").write_text("wrong,columns\na,b\n", encoding="utf-8")
            with patch.object(pipeline, "RAW_DIR", root / "raw"), patch.object(pipeline, "PROCESSED_DIR", processed):
                with self.assertRaises(ValueError):
                    pipeline.main()
            self.assertEqual(output.read_bytes(), before)

    def test_empty_input_is_actionable(self):
        with tempfile.TemporaryDirectory() as temp:
            with self.assertRaisesRegex(FileNotFoundError, "CSV"):
                list(pipeline.raw_csv_rows(Path(temp)))

    def test_failed_write_keeps_previous_output_and_cleans_staging(self):
        with tempfile.TemporaryDirectory() as temp:
            output = Path(temp)
            target = output / f"{pipeline.TABLE_NAME}.parquet"
            target.write_bytes(b"previous")
            frame = pl.DataFrame({pipeline.DATE_COLUMN: ["2025/1/1"], pipeline.HOUR_COLUMN: ["12"]})

            def fail_write(self, path, **kwargs):
                Path(path).write_bytes(b"partial")
                raise OSError("disk full")

            with (
                patch.object(pipeline, "PROCESSED_DIR", output),
                patch.object(pipeline, "raw_csv_rows", return_value=iter([frame.to_arrow()])),
                patch.object(pl.DataFrame, "write_parquet", fail_write),
            ):
                with self.assertRaises(OSError):
                    pipeline.main()
            self.assertEqual(target.read_bytes(), b"previous")
            self.assertEqual(list(output.iterdir()), [target])
