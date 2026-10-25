import unittest
from datetime import date

import polars as pl

from bicycle_theft.pipeline import DATE_COLUMN, HOUR_COLUMN, parse_types


class ParsingTests(unittest.TestCase):
    def test_supported_formats_and_unknowns(self):
        result = parse_types(
            pl.DataFrame(
                {
                    DATE_COLUMN: ["2025/1/1", "20250102", "45950", "不明", None],
                    HOUR_COLUMN: ["0", "23", "07", "不明", None],
                }
            )
        )
        self.assertEqual(
            result[DATE_COLUMN].to_list(), [date(2025, 1, 1), date(2025, 1, 2), date(2025, 10, 20), None, None]
        )
        self.assertEqual(result[HOUR_COLUMN].to_list(), [0, 23, 7, None, None])

    def test_reject_invalid_compact_dates_instead_of_excel_fallback(self):
        for value in ["20241301", "20250230", "-1", "999999", "word"]:
            with self.subTest(value=value), self.assertRaisesRegex(ValueError, "unparseable"):
                parse_types(pl.DataFrame({DATE_COLUMN: [value], HOUR_COLUMN: ["12"]}))

    def test_hours_must_be_in_day(self):
        for value in ["-1", "24", "127", "12.5", "word"]:
            with self.subTest(value=value), self.assertRaisesRegex(ValueError, "unparseable"):
                parse_types(pl.DataFrame({DATE_COLUMN: ["2025/1/1"], HOUR_COLUMN: [value]}))
