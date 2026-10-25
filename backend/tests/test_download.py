import io
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from bicycle_theft import download_pmtiles as download


class DownloadTests(unittest.TestCase):
    def test_metadata_request_has_finite_timeout(self):
        with patch.object(download, "urlopen", return_value=io.BytesIO(b'[{"key":"20251001.pmtiles"}]')) as urlopen:
            self.assertEqual(download.latest_build_key(), "20251001.pmtiles")
        self.assertEqual(urlopen.call_args.kwargs.get("timeout"), 30)

    def test_failed_extract_is_cleaned_and_keeps_previous_basemap(self):
        with tempfile.TemporaryDirectory() as temp:
            output = Path(temp) / "fukuoka.pmtiles"
            output.write_bytes(b"previous")

            def fail(command, **kwargs):
                Path(command[3]).write_bytes(b"partial")
                raise RuntimeError("network error")

            with (
                patch.object(download, "OUTPUT", output),
                patch.object(download, "latest_build_key", return_value="20251001.pmtiles"),
                patch.object(download, "census_bbox", return_value="0,0,1,1"),
                patch.object(download.subprocess, "run", side_effect=fail),
            ):
                with self.assertRaises(RuntimeError):
                    download.main()
            self.assertEqual(output.read_bytes(), b"previous")
            self.assertEqual(list(Path(temp).iterdir()), [output])

    def test_successful_extract_atomically_replaces_basemap(self):
        with tempfile.TemporaryDirectory() as temp:
            output = Path(temp) / "raw" / "fukuoka.pmtiles"

            def extract(command, **kwargs):
                Path(command[3]).write_bytes(b"new")

            with (
                patch.object(download, "OUTPUT", output),
                patch.object(download, "latest_build_key", return_value="20251001.pmtiles"),
                patch.object(download, "census_bbox", return_value="0,0,1,1"),
                patch.object(download.subprocess, "run", side_effect=extract),
            ):
                download.main()
            self.assertEqual(output.read_bytes(), b"new")
            self.assertEqual(list(output.parent.iterdir()), [output])
