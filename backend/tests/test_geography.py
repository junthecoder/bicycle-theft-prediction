import tempfile
import unittest
from pathlib import Path

import geopandas as gpd
from shapely.geometry import box

from bicycle_theft.areas import build_areas, build_city_outline, normalize_area_name, read_boundaries
from bicycle_theft.census_bbox import census_bbox, pad


class GeographyTests(unittest.TestCase):
    def test_normalized_names(self):
        for raw, expected in [
            ("箱崎一丁目", "箱崎1丁目"),
            ("箱崎１２丁目", "箱崎12丁目"),
            ("桧原十丁目", "檜原10丁目"),
            ("中洲", "中州"),
        ]:
            self.assertEqual(normalize_area_name(raw), expected)

    def test_disconnected_parcels_dissolve_and_water_is_only_in_outline(self):
        boundaries = gpd.GeoDataFrame(
            {
                "KEY_CODE": ["40131001001", "40131001001", "40131002001"],
                "HCODE": [8101, 8101, 8154],
                "CITY_NAME": ["福岡市東区"] * 3,
                "S_NAME": ["箱崎一丁目", "箱崎一丁目", "水面"],
                "JINKO": [100, 50, 0],
                "SETAI": [40, 20, 0],
                "AREA": [1000000, 1000000, 1000000],
            },
            geometry=[box(130, 33, 130.01, 33.01), box(130.02, 33, 130.03, 33.01), box(130.04, 33, 130.05, 33.01)],
            crs="EPSG:4326",
        )
        areas = build_areas(boundaries)
        self.assertEqual(len(areas), 1)
        self.assertEqual(areas.iloc[0]["population"], 150)
        self.assertEqual(areas.iloc[0]["households"], 60)
        self.assertEqual(areas.iloc[0]["name_normalized"], "箱崎1丁目")
        self.assertEqual(areas.iloc[0]["area_km2"], 2)
        outline = build_city_outline(boundaries)
        self.assertTrue(outline.geometry.iloc[0].covers(boundaries.geometry.iloc[2]))

    def test_missing_boundaries_are_actionable_and_padding_grows_all_sides(self):
        with tempfile.TemporaryDirectory() as temp:
            for function in [census_bbox, read_boundaries]:
                with self.assertRaises(FileNotFoundError):
                    function(Path(temp))
        bounds = (130.0, 33.0, 131.0, 34.0)
        self.assertEqual(pad(bounds, 0), bounds)
        padded = pad(bounds, 1)
        self.assertLess(padded[0], bounds[0])
        self.assertLess(padded[1], bounds[1])
        self.assertGreater(padded[2], bounds[2])
        self.assertGreater(padded[3], bounds[3])
