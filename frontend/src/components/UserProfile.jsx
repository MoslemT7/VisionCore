import { useState, useRef, useEffect } from "react";
import { useAuth } from "../hooks/useAuth";

export default function UserProfile({ onLogout }) {
  const { logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const token = localStorage.getItem("token");
  let username = "User";
  try {
    username = JSON.parse(atob(token.split(".")[1])).sub;
  } catch {}
  const initials = username.slice(0, 2).toUpperCase();

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(o => !o)} className="flex items-center gap-2.5 group">
        <div className="relative flex-shrink-0">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 border border-slate-600 flex items-center justify-center text-[11px] font-bold text-slate-300">
            {initials}
          </div>
          <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 border border-slate-900 shadow-[0_0_5px_rgba(16,185,129,0.6)]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-slate-300 truncate leading-tight">{username}</p>
          <p className="text-[10px] text-slate-500 font-mono">Operator</p>
        </div>
      </button>

      {open && (
        <div className="absolute bottom-full left-0 mb-2 w-44 bg-slate-900/95 backdrop-blur border border-cyan-500/20 rounded-xl shadow-[0_0_20px_rgba(0,200,255,0.05)] overflow-hidden z-50">
          <div className="absolute top-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent" />
          <div className="px-3 py-2.5 border-b border-slate-800">
            <p className="text-xs font-mono text-cyan-400/70 tracking-widest uppercase">Signed in as</p>
            <p className="text-xs font-semibold text-slate-200 truncate mt-0.5">{username}</p>
          </div>
          <button
            onClick={() => { setOpen(false); onLogout(); }}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-red-500/10 group transition-colors"
          >
            <svg className="w-3.5 h-3.5 text-red-400/70 group-hover:text-red-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span className="text-xs font-mono text-red-400/70 group-hover:text-red-400 tracking-wider transition-colors">SIGN OUT</span>
          </button>
        </div>
      )}
    </div>
  );
}