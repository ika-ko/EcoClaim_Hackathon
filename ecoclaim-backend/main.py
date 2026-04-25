"""
EcoClaim backend — FastAPI app.
Endpoints for reports, claims, likes, comments. Real Claude vision + GPS fraud check.
"""
from dotenv import load_dotenv
load_dotenv()  # MUST run before any import that reads env vars

from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

import storage
import vision
import gps

GPS_TOLERANCE_METERS = 50

app = FastAPI(title="EcoClaim API", version="0.7.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize storage on startup
storage.init_storage()

# Serve saved photos at /photos/<filename>
app.mount("/photos", StaticFiles(directory=storage.PHOTOS_DIR), name="photos")


# --- Pydantic models ---

class ReportCreate(BaseModel):
    username: str = Field(..., min_length=3)
    image: str
    lat: Optional[float] = None
    lng: Optional[float] = None


class ClaimCreate(BaseModel):
    report_id: str
    username: str = Field(..., min_length=3)
    image: str


class LikeToggle(BaseModel):
    report_id: str
    username: str = Field(..., min_length=3)


class CommentCreate(BaseModel):
    report_id: str
    username: str = Field(..., min_length=3)
    text: str = Field(..., min_length=1, max_length=500)


# --- Endpoints ---

@app.get("/")
def root():
    return {"status": "ok", "service": "EcoClaim API", "version": "0.7.0"}


@app.get("/api/reports")
def list_reports():
    return storage.list_reports()


@app.get("/api/users")
def list_users():
    return storage.list_users()


@app.post("/api/report")
def create_report(payload: ReportCreate):
    if not payload.image.startswith("data:image"):
        raise HTTPException(status_code=400, detail="Image must be a base64 data URL")

    # Save image to disk
    try:
        photo_url = storage.save_image_from_data_url(payload.image)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not save image: {e}")

    absolute_photo_path = storage.PHOTOS_DIR / Path(photo_url).name

    # Try EXIF GPS first; fall back to browser-supplied coords
    exif_gps = gps.extract_gps(str(absolute_photo_path))
    if exif_gps:
        final_lat, final_lng = exif_gps
        gps_source = "exif"
    elif payload.lat is not None and payload.lng is not None:
        final_lat, final_lng = payload.lat, payload.lng
        gps_source = "browser"
    else:
        final_lat, final_lng = 43.8356, 25.9657  # Ruse center fallback
        gps_source = "fallback"

    # Run real Claude analysis
    try:
        analysis = vision.analyze_dump(str(absolute_photo_path))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI analysis failed: {e}")

    if not analysis["is_illegal_dump"]:
        raise HTTPException(
            status_code=422,
            detail={
                "error": "not_a_dump",
                "message": "AI did not identify this as illegal dumping.",
                "description": analysis.get("description", ""),
            },
        )

    new_report = {
        "id": f"r{int(datetime.now().timestamp() * 1000)}",
        "coordinates": {"lat": final_lat, "lng": final_lng},
        "gps_source": gps_source,
        "status": "reported",
        "hazard_score": analysis["hazard_score"],
        "estimated_volume_kg": analysis["estimated_volume_kg"],
        "bounty_tokens": analysis["bounty_tokens"],
        "description": analysis["description"],
        "waste_types": analysis["waste_types"],
        "images": {"before": photo_url, "after": None},
        "reported_by": payload.username,
        "claimed_by": None,
        "likes": [],
        "comments": [],
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    storage.add_report(new_report)
    storage.get_or_create_user(payload.username)
    storage.increment_user_stat(payload.username, reports_made=1)

    return new_report


@app.post("/api/claim")
def claim_cleanup(payload: ClaimCreate):
    report = storage.get_report(payload.report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    if report["status"] != "reported":
        raise HTTPException(status_code=400, detail="Report is already cleaned")

    # Layer 0: self-dealing check
    if report["reported_by"] == payload.username:
        raise HTTPException(
            status_code=403,
            detail="You cannot claim a cleanup on a report you created",
        )

    if not payload.image.startswith("data:image"):
        raise HTTPException(status_code=400, detail="Image must be a base64 data URL")

    # Save the after photo
    try:
        after_url = storage.save_image_from_data_url(payload.image)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not save image: {e}")

    after_path = storage.PHOTOS_DIR / Path(after_url).name

    # Layer 1: GPS distance check (cheap, blocks gross fraud)
    after_gps = gps.extract_gps(str(after_path))
    distance_m = None
    if after_gps:
        distance_m = gps.haversine_meters(
            report["coordinates"]["lat"],
            report["coordinates"]["lng"],
            after_gps[0],
            after_gps[1],
        )
        if distance_m > GPS_TOLERANCE_METERS:
            return {
                "success": False,
                "verification": {
                    "same_location": False,
                    "cleanup_verified": False,
                    "confidence": 0.0,
                    "reasoning": (
                        f"GPS check failed: cleanup photo was taken "
                        f"{distance_m:.0f}m from the reported site "
                        f"(maximum allowed: {GPS_TOLERANCE_METERS}m)."
                    ),
                },
                "gps_check": {"distance_m": round(distance_m, 1), "passed": False},
            }

    # Layer 2: Claude visual verification
    before_url = report["images"].get("before")
    if not before_url:
        raise HTTPException(
            status_code=400,
            detail="Original report has no before photo to compare against",
        )
    before_path = storage.PHOTOS_DIR / Path(before_url).name

    try:
        verification = vision.verify_cleanup(str(before_path), str(after_path))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI verification failed: {e}")

    gps_check = (
        {"distance_m": round(distance_m, 1), "passed": True}
        if distance_m is not None
        else {"distance_m": None, "passed": None}
    )

    if verification["same_location"] and verification["cleanup_verified"]:
        storage.update_report(
            payload.report_id,
            {
                "status": "cleaned",
                "claimed_by": payload.username,
                "images": {**report["images"], "after": after_url},
            },
        )
        storage.get_or_create_user(payload.username)
        storage.increment_user_stat(
            payload.username,
            tokens=report["bounty_tokens"],
            cleanups_completed=1,
            kg_cleaned=report["estimated_volume_kg"],
        )
        return {"success": True, "verification": verification, "gps_check": gps_check}
    else:
        return {"success": False, "verification": verification, "gps_check": gps_check}


@app.post("/api/like")
def toggle_like(payload: LikeToggle):
    storage.get_or_create_user(payload.username)
    updated = storage.toggle_like(payload.report_id, payload.username)
    if not updated:
        raise HTTPException(status_code=404, detail="Report not found")
    return {
        "report_id": payload.report_id,
        "liked": payload.username in updated["likes"],
        "likes_count": len(updated["likes"]),
    }


@app.post("/api/comment")
def add_comment(payload: CommentCreate):
    storage.get_or_create_user(payload.username)
    new_comment = {
        "id": f"c{int(datetime.now().timestamp() * 1000)}",
        "user": payload.username,
        "text": payload.text,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    updated = storage.add_comment_to_report(payload.report_id, new_comment)
    if not updated:
        raise HTTPException(status_code=404, detail="Report not found")
    return new_comment