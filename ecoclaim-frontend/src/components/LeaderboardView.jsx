import { formatKg } from "../lib/api";
export default function LeaderboardView({ users, currentUsername }) {
  const sorted = [...users].sort((a, b) => b.tokens - a.tokens);

  return (
    <div className="h-full overflow-auto p-8">
      <div className="max-w-3xl mx-auto">
        <h2 className="text-3xl font-bold text-white mb-2">Leaderboard</h2>
        <p className="text-slate-400 mb-6">Top contributors in Ruse</p>

        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-900/50">
  <tr className="text-left text-xs uppercase text-slate-400">
    <th className="px-6 py-3">Rank</th>
    <th className="px-6 py-3">User</th>
    <th className="px-6 py-3 text-right">Tokens</th>
    <th className="px-6 py-3 text-right">Cleanups</th>
    <th className="px-6 py-3 text-right">Kg removed</th>
  </tr>
</thead>
            <tbody>
              {sorted.map((user, i) => {
                const isMe = user.username === currentUsername;
                const medals = ["🥇", "🥈", "🥉"];
                return (
                  <tr
                    key={user.username}
                    className={`border-t border-slate-700 ${
                      isMe ? "bg-emerald-500/10" : "hover:bg-slate-700/30"
                    }`}
                  >
                    <td className="px-6 py-4 text-slate-300">
                      {medals[i] || `#${i + 1}`}
                    </td>
                    <td className="px-6 py-4 text-white font-medium">
                      {user.username}
                      {isMe && (
                        <span className="ml-2 text-xs text-emerald-400">(you)</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right text-emerald-400 font-semibold">
                      {user.tokens}
                    </td>
                    <td className="px-6 py-4 text-right text-slate-400">
                      {user.cleanups_completed}
                    </td>
                    <td className="px-6 py-4 text-right text-slate-400">
                      {formatKg(user.kg_cleaned || 0)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}