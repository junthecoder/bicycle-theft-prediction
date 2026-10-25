import tempfile
import unittest
from datetime import date
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

from fixtures import dataset
from bicycle_theft.api.app import app


class ApiTests(unittest.TestCase):
    def setUp(self):
        self.load = patch('bicycle_theft.api.app.Dataset.load', return_value=dataset())
        self.load.start()
        self.client = TestClient(app, raise_server_exceptions=False)
        self.client.__enter__()

    def tearDown(self):
        self.client.__exit__(None, None, None)
        self.load.stop()

    def test_window_extremes_return_validation_error(self):
        for end, days in [('2025-01-01', 10**100), ('0001-01-01', 1), ('2025-01-01', 500000)]:
            for route in ['by-area', 'summary']:
                with self.subTest(end=end, days=days, route=route):
                    r = self.client.get(f'/api/thefts/{route}', params={'end': end, 'days': days})
                    self.assertEqual(r.status_code, 422, r.text)

    def test_valid_window_reconciles_counts_summary_and_previous(self):
        params = {'end': '2025-01-02', 'days': 2}
        counts = self.client.get('/api/thefts/by-area', params=params).json()
        summary = self.client.get('/api/thefts/summary', params=params).json()
        self.assertEqual(counts['total'], summary['total'])
        self.assertEqual(sum(a['count'] for a in counts['areas']) + counts['unmapped'], counts['total'])
        self.assertEqual(summary['prev_total'], 1)

    def test_unknown_area_consistent_404(self):
        for route in ['summary', 'timeline']:
            r = self.client.get(f'/api/thefts/{route}', params={'end': '2025-01-02', 'key_code': 'missing'})
            self.assertEqual(r.status_code, 404, r.text)

    def test_filtered_timeline_keeps_zero_months(self):
        r = self.client.get('/api/thefts/timeline', params={'hour_from': 22, 'hour_to': 22})
        self.assertEqual(r.status_code, 200)
        points = {p['month']: p['count'] for p in r.json()['points']}
        self.assertEqual(points.get('2025-01-01'), 1)
        self.assertEqual(points.get('2025-02-01'), 0)
        self.assertEqual(points.get('2025-03-01'), 0)
        self.assertEqual(points.get('2018-01-01'), 0)

    def test_query_constraints(self):
        for params in [{'days': 0}, {'hour_from': -1}, {'hour_to': 24}, {'end': '2025-02-30'}]:
            r = self.client.get('/api/thefts/summary', params={'end': '2025-01-01', **params})
            self.assertEqual(r.status_code, 422)

    def test_pmtiles_range_and_missing_file(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / 'fukuoka.pmtiles'
            path.write_bytes(b'0123456789')
            with patch('bicycle_theft.api.app.PMTILES_PATH', path):
                r = self.client.get('/tiles/fukuoka.pmtiles', headers={'Range': 'bytes=2-5'})
                self.assertEqual(r.status_code, 206)
                self.assertEqual(r.content, b'2345')
                self.assertEqual(r.headers['content-range'], 'bytes 2-5/10')
                self.assertEqual(r.headers['cache-control'], 'no-cache')
                path.unlink()
                self.assertEqual(self.client.get('/tiles/fukuoka.pmtiles').status_code, 404)
