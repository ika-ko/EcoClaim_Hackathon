"""
Reset and re-seed the EcoClaim database with curated demo data.
Run this before a demo to ensure a known, clean starting state.

Usage:
    python seed.py
"""
import json
import shutil
import sys
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

DATA_DIR = Path(__file__).parent / "data"
SEED_PHOTOS_DIR = DATA_DIR / "seed_photos"
PHOTOS_DIR = DATA_DIR / "photos"
REPORTS_FILE = DATA_DIR / "reports.json"
USERS_FILE = DATA_DIR / "users.json"

# --- Edit this to match your photos and intended seed data ---

# Each entry creates one report. The photo file must exist in data/seed_photos/.
SEED_REPORTS = [
    {
        "before_photo": "dump_riverside.jpeg",
        "after_photo": None,  # not yet cleaned
        "coordinates": {"lat": 43.8401, "lng": 25.9712},  # Danube riverside
        "status": "reported",
        "hazard_score": 7,
        "estimated_volume_kg": 80,
        "bounty_tokens": 150,
        "description": "Large pile of construction debris and household waste dumped along the Danube riverbank",
        "waste_types": ["construction", "mixed"],
        "reported_by": "ivan_petrov",
        "claimed_by": None,
        "likes": ["maria_g", "stefan99"],
        "comments": [
            {
                "user": "maria_g",
                "text": "I jog past this every morning. Has been here for 2 weeks.",
            },
        ],
        "days_ago": 5,
    },
    {
        "before_photo": "dump_park.jpeg",
        "after_photo": None,
        "coordinates": {"lat": 43.8512, "lng": 25.9534},  # near a park
        "status": "reported",
        "hazard_score": 4,
        "estimated_volume_kg": 20,
        "bounty_tokens": 60,
        "description": "Scattered plastic bags and food packaging in green area",
        "waste_types": ["plastic", "organic"],
        "reported_by": "stefan99",
        "claimed_by": None,
        "likes": ["maria_g"],
        "comments": [],
        "days_ago": 3,
    },
    {
        "before_photo": "dump_construction.jpeg",
        "after_photo": None,
        "coordinates": {"lat": 43.8290, "lng": 25.9580},  # vacant lot
        "status": "reported",
        "hazard_score": 8,
        "estimated_volume_kg": 150,
        "bounty_tokens": 230,
        "description": "Abandoned construction waste with broken concrete and rebar",
        "waste_types": ["construction", "hazardous"],
        "reported_by": "elena_k",
        "claimed_by": None,
        "likes": [],
        "comments": [
            {
                "user": "ivan_petrov",
                "text": "This is dangerous, kids play near here.",
            },
        ],
        "days_ago": 2,
    },
    {
        "before_photo": "dump_alley.jpeg",
        "after_photo": None,
        "coordinates": {"lat": 43.8380, "lng": 25.9690},  # alley
        "status": "reported",
        "hazard_score": 3,
        "estimated_volume_kg": 15,
        "bounty_tokens": 40,
        "description": "Litter and bottles accumulated in narrow alley",
        "waste_types": ["mixed"],
        "reported_by": "nikola_d",
        "claimed_by": None,
        "likes": ["elena_k"],
        "comments": [],
        "days_ago": 1,
    },
    {
        # Before/after pair — this one is CLEANED
        "before_photo": "cleaned_before.jpeg",
        "after_photo": "cleaned_after.jpeg",
        "coordinates": {"lat": 43.8420, "lng": 25.9620},
        "status": "cleaned",
        "hazard_score": 6,
        "estimated_volume_kg": 50,
        "bounty_tokens": 110,
        "description": "Household waste pile next to a fence",
        "waste_types": ["mixed", "plastic"],
        "reported_by": "ivan_petrov",
        "claimed_by": "nikola_d",
        "likes": ["maria_g", "stefan99", "ivan_petrov"],
        "comments": [
            {
                "user": "ivan_petrov",
                "text": "Thank you! The area looks completely clean now.",
            },
        ],
        "days_ago": 7,
    },
]

