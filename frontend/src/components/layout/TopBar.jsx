import React, { useState, useEffect } from "react";
import { Bell, Radio, ChevronRight, Zap, Activity } from "lucide-react";

const PAGE_META = {
  grid:     { title: "Dashboard",   sub: "Overview & analytics"             },
  analyser: { title: "Analyser",    sub: "Upload · Process · Review"        },
  file:     { title: "History",     sub: "History of Analysis"              },
  chat:     { title: "AI Chat",     sub: "Ask questions about footage"      },
  cog:      { title: "Settings",    sub: "Preferences & configuration"      },
};

function LiveClock() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const offsetTime = new Date(now.getTime() + (60 * 60 * 1000));

  const date = offsetTime.toISOString().slice(0, 10);
  const time = offsetTime.toISOString().slice(11, 19);

  return (
    <div className="text-[11px] font-mono text-slate-500 tabular-nums select-none">
      <span className="text-slate-600">{date}</span>
      <span className="text-slate-700 mx-1">·</span>
      <span className="text-slate-400">{time}</span>
      <span className="text-slate-600 ml-1">UTC+1</span>
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
    const interval = setInterval(checkHealth, 10000); // Poll every 10s
    return () => clearInterval(interval);
  }, []);

  const config = {
    checking: { color: "text-amber-400", bg: "bg-amber-500/10", dot: "bg-amber-500", label: "SYNCING", ping: "bg-amber-400" },
    online:   { color: "text-emerald-400", bg: "bg-emerald-500/10", dot: "bg-emerald-500", label: "SYSTEM LIVE", ping: "bg-emerald-400" },
    offline:  { color: "text-rose-400", bg: "bg-rose-500/10", dot: "bg-rose-500", label: "API OFFLINE", ping: "bg-rose-400" },
  };

  const s = config[status];

  return (
    <div className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-white/5 ${s.bg} select-none transition-colors duration-500`}>
      <span className="relative flex h-1.5 w-1.5 shrink-0">
        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-60 ${s.ping}`} />
        <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${s.dot}`} />
      </span>
      <span className={`text-[10px] font-mono font-bold tracking-wider ${s.color}`}>
        {s.label}
      </span>
    </div>
  );
}

export default function TopBar({ activeNav = "analyser" }) {
  const [notifOpen, setNotifOpen] = useState(false);
  const [hasNotif] = useState(true);
  const meta = PAGE_META[activeNav] ?? PAGE_META.analyser;

  return (
    <header className="h-14 shrink-0 flex items-center justify-between px-5 bg-slate-900/80 backdrop-blur border-b border-slate-800 relative z-10">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-[11px] font-mono text-slate-600 shrink-0">VisionCore</span>
        <ChevronRight size={11} className="text-slate-700 shrink-0" />
        <div className="min-w-0">
          <h1 className="text-sm font-semibold text-slate-100 truncate leading-tight">{meta.title}</h1>
          <p className="text-[10px] font-mono text-slate-500 leading-tight mt-0.5 truncate">{meta.sub}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0 ml-4">
        <BackendStatus />
        <div className="h-5 w-px bg-slate-800 mx-1" />
        <LiveClock />
        <div className="h-5 w-px bg-slate-800 mx-1" />
      </div>
    </header>
  );
}