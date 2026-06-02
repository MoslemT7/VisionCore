import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  ChevronRight,
  Bell,
  LayoutDashboard,
  ScanSearch,
  ClockFading,
  BotMessageSquare,
  Settings2
} from "lucide-react";

const PAGE_META = {
  grid: "grid",
  analyser: "analyser",
  history: "history",
  chat: "chat",
  cog: "cog"
};

function LangSwitch({ lang, setLang }) {
  const LANGS = ["FR", "EN"];

  return (
    <div className="flex items-center gap-0.5 bg-slate-800/80 border border-slate-700/60 rounded-lg p-0.5">
      {LANGS.map((l) => (
        <button
          key={l}
          onClick={() => setLang(l)}
          className={`
            text-[10px] font-mono font-bold tracking-widest px-2 py-1 rounded-md transition-all
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

function BackendStatus() {
  const { t } = useTranslation("topbar");
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
    checking: "syncing",
    online: "live",
    offline: "offline"
  };

  const labelKey = config[status];

  return (
    <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-slate-700/60 bg-slate-800/40">
      <span className="text-[10px] font-mono font-bold tracking-widest text-slate-300">
        {t(`status.${labelKey}`)}
      </span>
    </div>
  );
}

function NotifButton() {
  const { t } = useTranslation("common");
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="p-2 rounded-lg text-slate-500 hover:text-slate-200"
      >
        <Bell size={15} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-64 bg-slate-900 border border-slate-700/60 rounded-xl">
          <div className="px-4 py-3 border-b border-slate-800">
            <span className="text-xs text-slate-300">
              {t("notifications.title")}
            </span>
            <span className="text-[9px] text-blue-400 ml-2">
              {t("notifications.new")}
            </span>
          </div>

          <div className="px-4 py-3">
            <p className="text-xs text-slate-300">
              {t("notifications.analysisComplete")}
            </p>
          </div>

          <div className="px-4 py-2 border-t border-slate-800">
            <button className="text-[10px] text-slate-400">
              {t("notifications.markAllRead")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TopBar({ activeNav = "analyser" }) {
  const { t, i18n } = useTranslation("topbar");

  const lang = i18n.language.toUpperCase();

  const metaKey = PAGE_META[activeNav] || "analyser";

  const meta = {
    title: t(`pages.${metaKey}.title`),
    sub: t(`pages.${metaKey}.sub`)
  };

  const IconMap = {
    grid: LayoutDashboard,
    analyser: ScanSearch,
    history: ClockFading,
    chat: BotMessageSquare,
    cog: Settings2
  };

  const Icon = IconMap[metaKey];

  return (
    <header className="h-14 flex items-center justify-between px-5 bg-slate-900/90 border-b border-slate-800">

      {/* LEFT */}
      <div className="flex items-center gap-3">
        <span className="text-[10px] font-mono text-slate-600">
          {t("appName")}
        </span>

        <ChevronRight size={10} className="text-slate-700" />

        <div className="flex items-center gap-2">
          <Icon size={14} className="text-blue-400" />
          <div>
            <h1 className="text-sm font-bold text-white">{meta.title}</h1>
            <p className="text-[10px] text-slate-500">{meta.sub}</p>
          </div>
        </div>
      </div>

      {/* RIGHT */}
      <div className="flex items-center gap-3">
        <BackendStatus />

        <div className="h-5 w-px bg-slate-800" />

        <LangSwitch
          lang={lang}
          setLang={(lng) => i18n.changeLanguage(lng.toLowerCase())}
        />

        <div className="h-5 w-px bg-slate-800" />

        <NotifButton />
      </div>
    </header>
  );
}