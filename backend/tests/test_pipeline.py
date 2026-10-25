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
