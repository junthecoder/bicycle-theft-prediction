import unittest
from unittest.mock import patch

import polars as pl

from bicycle_theft.api.data import area_lookup, load_thefts, match_area
from fixtures import dataset


class AreaMatchingTests(unittest.TestCase):
    def test_duplicate_name_uses_larger_population_independent_of_order(self):
        for areas in [dataset().areas, dataset().areas.reverse()]:
            self.assertEqual(area_lookup(areas)[("40135", "壱岐団地")], "40135026001")

    def test_name_variants_and_parent_ooaza(self):
        lookup = {("40135", "大字北原"): "parent"}
        self.assertEqual(match_area(lookup, "40135", "北原１丁目"), "parent")
        self.assertIsNone(match_area(lookup, "40131", "北原１丁目"))
        self.assertIsNone(match_area(lookup, "40135", None))

    def test_single_year_without_optional_columns_loads(self):
        raw = pl.DataFrame(
            {
                "市区町村コード（発生地）": ["40135"],
                "町丁目（発生地）": ["壱岐団地"],
                "発生年月日（始期）": [__import__("datetime").date(2025, 1, 1)],
                "発生時（始期）": [12],
                "発生場所の属性": ["住宅"],
            }
        )
        with patch("bicycle_theft.api.data.pl.read_parquet", return_value=raw):
            result = load_thefts(dataset().areas)
        self.assertEqual(result["key_code"][0], "40135026001")
        self.assertEqual(result["place"][0], "住宅")
        self.assertIsNone(result["age"][0])
