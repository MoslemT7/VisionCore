import {
  Film, Eye, Users, Layers, Clock, Zap, Cpu,
  TrendingUp, RefreshCw, AlertCircle, CheckCircle,
  XCircle, BarChart2, Activity, Calendar,
} from "lucide-react";
import { useDashboard } from "../hooks/useDashboard.js";

function fmt(n, decimals = 0) {
  if (n == null) return "—";
  return Number(n).toLocaleString(undefined, { maximumFractionDigits: decimals });
}

function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium" });
}

function fmtTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
}

function StatusIcon({ status }) {
  if (status === "completed") return <CheckCircle size={11} className="text-emerald-400" />;
  if (status === "failed")    return <XCircle     size={11} className="text-red-400" />;
  return <Activity size={11} className="text-amber-400 animate-pulse" />;
}

function StatCard({ icon: Icon, label, value, sub, accent = "text-blue-400" }) {
  return (
    <div className="bg-slate-800/50 border border-slate-700/40 rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <Icon size={14} className={accent} />
        <div className="w-2 h-2 rounded-full bg-slate-700" />
      </div>
      <div>
        {value != null
          ? <p className={`text-xl font-bold tabular-nums ${accent} mb-0.5`}>{value}</p>
          : <div className="w-16 h-6 rounded bg-slate-700/60 mb-1.5 animate-pulse" />
        }
        <p className="text-[11px] text-slate-500">{label}</p>
        {sub && <p className="text-[10px] text-slate-600 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function SectionTitle({ icon: Icon, children }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon size={13} className="text-slate-500" />
      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600">{children}</p>
    </div>
  );
}

function Card({ children, className = "" }) {
  return (
    <div className={`bg-slate-800/30 border border-slate-700/40 rounded-xl ${className}`}>
      {children}
    </div>
  );
}

function MiniBar({ value, max, accent = "bg-blue-500" }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
      <div className={`h-full ${accent} rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function ActivityChart({ timeline }) {
  if (!timeline.length) return (
    <div className="h-24 flex items-center justify-center">
      <p className="text-[11px] text-slate-600">No activity data yet</p>
    </div>
  );

  const maxJobs = Math.max(...timeline.map((d) => d.jobs), 1);

  return (
    <div className="flex items-end gap-1 h-20">
      {timeline.map((day) => {
        const h = Math.max(4, Math.round((day.jobs / maxJobs) * 80));
        return (
          <div key={day.date} className="flex-1 flex flex-col items-center gap-1 group relative">
            <div
              className="w-full bg-blue-500/60 hover:bg-blue-400 rounded-sm transition-colors cursor-default"
              style={{ height: `${h}px` }}
            />
            <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:flex
              bg-slate-900 border border-slate-700 rounded px-2 py-1 text-[10px] text-slate-300
              whitespace-nowrap z-10 flex-col items-center gap-0.5 pointer-events-none">
              <span>{day.date}</span>
              <span>{day.jobs} job{day.jobs !== 1 ? "s" : ""}</span>
              <span>{fmt(day.detections)} detections</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function Dashboard() {
  const {
    aggregate, recentJobs, leaderboard,
    timeline, perfStats, loading, error, lastRefresh, refresh,
  } = useDashboard();

  const successRate = aggregate?.total_jobs > 0
    ? Math.round((recentJobs.filter((j) => j.status === "completed").length / recentJobs.length) * 100)
    : null;

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white">Dashboard</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {lastRefresh
              ? `Last updated ${lastRefresh.toLocaleTimeString()}`
              : "Loading…"
            }
          </p>
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg
            border border-slate-700/50 text-slate-400 hover:text-slate-200
            hover:border-slate-600 transition-colors disabled:opacity-40"
        >
          <RefreshCw size={11} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20">
          <AlertCircle size={13} className="text-red-400 shrink-0" />
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      <div>
        <SectionTitle icon={BarChart2}>Fleet Overview</SectionTitle>
        <div className="grid grid-cols-4 gap-3">
          <StatCard
            icon={Film}
            label="Total Jobs"
            accent="text-blue-400"
            value={aggregate ? fmt(aggregate.total_jobs) : null}
            sub={aggregate?.first_analysed ? `Since ${fmtDate(aggregate.first_analysed)}` : null}
          />
          <StatCard
            icon={Eye}
            label="Total Detections"
            accent="text-cyan-400"
            value={aggregate ? fmt(aggregate.total_detections) : null}
          />
          <StatCard
            icon={Users}
            label="Total Unique Objects"
            accent="text-emerald-400"
            value={aggregate ? fmt(aggregate.total_unique) : null}
          />
          <StatCard
            icon={Film}
            label="Total Frames"
            accent="text-indigo-400"
            value={aggregate ? fmt(aggregate.total_frames) : null}
          />
        </div>
      </div>

      <div>
        <SectionTitle icon={Cpu}>Performance</SectionTitle>
        <div className="grid grid-cols-4 gap-3">
          <StatCard
            icon={Clock}
            label="Avg Processing Time"
            accent="text-purple-400"
            value={perfStats ? `${perfStats.avg_elapsed}s` : null}
            sub={perfStats ? `${perfStats.min_elapsed}s – ${perfStats.max_elapsed}s range` : null}
          />
          <StatCard
            icon={Zap}
            label="Avg Throughput"
            accent="text-yellow-400"
            value={perfStats ? `${perfStats.avg_throughput} fps` : null}
          />
          <StatCard
            icon={Cpu}
            label="Avg Inference"
            accent="text-amber-400"
            value={perfStats ? `${perfStats.avg_inference_ms}ms` : null}
          />
          <StatCard
            icon={TrendingUp}
            label="Avg Elapsed (fleet)"
            accent="text-slate-400"
            value={aggregate ? `${fmt(aggregate.avg_elapsed, 1)}s` : null}
            sub={aggregate ? `Max ${fmt(aggregate.max_elapsed, 1)}s` : null}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">

        <div className="col-span-2 space-y-6">

          <Card className="p-4">
            <SectionTitle icon={Calendar}>Activity (last 30 days)</SectionTitle>
            {loading
              ? <div className="h-20 rounded bg-slate-800/60 animate-pulse" />
              : <ActivityChart timeline={timeline} />
            }
            <div className="flex justify-between mt-2">
              {timeline.slice(-1)[0] && (
                <p className="text-[10px] text-slate-600">{timeline[0]?.date}</p>
              )}
              {timeline.slice(-1)[0] && (
                <p className="text-[10px] text-slate-600">{timeline.slice(-1)[0]?.date}</p>
              )}
            </div>
          </Card>

          <Card className="p-4">
            <SectionTitle icon={Film}>Recent Jobs</SectionTitle>
            {loading ? (
              <div className="space-y-2">
                {[1,2,3].map((n) => (
                  <div key={n} className="h-10 rounded bg-slate-800/60 animate-pulse" />
                ))}
              </div>
            ) : recentJobs.length === 0 ? (
              <p className="text-[11px] text-slate-600 text-center py-6">No jobs yet. Analyse a video to get started.</p>
            ) : (
              <div className="space-y-1">
                {recentJobs.map((job) => (
                  <div
                    key={job.job_id}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-700/30
                      cursor-pointer transition-colors group"
                  >
                    <StatusIcon status={job.status} />

                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-300 font-medium truncate group-hover:text-white transition-colors">
                        {job.filename ?? job.job_id}
                      </p>
                      <p className="text-[10px] text-slate-600">{fmtTime(job.analysed_at)}</p>
                    </div>

                    <div className="hidden md:flex items-center gap-4 text-[10px] font-mono text-slate-600 shrink-0">
                      <span className="flex items-center gap-1">
                        <Eye size={9} className="text-cyan-500" />
                        {fmt(job.total_detections)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users size={9} className="text-emerald-500" />
                        {fmt(job.total_unique)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock size={9} className="text-purple-500" />
                        {job.elapsed_time != null ? `${job.elapsed_time}s` : "—"}
                      </span>
                    </div>

                    <span className={`text-[10px] px-1.5 py-0.5 rounded border font-mono shrink-0
                      ${job.status === "completed"
                        ? "text-emerald-400 bg-emerald-400/10 border-emerald-400/20"
                        : job.status === "failed"
                          ? "text-red-400 bg-red-400/10 border-red-400/20"
                          : "text-amber-400 bg-amber-400/10 border-amber-400/20"
                      }`}>
                      {job.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>

        </div>

        <div className="space-y-6">

          <Card className="p-4">
            <SectionTitle icon={Activity}>Quick Stats</SectionTitle>
            <div className="space-y-3 text-[11px]">
              {[
                {
                  label: "Success rate",
                  value: recentJobs.length
                    ? `${Math.round((recentJobs.filter((j) => j.status === "completed").length / recentJobs.length) * 100)}%`
                    : "—",
                  accent: "text-emerald-400",
                },
                {
                  label: "Failed jobs",
                  value: fmt(recentJobs.filter((j) => j.status === "failed").length),
                  accent: "text-red-400",
                },
                {
                  label: "Avg detections/job",
                  value: aggregate?.total_jobs
                    ? fmt(Math.round(aggregate.total_detections / aggregate.total_jobs))
                    : "—",
                  accent: "text-cyan-400",
                },
                {
                  label: "Avg unique/job",
                  value: aggregate?.total_jobs
                    ? fmt(Math.round(aggregate.total_unique / aggregate.total_jobs))
                    : "—",
                  accent: "text-emerald-400",
                },
                {
                  label: "Last analysis",
                  value: aggregate?.last_analysed ? fmtDate(aggregate.last_analysed) : "—",
                  accent: "text-slate-400",
                },
                {
                  label: "First analysis",
                  value: aggregate?.first_analysed ? fmtDate(aggregate.first_analysed) : "—",
                  accent: "text-slate-400",
                },
              ].map(({ label, value, accent }) => (
                <div key={label} className="flex items-center justify-between py-1.5 border-b border-slate-800 last:border-0">
                  <span className="text-slate-500">{label}</span>
                  <span className={`font-mono font-medium ${accent}`}>{value}</span>
                </div>
              ))}
            </div>
          </Card>

        </div>
      </div>

    </div>
  );
}