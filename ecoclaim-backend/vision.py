"""
Claude Vision integration for EcoClaim.
Two functions:
  - analyze_dump(image_path) — for new reports
  - verify_cleanup(before_path, after_path) — for cleanup claims (Phase 7)

Prompts adapted from the EarthCare reference project.
"""
import base64
import json
import os
from pathlib import Path

import anthropic

MODEL = "claude-opus-4-6"
MAX_TOKENS_ANALYZE = 500
MAX_TOKENS_VERIFY = 400


def _get_client() -> anthropic.Anthropic:
    """Lazy-load the client so missing keys don't crash on import."""
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise RuntimeError(
            "ANTHROPIC_API_KEY not set. Add it to ecoclaim-backend/.env"
        )
    return anthropic.Anthropic(api_key=api_key)


def _encode_image(path: str) -> tuple[str, str]:
    """Read an image file, return (base64_data, media_type)."""
    suffix = Path(path).suffix.lower()
    media_type = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".webp": "image/webp",
    }.get(suffix, "image/jpeg")
    with open(path, "rb") as f:
        data = base64.standard_b64encode(f.read()).decode()
    return data, media_type


def _strip_json_fences(text: str) -> str:
    """Claude sometimes wraps JSON in ```json ... ``` fences. Strip them."""
    text = text.strip()
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
        text = text.strip()
    return text


# --- Analyze ---

ANALYZE_PROMPT = """You are an environmental hazard analyst for EcoClaim, a civic platform that pays bounties for cleaning up illegal dumping in Bulgaria.

Analyze this photo and determine if it shows illegal dumping (garbage piles in nature, abandoned waste, fly-tipping). DO NOT count: official garbage bins, construction sites with permits, organized recycling areas, indoor trash.

Respond with ONLY a JSON object, no other text, no markdown fences:
{
  "is_illegal_dump": true/false,
  "hazard_score": 1-10,
  "estimated_volume_kg": integer (rough estimate of waste weight),
  "bounty_tokens": integer (calculate as hazard_score * 10 + estimated_volume_kg, capped at 500),
  "description": "one sentence in English describing what you see",
  "waste_types": ["plastic", "construction", "organic", "hazardous", "mixed"]
}

Hazard scoring guide: 1-3 (litter), 4-7 (household/construction waste), 8-10 (chemicals/industrial/hazardous).

If is_illegal_dump is false, set bounty_tokens to 0."""


def analyze_dump(image_path: str) -> dict:
    """Send a photo to Claude, get hazard analysis + bounty."""
    client = _get_client()
    data, media_type = _encode_image(image_path)

    response = client.messages.create(
        model=MODEL,
        max_tokens=MAX_TOKENS_ANALYZE,
        messages=[{
            "role": "user",
            "content": [
                {"type": "image", "source": {"type": "base64", "media_type": media_type, "data": data}},
                {"type": "text", "text": ANALYZE_PROMPT},
            ],
        }],
    )

    text = _strip_json_fences(response.content[0].text)
    try:
        result = json.loads(text)
    except json.JSONDecodeError:
        return {
            "is_illegal_dump": False,
            "hazard_score": 0,
            "estimated_volume_kg": 0,
            "bounty_tokens": 0,
            "description": "AI response could not be parsed",
            "waste_types": [],
        }

    # Defensive fill-in of any missing keys
    result.setdefault("is_illegal_dump", False)
    result.setdefault("hazard_score", 0)
    result.setdefault("estimated_volume_kg", 0)
    result.setdefault("bounty_tokens", 0)
    result.setdefault("description", "")
    result.setdefault("waste_types", [])
    return result


# --- Verify (Phase 7 will use this) ---
ANALYZE_PROMPT = """You are an environmental hazard analyst for EcoClaim, a civic platform that pays bounties for cleaning up illegal dumping in Bulgaria.

Analyze this photo and determine if it shows illegal dumping (garbage piles in nature, abandoned waste, fly-tipping). DO NOT count: official garbage bins, construction sites with permits, organized recycling areas, indoor trash.

Respond with ONLY a JSON object, no other text, no markdown fences:
{
  "is_illegal_dump": true/false,
  "hazard_score": 1-10,
  "estimated_volume_kg": integer (rough estimate of waste weight; round to nearest 10),
  "bounty_tokens": integer (calculate as hazard_score * 10 + estimated_volume_kg, capped at 500),
  "description": "one sentence in English describing what you see",
  "waste_types": ["plastic", "construction", "organic", "hazardous", "mixed"]
}

Hazard scoring guide: 1-3 (litter), 4-7 (household/construction waste), 8-10 (chemicals/industrial/hazardous).

Volume guidance: be conservative. A few bags = ~10kg. A small pile = ~30kg. Large pile = ~100kg. Truckload = ~500kg. Round to nearest 10.

If is_illegal_dump is false, set bounty_tokens to 0."""


def verify_cleanup(before_path: str, after_path: str) -> dict:
    """Compare before/after photos to verify a cleanup claim."""
    client = _get_client()
    before_data, before_type = _encode_image(before_path)
    after_data, after_type = _encode_image(after_path)

    response = client.messages.create(
        model=MODEL,
        max_tokens=MAX_TOKENS_VERIFY,
        messages=[{
            "role": "user",
            "content": [
                {"type": "text", "text": "BEFORE photo:"},
                {"type": "image", "source": {"type": "base64", "media_type": before_type, "data": before_data}},
                {"type": "text", "text": "AFTER photo:"},
                {"type": "image", "source": {"type": "base64", "media_type": after_type, "data": after_data}},
                {"type": "text", "text": VERIFY_PROMPT},
            ],
        }],
    )

    text = _strip_json_fences(response.content[0].text)
    try:
        result = json.loads(text)
    except json.JSONDecodeError:
        return {
            "same_location": False,
            "cleanup_verified": False,
            "confidence": 0.0,
            "reasoning": "AI response could not be parsed",
        }

    result.setdefault("same_location", False)
    result.setdefault("cleanup_verified", False)
    result.setdefault("confidence", 0.0)
    result.setdefault("reasoning", "")
    return result