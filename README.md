# EcoClaim

> **AI-verified civic action for cleaner cities.**
> Citizens photograph illegal dumping. Claude verifies the report and assigns a token bounty. Anyone can claim that bounty by photographing the cleaned site — AI re-verifies before tokens are paid out.

Built for Ruse, Bulgaria. Hackathon project by **Irakli Katamadze**, **Luka Khalvashi**, and **Guga Gogua**.

---

## The problem

Illegal dumping is everywhere in Bulgarian cities — riverbanks, alleys, vacant lots — and existing official channels are slow, unverified, and give citizens no incentive to clean up themselves. EcoClaim flips this: every dump becomes a small bounty, and anyone in the community can earn by cleaning it.

## The solution

```
  Spot it  →  Report  →  AI Score  →  Claim  →  Reward
  citizen     photo +    Claude      cleaner    bounty
  finds it    GPS        rates 1-10  uploads    paid in
                                     after-pic  tokens
```

Two AI passes guard the loop:

1. **At report time** — Claude analyzes the photo, scores the hazard 1–10, estimates waste volume in kg, and computes a token bounty (`hazard × 10 + volume_kg`, capped at 500).
2. **At claim time** — Claude compares before/after photos for visual proof of cleanup. A separate GPS check rejects claims taken more than 50m from the original site.

## Fraud prevention — three independent layers

This is the core of the project. Every cleanup claim must pass:

| Layer | Mechanism | What it catches |
|---|---|---|
| **L0 — Self-dealing block** | Schema-level check that `claim.username ≠ report.reported_by` | Users claiming their own reports |
| **L1 — GPS distance** | Haversine math on the after-photo's EXIF GPS vs. original report coords; rejects if > 50m | Photos taken at completely different locations |
| **L2 — AI visual verification** | Claude Opus 4.6 compares both photos, looks at backgrounds/landmarks, prompted about specific fraud patterns | Different angles hiding waste, moved garbage, partial cleanups |

L0 is free. L1 costs a coordinate calculation. L2 is the expensive AI call — but only runs after L0 and L1 pass, so we don't waste credits on obvious fraud.

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite + Tailwind CSS, react-leaflet for the map |
| Backend | FastAPI (Python), uvicorn server, Pydantic request validation |
| AI | Claude Opus 4.6 via official `anthropic` Python SDK |
| Persistence | JSON files + threading lock (hackathon scope) |
| Tunneling | ngrok (for HTTPS, required by browser geolocation) |
| Token (planned) | Solana SPL token on devnet |

---

## Quick start

You need three terminals running simultaneously: backend, ngrok tunnel, frontend.

### Prerequisites

