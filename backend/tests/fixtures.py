"""Small synthetic datasets; tests never depend on the untracked police/census files."""

from datetime import date

import polars as pl

from bicycle_theft.api.data import Dataset


def dataset():
    areas = pl.DataFrame(
        {
            "key_code": ["40135026001", "40135026002", "40131001001"],
            "ward_code": ["40135", "40135", "40131"],
            "ward": ["西区", "西区", "東区"],
            "name": ["壱岐団地", "壱岐団地", "箱崎一丁目"],
            "name_normalized": ["壱岐団地", "壱岐団地", "箱崎1丁目"],
            "population": [3500, 1100, 50],
        }
    )
    thefts = pl.DataFrame(
        {
            "date": [date(2025, 1, 1), date(2025, 1, 2), date(2025, 3, 1), date(2024, 12, 31)],
            "hour": [22, None, 5, 12],
            "key_code": ["40135026001", "40135026001", None, "40131001001"],
            "weekday": [2, 3, 5, 1],
            "locked": [True, False, None, True],
            "place": ["住宅", "住宅", None, "道路"],
            "place_detail": ["駐車（輪）場", None, None, "道路上"],
            "age": ["20歳代", "20歳代", None, "30歳代"],
            "koban": ["交番", "交番", None, "交番"],
        },
        schema_overrides={"hour": pl.Int8},
    )
    return Dataset(areas, thefts)
