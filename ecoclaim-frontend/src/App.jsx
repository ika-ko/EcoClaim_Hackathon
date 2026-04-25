import { useState, useEffect } from "react";
import Sidebar from "./components/Sidebar";
import UsernameGate from "./components/UsernameGate";
import MapView from "./components/MapView";
import LeaderboardView from "./components/LeaderboardView";
import ProfileView from "./components/ProfileView";
import ReportModal from "./components/ReportModal";
import ReportFlowModal from "./components/ReportFlowModal";
import ClaimFlowModal from "./components/ClaimFlowModal";
import * as api from "./lib/api";

export default function App() {
  const [username, setUsername] = useState(null);
  const [currentView, setCurrentView] = useState("map");
  const [reports, setReports] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [selectedReport, setSelectedReport] = useState(null);
  const [showReportFlow, setShowReportFlow] = useState(false);
  const [claimingReport, setClaimingReport] = useState(null);

  useEffect(() => {
    const stored = localStorage.getItem("ecoclaim_username");
    if (stored) setUsername(stored);
  }, []);

  // Load data from backend on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [reportsData, usersData] = await Promise.all([
          api.fetchReports(),
          api.fetchUsers(),
        ]);
        if (cancelled) return;
        setReports(reportsData);
        setUsers(usersData);
        setLoadError(null);
      } catch (err) {
        if (!cancelled) setLoadError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleUsernameSubmit = (name) => {
    localStorage.setItem("ecoclaim_username", name);
    setUsername(name);
    setUsers((prev) =>
      prev.some((u) => u.username === name)
        ? prev
        : [
            ...prev,
            {
              username: name,
              tokens: 0,
              reports_made: 0,
              cleanups_completed: 0,
              kg_cleaned: 0,
            },
          ]
    );
  };

  const handleLogout = () => {
    localStorage.removeItem("ecoclaim_username");
    setUsername(null);
  };

  // --- Report mutations ---
const handleNewReport = async ({ image, lat, lng }) => {
  // Don't wrap the error — let the modal see the original err.detail
  const newReport = await api.createReport({
    username,
    image,
    lat,
    lng,
  });
  setReports((prev) => [newReport, ...prev]);
  setUsers((prev) =>
    prev.map((u) =>
      u.username === username
        ? { ...u, reports_made: u.reports_made + 1 }
        : u
    )
  );
  setShowReportFlow(false);
  return newReport;
};
  const handleClaimSubmit = async ({ report_id, image }) => {
  const result = await api.claimCleanup({
    report_id,
    username,
    image,
  });
  if (!result.success) {
    return result;
  }
  const claimed = reports.find((r) => r.id === report_id);
  const bounty = claimed?.bounty_tokens || 0;
  const volumeKg = claimed?.estimated_volume_kg || 0;

  setReports((prev) =>
    prev.map((r) =>
      r.id === report_id
        ? {
            ...r,
            status: "cleaned",
            claimed_by: username,
            images: { ...r.images, after: image },
          }
        : r
    )
  );
  setUsers((prev) =>
    prev.map((u) =>
      u.username === username
        ? {
            ...u,
            tokens: u.tokens + bounty,
            cleanups_completed: u.cleanups_completed + 1,
            kg_cleaned: (u.kg_cleaned || 0) + volumeKg,
          }
        : u
    )
  );
  setSelectedReport((sr) =>
    sr?.id === report_id
      ? {
          ...sr,
          status: "cleaned",
          claimed_by: username,
          images: { ...sr.images, after: image },
        }
      : sr
  );
  setClaimingReport(null);
  return result;
};

  const handleLikeToggle = async (reportId) => {
    // Optimistic update
    setReports((prev) =>
      prev.map((r) => {
        if (r.id !== reportId) return r;
        const liked = r.likes.includes(username);
        return {
          ...r,
          likes: liked
            ? r.likes.filter((u) => u !== username)
            : [...r.likes, username],
        };
      })
    );
    setSelectedReport((sr) => {
      if (sr?.id !== reportId) return sr;
      const liked = sr.likes.includes(username);
      return {
        ...sr,
        likes: liked
          ? sr.likes.filter((u) => u !== username)
          : [...sr.likes, username],
      };
    });

    try {
      await api.toggleLike({ report_id: reportId, username });
    } catch (err) {
      console.error("Like failed:", err.message);
      // Could roll back here in a real app
    }
  };

  const handleAddComment = async (reportId, text) => {
    try {
      const newComment = await api.addComment({
        report_id: reportId,
        username,
        text,
      });
      setReports((prev) =>
        prev.map((r) =>
          r.id === reportId
            ? { ...r, comments: [...r.comments, newComment] }
            : r
        )
      );
      setSelectedReport((sr) =>
        sr?.id === reportId
          ? { ...sr, comments: [...sr.comments, newComment] }
          : sr
      );
    } catch (err) {
      console.error("Comment failed:", err.message);
    }
  };

  const handleClaimClick = (report) => {
    setSelectedReport(null);
    setClaimingReport(report);
  };

  if (!username) {
    return <UsernameGate onSubmit={handleUsernameSubmit} />;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-10 h-10 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mb-4" />
          <p className="text-slate-300">Loading EcoClaim...</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
        <div className="bg-slate-800 rounded-2xl p-8 max-w-md text-center border border-red-500/30">
          <div className="text-4xl mb-3">⚠️</div>
          <h2 className="text-xl font-bold text-white mb-2">
            Could not reach the backend
          </h2>
          <p className="text-slate-400 text-sm mb-4">{loadError}</p>
          <p className="text-xs text-slate-500 mb-4">
            Make sure the FastAPI server and ngrok tunnel are both running.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="bg-emerald-500 hover:bg-emerald-600 text-white font-semibold px-6 py-2 rounded-lg transition"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-slate-900">
      <Sidebar
        currentView={currentView}
        onNavigate={setCurrentView}
        username={username}
        onLogout={handleLogout}
      />

      <main className="flex-1 overflow-hidden">
        {currentView === "map" && (
          <MapView
            reports={reports}
            onMarkerClick={setSelectedReport}
            onReportClick={() => setShowReportFlow(true)}
          />
        )}
        {currentView === "leaderboard" && (
          <LeaderboardView users={users} currentUsername={username} />
        )}
        {currentView === "profile" && (
          <ProfileView username={username} users={users} reports={reports} />
        )}
      </main>

      <ReportModal
        report={selectedReport}
        onClose={() => setSelectedReport(null)}
        currentUsername={username}
        onLikeToggle={handleLikeToggle}
        onAddComment={handleAddComment}
        onClaim={handleClaimClick}
      />

      {showReportFlow && (
        <ReportFlowModal
          onClose={() => setShowReportFlow(false)}
          onSubmit={handleNewReport}
        />
      )}

      {claimingReport && (
        <ClaimFlowModal
          report={claimingReport}
          onClose={() => setClaimingReport(null)}
          onSubmit={handleClaimSubmit}
        />
      )}
    </div>
  );
}