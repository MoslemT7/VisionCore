import React, { useState } from "react";
import {
  LayoutGrid,
  Upload,
  FileText,
  MessageSquare,
  Server,
  Settings,
  Eye,
  ChevronRight,
  Cpu,
} from "lucide-react";

const NAV_ITEMS = [
  {
    id:    "grid",
    icon:  LayoutGrid,
    label: "Dashboard",
    badge: null,
  },
  {
    id:       "analyser",
    icon:     Eye,
    label:    "Analyser",
    badgeStyle: "bg-blue-600 text-white",
  },
  {
    id:    "history",
    icon:  FileText,
    label: "History",
    badge: null,
  },
  {
    id:    "chat",
    icon:  MessageSquare,
    label: "AI Chat",
    badge: null,
  },
  {
    id:    "cog",
    icon:  Settings,
    label: "Settings",
    badge: null,
  },
];

const METRICS = [
  { label: "GPU",  pct: 82, color: "bg-emerald-500" },
  { label: "CPU",  pct: 47, color: "bg-blue-500"    },
  { label: "VRAM", pct: 76, color: "bg-amber-500"   },
];

function NavItem({ item, isActive, onClick }) {
  const Icon = item.icon;
  return (
    <button
      onClick={() => onClick(item.id)}
      className={`
        group w-full flex items-center gap-3 px-3 py-2.5 rounded-xl
        text-sm font-medium transition-all duration-150 text-left
        ${isActive
          ? "bg-blue-600/15 text-blue-400 border border-blue-600/25 shadow-[inset_0_1px_0_rgba(99,179,237,0.08)]"
          : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200 border border-transparent"
        }
      `}
    >
      {/* Icon */}
      <span className={`flex-shrink-0 transition-colors ${isActive ? "text-blue-400" : "text-slate-500 group-hover:text-slate-300"}`}>
        <Icon size={15} strokeWidth={isActive ? 2 : 1.75} />
      </span>

      {/* Label */}
      <span className="flex-1 min-w-0 truncate">{item.label}</span>

      {/* Active indicator arrow */}
      {isActive && (
        <ChevronRight size={12} className="flex-shrink-0 text-blue-400/60" />
      )}

      {/* Badge */}
      {!isActive && item.badge && (
        <span className={`flex-shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded font-mono ${item.badgeStyle}`}>
          {item.badge}
        </span>
      )}
    </button>
  );
}

export default function Sidebar({ activeNav, onNavChange }) {
  return (
    <aside className="w-56 shrink-0 flex flex-col h-screen bg-slate-900 border-r border-slate-800">

      <div className="px-5 py-5 border-b border-slate-800 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0 shadow-[0_0_12px_rgba(37,99,235,0.5)]">
            <svg viewBox="0 0 24 24" fill="white" className="w-4 h-4">
              <path d="M15 10l4.553-2.069A1 1 0 0 1 21 8.87V15.13a1 1 0 0 1-1.447.899L15 14M3 8h12a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2z" />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-100 leading-tight tracking-tight">VisionCore</p>
            <p className="text-[10px] text-slate-500 font-mono tracking-widest">AI ANALYSIS</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto min-h-0">
        <p className="text-[10px] font-mono font-semibold text-slate-600 uppercase tracking-widest px-2 pb-2.5">
          Menu
        </p>

        {NAV_ITEMS.map((item) => (
          <NavItem
            key={item.id}
            item={item}
            isActive={activeNav === item.id}
            onClick={onNavChange}
          />
        ))}
      </nav>

      <div className="px-4 py-3.5 border-t border-slate-800 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 border border-slate-600 flex items-center justify-center text-[11px] font-bold text-slate-300 flex-shrink-0">
            AO
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-slate-300 truncate leading-tight">
              Analyst Operator
            </p>
            <p className="text-[10px] text-slate-500 font-mono">ROLE: ADMIN</p>
          </div>
          <div
            className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0 shadow-[0_0_6px_rgba(16,185,129,0.6)]"
            title="Online"
          />
        </div>
      </div>
    </aside>
  );
}