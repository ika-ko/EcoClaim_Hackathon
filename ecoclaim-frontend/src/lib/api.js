const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

// Wraps fetch with ngrok-skip header and JSON handling
async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "ngrok-skip-browser-warning": "true",
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    let errMsg = `HTTP ${res.status}`;
    let errDetail = null;
    try {
      const errBody = await res.json();
      // detail can be a string OR a structured object (FastAPI lets us return either)
      if (typeof errBody.detail === "string") {
        errMsg = errBody.detail;
      } else if (errBody.detail && typeof errBody.detail === "object") {
        errDetail = errBody.detail;
        errMsg = errBody.detail.message || JSON.stringify(errBody.detail);
      }
    } catch {
      // body wasn't JSON, leave the default
    }
    const err = new Error(errMsg);
    err.status = res.status;
    err.detail = errDetail;
    throw err;
  }

  return res.json();
}

// --- API methods ---

export function fetchReports() {
  return request("/api/reports");
}

export function fetchUsers() {
  return request("/api/users");
}

export function createReport({ username, image, lat, lng }) {
  return request("/api/report", {
    method: "POST",
    body: JSON.stringify({ username, image, lat, lng }),
  });
}

export function claimCleanup({ report_id, username, image }) {
  return request("/api/claim", {
    method: "POST",
    body: JSON.stringify({ report_id, username, image }),
  });
}

export function toggleLike({ report_id, username }) {
  return request("/api/like", {
    method: "POST",
    body: JSON.stringify({ report_id, username }),
  });
}

export function addComment({ report_id, username, text }) {
  return request("/api/comment", {
    method: "POST",
    body: JSON.stringify({ report_id, username, text }),
  });
}
// Resolve a relative photo path from the backend to a full URL
export function photoUrl(path) {
  if (!path) return null;
  if (path.startsWith("http")) return path; // already absolute (e.g., data URL)
  if (path.startsWith("data:")) return path;
  return `${BASE_URL}${path}`;
}
export function formatKg(kg) {
  if (!kg || kg <= 0) return "0";
  const rounded = Math.round(kg / 10) * 10;
  return `~${rounded}`;
}