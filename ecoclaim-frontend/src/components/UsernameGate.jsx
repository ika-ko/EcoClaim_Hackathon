import { useState } from "react";

export default function UsernameGate({ onSubmit }) {
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = username.trim();
    if (trimmed.length < 3) {
      setError("Username must be at least 3 characters");
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
      setError("Only letters, numbers, and underscores");
      return;
    }
    onSubmit(trimmed);
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
      <div className="bg-slate-800 rounded-2xl p-8 max-w-md w-full shadow-2xl border border-slate-700">
        <h1 className="text-3xl font-bold text-emerald-400 mb-2">EcoClaim</h1>
        <p className="text-slate-400 mb-6">
          Civic action for a cleaner Ruse. Pick a username to get started.
        </p>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
              setError("");
            }}
            placeholder="your_username"
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-emerald-500"
            autoFocus
          />
          {error && (
            <p className="text-red-400 text-sm mt-2">{error}</p>
          )}
          <button
            type="submit"
            className="w-full mt-4 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 rounded-lg transition"
          >
            Enter
          </button>
        </form>
      </div>
    </div>
  );
}