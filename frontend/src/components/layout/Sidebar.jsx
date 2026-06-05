import React, { useState } from "react";
import {
  LayoutDashboard,
  ScanSearch,
  ClockFading,
  BotMessageSquare,
  Settings2,
  Video,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  Circle,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import UserProfile from "../UserProfile";
import { useAuth } from "../../context/AuthContext";

const NAV_ITEMS = [
  {
    id: "grid",
    icon: LayoutDashboard,
    label: "Dashboard",
    badge: null,
  },
  {
    id: "analyser",
    icon: ScanSearch,
    label: "Analyser",
    badge: null,
  },
  {
    id: "history",
    icon: ClockFading,
    label: "History",
    badge: null,
  },
  {
    id: "chat",
    icon: BotMessageSquare,
    label: "AI Chat",
    badge: null,
  },
  {
    id: "cog",
    icon: Settings2,
    label: "Settings",
    badge: null,
  },
];

function NavItem({ item, isActive, onClick, collapsed }) {
  const { t } = useTranslation("sidebar");
  const Icon = item.icon;

  if (collapsed) {
    return (
      <div className="relative group/tooltip">
        <button
          onClick={() => onClick(item.id)}
          title={t(`nav.${item.id}`)}
          className={`
            w-full flex items-center justify-center p-2.5 rounded-xl
            transition-all duration-150
            ${
              isActive
                ? "bg-blue-600/15 text-blue-400 border border-blue-600/25 shadow-[inset_0_1px_0_rgba(99,179,237,0.08)]"
                : "text-slate-500 hover:bg-white/[0.04] hover:text-slate-200 border border-transparent"
            }
          `}
        >
          <Icon size={17} strokeWidth={isActive ? 2.25 : 1.75} />
        </button>

        <div className="
          pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 z-50
          opacity-0 group-hover/tooltip:opacity-100 translate-x-1 group-hover/tooltip:translate-x-0
          transition-all duration-150
        ">
          <div className="
            bg-slate-800 border border-slate-700 text-slate-200
            text-xs font-medium px-2.5 py-1.5 rounded-lg whitespace-nowrap
            shadow-xl shadow-black/40
          ">
            {t(`nav.${item.id}`)}
            <span className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-slate-700" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => onClick(item.id)}
      className={`
        group w-full flex items-center gap-3 px-3 py-2.5 rounded-xl
        text-sm font-medium transition-all duration-150 text-left
        ${
          isActive
            ? "bg-blue-600/15 text-blue-400 border border-blue-600/25 shadow-[inset_0_1px_0_rgba(99,179,237,0.08)]"
            : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200 border border-transparent"
        }
      `}
    >
      <span
        className={`flex-shrink-0 transition-colors ${
          isActive
            ? "text-blue-400"
            : "text-slate-500 group-hover:text-slate-300"
        }`}
      >
        <Icon size={16} strokeWidth={isActive ? 2.25 : 1.75} />
      </span>

      <span className="flex-1 min-w-0 truncate">
        {t(`nav.${item.id}`)}
      </span>

      {isActive && (
        <ChevronRight size={12} className="flex-shrink-0 text-blue-400/60" />
      )}

      {!isActive && item.badge && (
        <span
          className={`flex-shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded font-mono ${item.badgeStyle}`}
        >
          {item.badge}
        </span>
      )}
    </button>
  );
}

export default function Sidebar({ activeNav, onNavChange }) {
  const [collapsed, setCollapsed] = useState(false);
  const { t } = useTranslation("sidebar");
  const { logout } = useAuth();
  
  return (
    <aside
      style={{ transition: "width 220ms cubic-bezier(0.4,0,0.2,1)" }}
      className={`
        ${collapsed ? "w-[60px]" : "w-56"}
        shrink-0 flex flex-col h-screen bg-slate-900 border-r border-slate-800 overflow-hidden
      `}
    >
      {/* Header */}
      <div
        className={`
          py-4 border-b border-slate-800 flex-shrink-0 flex items-center
          ${collapsed ? "justify-center px-0" : "justify-between px-4"}
        `}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center flex-shrink-0 shadow-[0_0_14px_rgba(37,99,235,0.45)]">
            <img
                src="/icon.png"
                width={150}
                height={200}
                alt="icon"
                style={{ filter: "invert(1)" }}
              />
          </div>

          {!collapsed && (
            <div className="min-w-0 overflow-hidden">
              <p className="text-sm font-bold text-slate-100 leading-tight tracking-tight whitespace-nowrap">
                {t("appName")}
              </p>
              <p className="text-[10px] text-slate-500 font-mono tracking-widest whitespace-nowrap">
                {t("appTag")}
              </p>
            </div>
          )}
        </div>

        {!collapsed && (
          <button
            onClick={() => setCollapsed(true)}
            title={t("tooltip.collapse")}
            className="flex-shrink-0 p-1.5 rounded-lg text-slate-600 hover:text-slate-300 hover:bg-white/[0.05] transition-all"
          >
            <PanelLeftClose size={15} />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav
        className={`flex-1 py-4 space-y-0.5 overflow-y-auto min-h-0 ${
          collapsed ? "px-1.5" : "px-3"
        }`}
      >
        {!collapsed && (
          <p className="text-[10px] font-mono font-semibold text-slate-600 uppercase tracking-widest px-2 pb-2.5">
            {t("menu")}
          </p>
        )}

        {NAV_ITEMS.map((item) => (
          <NavItem
            key={item.id}
            item={item}
            isActive={activeNav === item.id}
            onClick={onNavChange}
            collapsed={collapsed}
          />
        ))}
      </nav>

      {/* Footer */}
      <div
        className={`border-t border-slate-800 flex-shrink-0 ${
          collapsed ? "px-1.5 py-3" : "px-4 py-3.5"
        }`}
      >
        {collapsed ? (
          <div className="flex flex-col items-center gap-2">
            <div className="relative">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 border border-slate-600 flex items-center justify-center text-[11px] font-bold text-slate-300 flex-shrink-0">
                AO
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 border border-slate-900 shadow-[0_0_5px_rgba(16,185,129,0.6)]" />
            </div>

            <button
              onClick={() => setCollapsed(false)}
              title={t("tooltip.expand")}
              className="p-1.5 rounded-lg text-slate-600 hover:text-slate-300 hover:bg-white/[0.05] transition-all"
            >
              <PanelLeftOpen size={15} />
            </button>
          </div>
        ) : (
          <UserProfile onLogout={logout} />
        )}
      </div>
    </aside>
  );
}