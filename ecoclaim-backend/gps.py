"""
GPS utilities — EXIF extraction + haversine distance.
Adapted from the EarthCare reference project.
"""
import math
from pathlib import Path
from typing import Optional

from PIL import Image
from PIL.ExifTags import GPSTAGS, TAGS


def _convert_to_degrees(value) -> float:
    """Convert EXIF GPS coordinate (deg, min, sec) tuple to decimal degrees."""
    d, m, s = value
    return float(d) + float(m) / 60.0 + float(s) / 3600.0


def extract_gps(photo_path: str) -> Optional[tuple[float, float]]:
    """
    Pull (lat, lon) from photo EXIF metadata. Returns None if no GPS data.
    Most modern phone cameras embed this; browser-uploaded photos may have it stripped.
    """
    try:
        img = Image.open(photo_path)
        exif = img._getexif()
        if not exif:
            return None

        gps_info = {}
        for tag, value in exif.items():
            if TAGS.get(tag) == "GPSInfo":
                for k, v in value.items():
                    gps_info[GPSTAGS.get(k, k)] = v

        if not gps_info or "GPSLatitude" not in gps_info:
            return None

        lat = _convert_to_degrees(gps_info["GPSLatitude"])
        if gps_info.get("GPSLatitudeRef") == "S":
            lat = -lat

        lon = _convert_to_degrees(gps_info["GPSLongitude"])
        if gps_info.get("GPSLongitudeRef") == "W":
            lon = -lon

        return (lat, lon)
    except Exception:
        return None


def haversine_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Distance between two GPS points in meters."""
    R = 6371000  # Earth radius in meters
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lon2 - lon1)
    a = (
        math.sin(dphi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    )
    return 2 * R * math.asin(math.sqrt(a))