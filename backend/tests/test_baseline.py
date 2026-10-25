import unittest
from datetime import date

from fixtures import dataset

from bicycle_theft.api.data import hour_filter, rate_per_1000


class BaselineTests(unittest.TestCase):
    def test_full_day_includes_unknown_hour(self):
        ds = dataset()
        result = ds.summary(ds.window(date(2025, 1, 2), 2, 0, 23), None)
        self.assertEqual((result.total, result.unknown_hour), (2, 1))
        self.assertEqual(result.total, sum(result.by_hour) + result.unknown_hour)
        self.assertEqual(result.total, sum(result.by_weekday))

    def test_wrapped_hours_exclude_unknown(self):
        self.assertEqual(dataset().thefts.filter(hour_filter(22, 5)).height, 2)

    def test_population_threshold(self):
        self.assertIsNone(rate_per_1000(10, 99))
        self.assertEqual(rate_per_1000(10, 100), 100)
