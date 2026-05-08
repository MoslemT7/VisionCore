import React, { useState, useEffect } from "react";
import { ChevronRight, Bell, LayoutDashboard, ScanSearch, ClockFading, BotMessageSquare, Settings2 } from "lucide-react";

const PAGE_META = {
  grid:     { title: "Dashboard",  sub: "Overview & analytics",          icon: LayoutDashboard },
  analyser: { title: "Analyser",   sub: "Upload · Process · Review",     icon: ScanSearch      },
  history:  { title: "History",    sub: "History of Analysis",           icon: ClockFading     },
  chat:     { title: "AI Chat",    sub: "Ask questions about footage",   icon: BotMessageSquare},
  cog:      { title: "Settings",   sub: "Preferences & configuration",   icon: Settings2       },
};

const LANGS = ["FR", "EN"];

function LiveClock() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const offsetTime = new Date(now.getTime() + 60 * 60 * 1000);
  const date = offsetTime.toISOString().slice(0, 10);
  const time = offsetTime.toISOString().slice(11, 19);

  return (
    <div className="flex flex-col items-end select-none">
      <span className="text-[11px] font-mono text-slate-300 tabular-nums tracking-wide">{time}</span>
      <span className="text-[9px] font-mono text-slate-600 tabular-nums tracking-wider">{date} · UTC+1</span>
    </div>
  );
}

function BackendStatus() {
  const [status, setStatus] = useState("checking");

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await fetch("http://localhost:8000/health");
        setStatus(res.ok ? "online" : "offline");
      } catch {
        setStatus("offline");
      }
    };
    checkHealth();
    const interval = setInterval(checkHealth, 10000);
    return () => clearInterval(interval);
  }, []);

  const config = {
    checking: { color: "text-amber-400",   bg: "bg-amber-500/10",   border: "border-amber-500/20",   dot: "bg-amber-500",   ping: "bg-amber-400",   label: "SYNCING"     },
    online:   { color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20", dot: "bg-emerald-500", ping: "bg-emerald-400", label: "LIVE"        },
    offline:  { color: "text-rose-400",    bg: "bg-rose-500/10",    border: "border-rose-500/20",    dot: "bg-rose-500",    ping: "bg-rose-400",    label: "API OFFLINE" },
  };

  const s = config[status];

  return (
    <div className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border ${s.border} ${s.bg} select-none transition-colors duration-500`}>
      <span className="relative flex h-1.5 w-1.5 shrink-0">
        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-60 ${s.ping}`} />
        <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${s.dot}`} />
      </span>
      <span className={`text-[10px] font-mono font-bold tracking-widest ${s.color}`}>{s.label}</span>
    </div>
  );
}

function LangSwitch({ lang, setLang }) {
  return (
    <div className="flex items-center gap-0.5 bg-slate-800/80 border border-slate-700/60 rounded-lg p-0.5">
      {LANGS.map((l) => (
        <button
          key={l}
          onClick={() => setLang(l)}
          className={`
            text-[10px] font-mono font-bold tracking-widest px-2 py-1 rounded-md transition-all duration-150
            ${lang === l
              ? "bg-blue-600 text-white shadow-[0_0_8px_rgba(37,99,235,0.4)]"
              : "text-slate-500 hover:text-slate-300"
            }
          `}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

function NotifButton() {
  const [open, setOpen] = useState(false);
  const hasNotif = true;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative p-2 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-white/[0.05] border border-transparent hover:border-slate-700/50 transition-all"
      >
        <Bell size={15} strokeWidth={1.75} />
        {hasNotif && (
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.7)]" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-64 bg-slate-900 border border-slate-700/60 rounded-xl shadow-2xl shadow-black/50 z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300">Notifications</span>
            <span className="text-[9px] font-mono text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">1 NEW</span>
          </div>
          <div className="px-4 py-3 flex items-start gap-3">
            <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0 shadow-[0_0_6px_rgba(59,130,246,0.7)]" />
            <div>
              <p className="text-xs text-slate-300 font-medium leading-tight">Analysis complete</p>
              <p className="text-[10px] text-slate-600 font-mono mt-0.5">footage_clip_03.mp4</p>
            </div>
          </div>
          <div className="px-4 py-2 border-t border-slate-800">
            <button className="text-[10px] font-mono text-slate-600 hover:text-slate-400 transition-colors">
              MARK ALL READ
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TopBar({ activeNav = "analyser" }) {
  const [lang, setLang] = useState("EN");
  const meta = PAGE_META[activeNav] ?? PAGE_META.analyser;
  const Icon = meta.icon;

  return (
    <header className="h-14 shrink-0 flex items-center justify-between px-5 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 relative z-10">

      {/* Left — breadcrumb + page title */}
      <div className="flex items-center gap-3 min-w-0">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[10px] font-mono text-slate-600 tracking-widest uppercase">Dronaeon</span>
          <ChevronRight size={10} className="text-slate-700" />
          <span className="text-[10px] font-mono text-slate-500 tracking-wide">{meta.title}</span>
        </div>

        {/* Divider */}
        <div className="h-4 w-px bg-slate-800 shrink-0" />

        {/* Page identity */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-blue-600/10 border border-blue-600/20 flex items-center justify-center shrink-0">
            <Icon size={14} strokeWidth={2} className="text-blue-400" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-bold text-slate-100 leading-tight tracking-tight truncate">{meta.title}</h1>
            <p className="text-[10px] font-mono text-slate-500 leading-tight truncate">{meta.sub}</p>
          </div>
        </div>
      </div>

      {/* Right — controls */}
      <div className="flex items-center gap-2 shrink-0 ml-4">
        <BackendStatus />

        <div className="h-5 w-px bg-slate-800" />

        <LiveClock />

        <div className="h-5 w-px bg-slate-800" />

        {/* Language switch — ready for i18n hookup */}
        <LangSwitch lang={lang} setLang={setLang} />

        <div className="h-5 w-px bg-slate-800" />

        {/* Notifications */}
        <NotifButton />
      </div>
    </header>
  );
}