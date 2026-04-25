import { useState } from "react";
import { photoUrl } from "../lib/api";
import { formatKg } from "../lib/api";
export default function ReportModal({
  report,
  onClose,
  currentUsername,
  onLikeToggle,
  onAddComment,
  onClaim,
}) {
  const [commentText, setCommentText] = useState("");
  const [shareMessage, setShareMessage] = useState("");

  if (!report) return null;

  const isReported = report.status === "reported";
  const isMine = report.reported_by === currentUsername;
  const hasLiked = report.likes.includes(currentUsername);

  const handleAddComment = (e) => {
    e.preventDefault();
    const trimmed = commentText.trim();
    if (!trimmed) return;
    onAddComment(report.id, trimmed);
    setCommentText("");
  };

  const handleShare = async () => {
    const shareData = {
      title: "EcoClaim report",
      text: `Help clean up Ruse — hazard ${report.hazard_score}/10, ${report.bounty_value} token bounty`,
      url: `${window.location.origin}/?report=${report.id}`,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(shareData.url);
        setShareMessage("Link copied!");
        setTimeout(() => setShareMessage(""), 2000);
      }
    } catch {
      // user cancelled, do nothing
    }
  };

  // Show photo if we have it (from a real report), otherwise placeholder
  const photoSrc = photoUrl(report.images?.before);

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-[2000] p-4"
      onClick={onClose}
    >
      <div
        className="bg-slate-800 rounded-2xl border border-slate-700 max-w-lg w-full max-h-[90vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-slate-700 flex items-start justify-between">
          <div>
            <span
              className={`inline-block px-2 py-1 rounded text-xs font-semibold ${
                isReported
                  ? "bg-red-500/20 text-red-400"
                  : "bg-emerald-500/20 text-emerald-400"
              }`}
            >
              {isReported ? "REPORTED" : "CLEANED"}
            </span>
            <h3 className="text-xl font-bold text-white mt-2">
            Hazard {report.hazard_score}/10 · {report.bounty_tokens} tokens
            </h3>
            <p className="text-xs text-slate-400 mt-1">
            Reported by {report.reported_by}
            {report.claimed_by && ` · Cleaned by ${report.claimed_by}`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-xl"
          >
            ✕
          </button>
        </div>

        <div className="p-6">
          {photoSrc ? (
            <img
              src={photoSrc}
              alt="report"
              className="rounded-lg w-full max-h-64 object-cover mb-4"
            />
          ) : (
            <div className="bg-slate-900 rounded-lg h-48 flex items-center justify-center text-slate-500 text-sm mb-4">
              (photo placeholder)
            </div>
          )}
            {report.description && (
            <div className="bg-slate-900/50 rounded-lg p-3 mb-4">
                <p className="text-xs text-slate-500 uppercase mb-1">AI analysis</p>
                <p className="text-sm text-slate-300">{report.description}</p>
                {report.waste_types?.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                    {report.waste_types.map((t) => (
                    <span
                        key={t}
                        className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded"
                    >
                        {t}
                    </span>
                    ))}
                </div>
                )}
                {report.estimated_volume_kg && (
                <p className="text-xs text-slate-500 mt-2">
                  Estimated waste: {formatKg(report.estimated_volume_kg)} kg
                </p>
                )}
            </div>
            )}
          <div className="flex items-center gap-2 mb-4">
            <button
              onClick={() => onLikeToggle(report.id)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm transition ${
                hasLiked
                  ? "bg-red-500/20 text-red-400"
                  : "bg-slate-700 hover:bg-slate-600 text-white"
              }`}
            >
              {hasLiked ? "❤️" : "🤍"} {report.likes.length}
            </button>
            <button
              onClick={handleShare}
              className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm text-white transition"
            >
              🔗 Share
            </button>
            {shareMessage && (
              <span className="text-xs text-emerald-400">{shareMessage}</span>
            )}
          </div>

          <div className="mb-4">
            <h4 className="text-sm font-semibold text-slate-300 mb-2">
              Comments ({report.comments.length})
            </h4>
            {report.comments.length === 0 ? (
              <p className="text-xs text-slate-500 mb-2">No comments yet.</p>
            ) : (
              <ul className="space-y-2 mb-2">
                {report.comments.map((c) => (
                  <li
                    key={c.id}
                    className="bg-slate-900/50 rounded-lg px-3 py-2 text-sm"
                  >
                    <p className="text-emerald-400 text-xs font-semibold">
                      {c.user}
                    </p>
                    <p className="text-slate-300">{c.text}</p>
                  </li>
                ))}
              </ul>
            )}
            <form onSubmit={handleAddComment} className="flex gap-2">
              <input
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Add a comment..."
                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
              />
              <button
                type="submit"
                disabled={!commentText.trim()}
                className="bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-semibold px-4 rounded-lg transition"
              >
                Post
              </button>
            </form>
          </div>

          {isReported && !isMine && (
            <button
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 rounded-lg transition"
              onClick={() => onClaim(report)}
            >
             Claim Cleanup ({report.bounty_tokens} tokens)
            </button>
          )}
          {isReported && isMine && (
            <p className="text-center text-xs text-slate-500">
              You reported this. Someone else needs to clean it.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}