- **Python 3.10+** (3.12 recommended; 3.14 also works)
- **Node.js 20+**
- **An Anthropic API key** ([console.anthropic.com](https://console.anthropic.com))
- **An ngrok account** with the CLI installed ([ngrok.com](https://ngrok.com))

### 1. Clone and configure

```bash
git clone <this-repo-url>
cd EcoClaim-Hackathon
```

Create `ecoclaim-backend/.env`:

```
ANTHROPIC_API_KEY=sk-ant-your-actual-key-here
```

### 2. Backend setup

```bash
cd ecoclaim-backend
python -m venv venv

# Windows PowerShell:
.\venv\Scripts\Activate.ps1
# macOS/Linux:
source venv/bin/activate

pip install -r requirements.txt
```

### 3. Frontend setup

```bash
cd ../ecoclaim-frontend
npm install
```

Create `ecoclaim-frontend/.env` (the URL will come from ngrok in step 4):

```
VITE_API_URL=https://your-ngrok-url-here.ngrok-free.dev
```

### 4. Run everything

**Terminal 1 — backend:**

```bash
cd ecoclaim-backend
# activate venv (see above)
uvicorn main:app --reload --port 8000
```

**Terminal 2 — ngrok tunnel:**

```bash
ngrok http 8000
```

Copy the `https://...ngrok-free.dev` URL it gives you and paste it into `ecoclaim-frontend/.env` as `VITE_API_URL`. **Note: this URL changes every restart on the free tier.**

**Terminal 3 — frontend:**

```bash
cd ecoclaim-frontend
npm run dev
```

Open http://localhost:5173 in your browser. You should see the username gate, then the map with seeded reports.

### 5. (Optional) Seed demo data

To reset the database to a curated demo state with real photos:

```bash
cd ecoclaim-backend
mkdir -p data/seed_photos
# drop 5-7 photos in there with names matching seed.py's expected filenames
python seed.py
```

This wipes existing reports/users/photos and re-seeds from `data/seed_photos/`.

---

## How it works (technical)

### Architecture

```
[Browser]                                 [Anthropic]
    ↓                                      ↑
[Vite dev server :5173]                    │ HTTPS
    ↓                                      │
[ngrok tunnel] ──────────────► [FastAPI :8000] ──→ Claude Opus 4.6
                                       ↓
                               [data/ on disk]
                               - reports.json
                               - users.json
                               - photos/*.jpg
```

Everything runs locally. ngrok provides a public HTTPS URL, which is necessary because browsers refuse to grant geolocation permission on plain HTTP.

### API endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/reports` | List all reports (with photos inlined as base64) |
| `GET` | `/api/users` | Leaderboard data |
| `POST` | `/api/report` | Create new report from photo + GPS; runs Claude analysis |
| `POST` | `/api/claim` | Claim a cleanup; runs GPS check + Claude verification |
| `POST` | `/api/like` | Toggle like on a report |
| `POST` | `/api/comment` | Add a comment to a report |
| `GET` | `/docs` | FastAPI auto-generated Swagger UI for testing |

### Key files

```
ecoclaim-backend/
  main.py             FastAPI app + endpoints
  vision.py           Claude SDK wrapper, ANALYZE_PROMPT and VERIFY_PROMPT
  storage.py          JSON file I/O + image saving + threading lock
  gps.py              EXIF GPS extraction + haversine distance
  seed.py             One-shot script to reset and seed demo data
  data/
    reports.json      Persisted reports
    users.json        Persisted user stats
    photos/           Saved upload images (uuid-named)
    seed_photos/      Source photos for seed.py

ecoclaim-frontend/
  src/
    App.jsx                Top-level state + routing
    lib/
      api.js               Centralized fetch wrapper
      imageCapture.js      File→base64, GPS, downscaling
    components/
      MapView.jsx          Leaflet map with circle markers
      ReportFlowModal.jsx  New-report wizard
      ClaimFlowModal.jsx   Cleanup claim wizard
      ReportModal.jsx      Detail view (likes, comments, share)
      LeaderboardView.jsx  Ranked user table
      ProfileView.jsx      Per-user stats
```

### Data model

**Report:**

```json
{
  "id": "r1714123456789",
  "coordinates": {"lat": 43.8401, "lng": 25.9712},
  "gps_source": "exif | browser | fallback",
  "status": "reported | cleaned",
  "hazard_score": 7,
  "estimated_volume_kg": 80,
  "bounty_tokens": 150,
  "description": "AI-generated one-sentence description",
  "waste_types": ["plastic", "construction", "organic", "hazardous", "mixed"],
  "images": {"before": "/photos/abc.jpg", "after": null},
  "reported_by": "username",
  "claimed_by": null,
  "likes": ["username", ...],
  "comments": [{"id": "...", "user": "...", "text": "...", "timestamp": "..."}],
  "timestamp": "ISO-8601"
}
```

**User:**

```json
{
  "username": "nikola_d",
  "tokens": 290,
  "reports_made": 1,
  "cleanups_completed": 3,
  "kg_cleaned": 130
}
```

### GPS handling

At report time, three sources tried in priority order:

1. **EXIF GPS** from photo metadata (most trustworthy — hard to fake)
2. **Browser geolocation** from `navigator.geolocation` (trivial to spoof, used as fallback)
3. **Ruse center** (43.8356, 25.9657) as last-ditch fallback

The chosen source is recorded as `gps_source` on the report.

### Bounty formula

```python
bounty_tokens = min(500, hazard_score * 10 + estimated_volume_kg)
```

Server-side clamped to `0 ≤ bounty ≤ 500` regardless of what Claude returns.

---

## What's intentionally not in scope (hackathon trade-offs)

- **No real authentication** — usernames are plain strings stored in localStorage
- **No password reset, email verification, 2FA** — required for any production version
- **No moderation tools** — no banning, no content flagging UI
- **No real cryptocurrency** — tokens are accounting units; production would integrate the planned Solana SPL token
- **No mobile app** — web only (works on mobile browsers)
- **No backend tests** — hackathon scope
- **No production deployment** — runs locally via ngrok
- **No multi-process safety** — single-process JSON+lock storage
- **No internationalization** — English UI only

## Where this goes next

- **Sponsor-funded bounties** — local NGOs, businesses, and city councils fund token pools; EcoClaim routes the money to citizens doing the work
- **Verified user accounts** — email signup, moderation, ban-flag system for repeat fraudsters
- **Beyond Ruse** — same model in any city with a dumping problem
- **Other civic actions** — graffiti, potholes, abandoned vehicles all fit the same photo→AI→bounty loop

---

## Project status

Built April 2026 for a hackathon. Fully functional end-to-end: real Claude vision for both modes, real GPS fraud prevention, persistent storage, working likes/comments/share. Several rough edges (single-server demo, ngrok URL changes on restart, no auth) are documented above and are intentional scope cuts.

## Authors

- **Irakli Katamadze**
- **Luka Khalvashi**
- **Guga Gogua**

## Acknowledgments

- Reference architecture and prompt engineering inspired by an earlier Streamlit project (EarthCare) — full-stack rewrite with React + FastAPI for this version.
- Map tiles by OpenStreetMap contributors.
- Vision and verification by [Anthropic Claude](https://www.anthropic.com).
