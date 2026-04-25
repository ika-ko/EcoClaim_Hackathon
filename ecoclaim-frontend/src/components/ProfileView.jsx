import { formatKg } from "../lib/api";
export default function ProfileView({ username, users, reports }) {
  const me = users.find((u) => u.username === username) || {
    username,
    tokens: 0,
    reports_made: 0,
    cleanups_completed: 0,
  };

  const myReports = reports.filter((r) => r.reported_by === username);
  const myCleanups = reports.filter((r) => r.claimed_by === username);

  return (
    <div className="h-full overflow-auto p-8">
      <div className="max-w-3xl mx-auto">
        <h2 className="text-3xl font-bold text-white mb-6">Profile</h2>

        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 mb-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center text-2xl">
              👤
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">{me.username}</h3>
              <p className="text-slate-400 text-sm">EcoClaim member</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4 mb-6">
          <StatCard label="Tokens" value={me.tokens} accent="emerald" />
          <StatCard label="Reports" value={me.reports_made} accent="red" />
          <StatCard label="Cleanups" value={me.cleanups_completed} accent="emerald" />
          <StatCard label="Kg removed" value={formatKg(me.kg_cleaned || 0)} accent="emerald" />
        </div>

        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">
            Recent activity
          </h3>
          {myReports.length === 0 && myCleanups.length === 0 ? (
            <p className="text-slate-400 text-sm">
              No activity yet. Tap the + button on the map to report a dump.
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              {myReports.slice(0, 3).map((r) => (
                <li key={r.id} className="text-slate-300">
                  🚨 Reported a dump (hazard {r.hazard_score}/10)
                </li>
              ))}
              {myCleanups.slice(0, 3).map((r) => (
                <li key={r.id} className="text-slate-300">
                  ✅ Cleaned a site (+{r.bounty_value} tokens)
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, accent }) {
  const colors = {
    emerald: "text-emerald-400",
    red: "text-red-400",
  };
  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 text-center">
      <p className={`text-3xl font-bold ${colors[accent]}`}>{value}</p>
      <p className="text-xs uppercase text-slate-500 mt-1">{label}</p>
    </div>
  );
}