SEED_USERS = {
    "nikola_d": {"tokens": 290, "reports_made": 1, "cleanups_completed": 3, "kg_cleaned": 130},
    "maria_g": {"tokens": 90, "reports_made": 2, "cleanups_completed": 1, "kg_cleaned": 30},
    "ivan_petrov": {"tokens": 60, "reports_made": 4, "cleanups_completed": 1, "kg_cleaned": 20},
    "stefan99": {"tokens": 35, "reports_made": 1, "cleanups_completed": 1, "kg_cleaned": 15},
    "elena_k": {"tokens": 0, "reports_made": 1, "cleanups_completed": 0, "kg_cleaned": 0},
}


def confirm():
    print("This will WIPE all current reports, users, and uploaded photos.")
    print("Are you sure? (type 'yes' to continue)")
    if input("> ").strip().lower() != "yes":
        print("Aborted.")
        sys.exit(0)


def copy_seed_photo(name: str) -> str:
    """
    Copy a seed photo into data/photos/ with a uuid name. Return the URL path.
    The `name` can be the filename with or without extension — we'll find it.
    """
    src = SEED_PHOTOS_DIR / name
    if not src.exists():
        # Try common extensions
        stem = Path(name).stem
        for ext in (".jpg", ".jpeg", ".png", ".webp"):
            candidate = SEED_PHOTOS_DIR / f"{stem}{ext}"
            if candidate.exists():
                src = candidate
                break
        else:
            raise FileNotFoundError(f"Seed photo not found: {name} (tried .jpg, .jpeg, .png, .webp)")
    suffix = src.suffix.lower()
    dst_name = f"{uuid.uuid4().hex}{suffix}"
    dst = PHOTOS_DIR / dst_name
    shutil.copy2(src, dst)
    return f"/photos/{dst_name}"

def main():
    if not SEED_PHOTOS_DIR.exists():
        print(f"Seed photos directory not found: {SEED_PHOTOS_DIR}")
        print("Create data/seed_photos/ and add your photos before running.")
        sys.exit(1)

    confirm()

    # Wipe existing photos and JSON files
    if PHOTOS_DIR.exists():
        shutil.rmtree(PHOTOS_DIR)
    PHOTOS_DIR.mkdir(parents=True)

    # Build reports
    now = datetime.now(timezone.utc)
    reports = []
    for i, seed in enumerate(SEED_REPORTS):
        try:
            before_url = copy_seed_photo(seed["before_photo"])
            after_url = (
                copy_seed_photo(seed["after_photo"])
                if seed["after_photo"]
                else None
            )
        except FileNotFoundError as e:
            print(f"Skipping report {i+1}: {e}")
            continue

        timestamp = (now - timedelta(days=seed["days_ago"])).isoformat()
        comments = [
            {
                "id": f"c_seed_{i}_{j}",
                "user": c["user"],
                "text": c["text"],
                "timestamp": timestamp,
            }
            for j, c in enumerate(seed["comments"])
        ]

        reports.append({
            "id": f"seed_{i+1}",
            "coordinates": seed["coordinates"],
            "gps_source": "seed",
            "status": seed["status"],
            "hazard_score": seed["hazard_score"],
            "estimated_volume_kg": seed["estimated_volume_kg"],
            "bounty_tokens": seed["bounty_tokens"],
            "description": seed["description"],
            "waste_types": seed["waste_types"],
            "images": {"before": before_url, "after": after_url},
            "reported_by": seed["reported_by"],
            "claimed_by": seed["claimed_by"],
            "likes": seed["likes"],
            "comments": comments,
            "timestamp": timestamp,
        })

    # Write reports + users
    with open(REPORTS_FILE, "w", encoding="utf-8") as f:
        json.dump(reports, f, indent=2, ensure_ascii=False)
    with open(USERS_FILE, "w", encoding="utf-8") as f:
        json.dump(SEED_USERS, f, indent=2, ensure_ascii=False)

    print(f"Seeded {len(reports)} reports and {len(SEED_USERS)} users.")
    print("Restart the backend to pick up the new data.")


if __name__ == "__main__":
    main()