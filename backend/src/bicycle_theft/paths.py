"""Locations of the data directories, which live at the repository root and are shared with the frontend."""

from pathlib import Path

# backend/src/bicycle_theft/paths.py -> repository root
REPO_ROOT = Path(__file__).resolve().parents[3]
DATA_DIR = REPO_ROOT / "data"
RAW_DIR = DATA_DIR / "raw"
PROCESSED_DIR = DATA_DIR / "processed"
