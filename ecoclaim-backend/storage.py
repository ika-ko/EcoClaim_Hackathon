"""
JSON-based persistence for EcoClaim.
- reports.json: list of report dicts
- users.json: dict of {username: stats}
- data/photos/: saved image files

Uses a threading lock around all reads/writes so concurrent requests don't corrupt files.
"""
import base64
import json
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

DATA_DIR = Path(__file__).parent / "data"
REPORTS_FILE = DATA_DIR / "reports.json"
USERS_FILE = DATA_DIR / "users.json"
PHOTOS_DIR = DATA_DIR / "photos"

_lock = threading.Lock()


# --- Initial seed data (used only on first run, when reports.json doesn't exist) ---

SEED_REPORTS = [
    {
        "id": "demo1",
        "coordinates": {"lat": 43.8356, "lng": 25.9657},
        "status": "reported",
        "hazard_score": 8,
        "estimated_volume_kg": 60,
        "bounty_tokens": 140,
        "description": "Large pile of mixed household waste and plastic bags on a sidewalk",
        "waste_types": ["plastic", "mixed"],
        "images": {"before": None, "after": None},
        "reported_by": "ivan_petrov",
        "claimed_by": None,
        "likes": ["maria_g", "stefan99"],
        "comments": [
            {
                "id": "c1",
                "user": "maria_g",
                "text": "I walk past this every morning. Awful.",
                "timestamp": "2026-04-20T08:30:00Z",
            }
        ],
        "timestamp": "2026-04-19T14:22:00Z",
    },
    {
        "id": "demo2",
        "coordinates": {"lat": 43.8401, "lng": 25.9712},
        "status": "reported",
        "hazard_score": 4,
        "estimated_volume_kg": 15,
        "bounty_tokens": 55,
        "description": "Scattered litter and food packaging near a bench",
        "waste_types": ["plastic", "organic"],
        "images": {"before": None, "after": None},
        "reported_by": "stefan99",
        "claimed_by": None,
        "likes": [],
        "comments": [],
        "timestamp": "2026-04-22T11:05:00Z",
    },
    {
        "id": "demo3",
        "coordinates": {"lat": 43.832, "lng": 25.96},
        "status": "cleaned",
        "hazard_score": 6,
        "estimated_volume_kg": 40,
        "bounty_tokens": 100,
        "description": "Construction debris and broken tiles dumped in a vacant lot",
        "waste_types": ["construction", "mixed"],
        "images": {"before": None, "after": None},
        "reported_by": "ivan_petrov",
        "claimed_by": "nikola_d",
        "likes": ["ivan_petrov", "maria_g", "stefan99"],
        "comments": [
            {
                "id": "c2",
                "user": "ivan_petrov",
                "text": "Thank you! Looks great now.",
                "timestamp": "2026-04-23T16:45:00Z",
            }
        ],
        "timestamp": "2026-04-18T09:10:00Z",
    },
]

SEED_USERS = {
    "nikola_d": {"tokens": 145, "reports_made": 3, "cleanups_completed": 7, "kg_cleaned": 240},
    "maria_g": {"tokens": 90, "reports_made": 5, "cleanups_completed": 4, "kg_cleaned": 130},
    "ivan_petrov": {"tokens": 60, "reports_made": 8, "cleanups_completed": 2, "kg_cleaned": 50},
    "stefan99": {"tokens": 35, "reports_made": 2, "cleanups_completed": 1, "kg_cleaned": 20},
}


def init_storage():
    """Create data files and folders if they don't exist."""
    DATA_DIR.mkdir(exist_ok=True)
    PHOTOS_DIR.mkdir(exist_ok=True)
    if not REPORTS_FILE.exists():
        _write_json(REPORTS_FILE, SEED_REPORTS)
    if not USERS_FILE.exists():
        _write_json(USERS_FILE, SEED_USERS)


# --- Low-level file helpers ---

def _read_json(path: Path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def _write_json(path: Path, data):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


# --- Image handling ---

def save_image_from_data_url(data_url: str) -> str:
    """
    Decode a base64 data URL and save it to data/photos/.
    Returns the relative URL path (e.g. /photos/abc123.jpg).
    """
    if not data_url.startswith("data:image"):
        raise ValueError("Not a data URL")

    # Format: data:image/jpeg;base64,<payload>
    header, _, payload = data_url.partition(",")
    media_type = header.split(";")[0].split(":")[1]  # image/jpeg
    ext_map = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}
    ext = ext_map.get(media_type, ".jpg")

    filename = f"{uuid.uuid4().hex}{ext}"
    path = PHOTOS_DIR / filename
    with open(path, "wb") as f:
        f.write(base64.b64decode(payload))

    return f"/photos/{filename}"


def get_photo_path(filename: str) -> Optional[Path]:
    """Resolve a photo URL to its file path on disk."""
    safe_name = Path(filename).name  # strip any path traversal
    path = PHOTOS_DIR / safe_name
    return path if path.exists() else None


# --- Reports ---

def list_reports() -> list:
    with _lock:
        return _read_json(REPORTS_FILE)


def get_report(report_id: str) -> Optional[dict]:
    with _lock:
        for r in _read_json(REPORTS_FILE):
            if r["id"] == report_id:
                return r
    return None


def add_report(report: dict) -> dict:
    with _lock:
        reports = _read_json(REPORTS_FILE)
        reports.insert(0, report)
        _write_json(REPORTS_FILE, reports)
    return report


def update_report(report_id: str, updates: dict) -> Optional[dict]:
    with _lock:
        reports = _read_json(REPORTS_FILE)
        for r in reports:
            if r["id"] == report_id:
                r.update(updates)
                _write_json(REPORTS_FILE, reports)
                return r
    return None


def add_comment_to_report(report_id: str, comment: dict) -> Optional[dict]:
    with _lock:
        reports = _read_json(REPORTS_FILE)
        for r in reports:
            if r["id"] == report_id:
                r["comments"].append(comment)
                _write_json(REPORTS_FILE, reports)
                return r
    return None


def toggle_like(report_id: str, username: str) -> Optional[dict]:
    """Returns updated report or None."""
    with _lock:
        reports = _read_json(REPORTS_FILE)
        for r in reports:
            if r["id"] == report_id:
                if username in r["likes"]:
                    r["likes"].remove(username)
                else:
                    r["likes"].append(username)
                _write_json(REPORTS_FILE, reports)
                return r
    return None


# --- Users ---

def list_users() -> list:
    with _lock:
        users = _read_json(USERS_FILE)
    return [{"username": u, **stats} for u, stats in users.items()]


def get_or_create_user(username: str) -> dict:
    with _lock:
        users = _read_json(USERS_FILE)
        if username not in users:
            users[username] = {
                "tokens": 0,
                "reports_made": 0,
                "cleanups_completed": 0,
                "kg_cleaned": 0,
            }
            _write_json(USERS_FILE, users)
        return {"username": username, **users[username]}


def increment_user_stat(username: str, **deltas) -> dict:
    """e.g. increment_user_stat("maria_g", tokens=20, cleanups_completed=1)"""
    with _lock:
        users = _read_json(USERS_FILE)
        if username not in users:
            users[username] = {
                "tokens": 0,
                "reports_made": 0,
                "cleanups_completed": 0,
                "kg_cleaned": 0,
            }
        for key, delta in deltas.items():
            users[username][key] = users[username].get(key, 0) + delta
        _write_json(USERS_FILE, users)
        return {"username": username, **users[username]}