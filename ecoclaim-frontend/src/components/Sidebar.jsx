export default function Sidebar({ currentView, onNavigate, username, onLogout }) {
  const navItems = [
    { id: "map", label: "Map", icon: "🗺️" },
    { id: "leaderboard", label: "Leaderboard", icon: "🏆" },
    { id: "profile", label: "Profile", icon: "👤" },
  ];

  return (
    <aside className="w-60 bg-slate-800 border-r border-slate-700 flex flex-col">
      <div className="p-6 border-b border-slate-700">
        <h1 className="text-2xl font-bold text-emerald-400">EcoClaim</h1>
        <p className="text-xs text-slate-400 mt-1">Ruse, Bulgaria</p>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition ${
              currentView === item.id
                ? "bg-emerald-500/20 text-emerald-400"
                : "text-slate-300 hover:bg-slate-700/50"
            }`}
          >
            <span className="text-xl">{item.icon}</span>
            <span className="font-medium">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-700">
        <div className="flex items-center justify-between bg-slate-900/50 rounded-lg px-3 py-2">
          <div className="min-w-0">
            <p className="text-xs text-slate-500">Logged in as</p>
            <p className="text-sm text-white truncate">{username}</p>
          </div>
          <button
            onClick={onLogout}
            className="text-xs text-slate-500 hover:text-red-400 transition"
            title="Log out"
          >
            ✕
          </button>
        </div>
      </div>
    </aside>
  );
}