export const STATUS_CONFIG = {
  completed: { label: "Completed", dot: "bg-emerald-400", badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  running:   { label: "Running",   dot: "bg-blue-400 animate-pulse", badge: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  failed:    { label: "Failed",    dot: "bg-red-400",    badge: "bg-red-500/10 text-red-400 border-red-500/20" },
  pending:   { label: "Pending",   dot: "bg-slate-400",  badge: "bg-slate-500/10 text-slate-400 border-slate-500/20" },
};

export function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    + " · " + d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export function formatDuration(sec) {
  if (!sec && sec !== 0) return "—";
  const m = Math.floor(sec / 60);
  const s = String(Math.floor(sec % 60)).padStart(2, "0");
  return `${m}:${s}`;
}

export function getFileExt(filename) {
  return (filename ?? "").split(".").pop()?.toUpperCase() ?? "";
}