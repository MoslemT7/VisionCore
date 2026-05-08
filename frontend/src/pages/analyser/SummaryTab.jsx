import { useState, useMemo } from "react";
import { captionApi } from "../../api/captionApi.js";
import {
  Film, Eye, Users, Clock, Cpu, Zap, Bot,
  Activity, Target, TrendingUp, BarChart2, Gauge,
  Sparkles, ChevronDown, ChevronUp, AlertTriangle,
  Clock3, Microscope,
} from "lucide-react";

function StatBox({ icon: Icon, label, value, sub, accent = "text-blue-400" }) {
  return (
    <div className="bg-slate-800/50 border border-slate-700/40 rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <Icon size={14} className={accent} />
        <div className="w-2 h-2 rounded-full bg-slate-700" />
      </div>
      <div>
        {value != null ? (
          <p className={`text-lg font-bold tabular-nums ${accent} mb-0.5`}>{value}</p>
        ) : (
          <div className="w-12 h-5 rounded bg-slate-700/60 mb-1.5 animate-pulse" />
        )}
        <p className="text-[11px] text-slate-500 leading-tight">{label}</p>
        {sub && value != null && (
          <p className="text-[10px] text-slate-600 mt-0.5">{sub}</p>
        )}
      </div>
    </div>
  );
}

function SectionHeader({ children }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600 px-0.5">
      {children}
    </p>
  );
}

function ConfPill({ conf }) {
  if (conf == null) return null;
  const pct = Math.round(conf * 100);
  const cls =
    pct >= 80 ? "text-emerald-400 bg-emerald-400/10 border-emerald-400/20" :
    pct >= 60 ? "text-amber-400  bg-amber-400/10  border-amber-400/20"  :
                "text-red-400    bg-red-400/10    border-red-400/20";
  return (
    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${cls}`}>
      {pct}%
    </span>
  );
}

function SceneCaptions({ scenes }) {
  if (!scenes?.length) return null;
  return (
    <div className="space-y-2">
      {scenes.map((s, i) => (
        <div key={i} className="flex gap-3 items-start">
          <div className="shrink-0 mt-0.5">
            <span className="text-[9px] font-mono font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 rounded">
              S{i + 1}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-slate-400 leading-relaxed">{s.caption}</p>
            <p className="text-[10px] text-slate-700 font-mono mt-0.5">
              {s.start_s}s → {s.end_s}s
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

const SECTION_META = {
  "Activity Pattern":   { icon: Activity,      accent: "text-blue-400",    bg: "bg-blue-500/8   border-blue-500/15"   },
  "Person Behaviour":   { icon: Users,          accent: "text-emerald-400", bg: "bg-emerald-500/8 border-emerald-500/15" },
  "Density & Crowding": { icon: BarChart2,      accent: "text-amber-400",   bg: "bg-amber-500/8   border-amber-500/15"  },
  "Temporal Insights":  { icon: Clock3,         accent: "text-purple-400",  bg: "bg-purple-500/8  border-purple-500/15" },
  "Analyst Notes":      { icon: AlertTriangle,  accent: "text-rose-400",    bg: "bg-rose-500/8    border-rose-500/15"   },
};

function AnalysisSection({ title, content }) {
  const meta = SECTION_META[title] ?? { icon: Microscope, accent: "text-slate-400", bg: "bg-slate-800/50 border-slate-700/40" };
  const Icon = meta.icon;
  return (
    <div className={`rounded-xl border p-4 ${meta.bg}`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon size={13} className={meta.accent} />
        <p className={`text-[11px] font-bold tracking-wide uppercase ${meta.accent}`}>{title}</p>
      </div>
      <p className="text-sm text-slate-300 leading-relaxed">{content}</p>
    </div>
  );
}

export default function SummaryTab({ Card, PlaceholderBox, result, jobId }) {
  const hasResult = !!result;

  const totalFrames     = result?.total_frames         ?? null;
  const totalDetections = result?.total_detections     ?? null;
  const elapsedTime     = result?.elapsed_time != null ? `${result.elapsed_time}s` : null;

  const personStats = useMemo(() => {
    const classes = result?.class_stats ?? result?.top_classes ?? [];
    return classes.find(c => c.class?.toLowerCase() === "person") ?? null;
  }, [result]);

  const uniquePersons = personStats?.unique_tracks ?? result?.total_unique_objects ?? null;
  const avgConf       = personStats?.avg_conf != null ? `${Math.round(personStats.avg_conf * 100)}%` : null;

  const videoMeta   = result?.video_meta ?? {};
  const performance = result?.performance ?? {};
  const detectionSummary = result?.detection_summary ?? {};

  const resolution   = videoMeta.width && videoMeta.height ? `${videoMeta.width}×${videoMeta.height}` : null;
  const sourceFps    = videoMeta.source_fps    != null ? `${videoMeta.source_fps} fps`    : null;
  const duration     = videoMeta.duration_s    != null ? `${videoMeta.duration_s}s`       : null;
  const processedFps = videoMeta.processed_fps != null ? `${videoMeta.processed_fps} fps` : null;
  const frameStep    = videoMeta.frame_step    != null ? `every ${videoMeta.frame_step} frames` : null;
  const throughput   = performance.throughput_fps   != null ? `${performance.throughput_fps} fps` : null;
  const avgInference = performance.avg_inference_ms != null ? `${performance.avg_inference_ms}ms` : null;
  const minInference = performance.min_inference_ms != null ? `${performance.min_inference_ms}ms` : null;
  const maxInference = performance.max_inference_ms != null ? `${performance.max_inference_ms}ms` : null;
  const inferenceRange = minInference && maxInference ? `${minInference} – ${maxInference}` : null;

  const avgDensity  = detectionSummary.avg_detections_per_frame != null
    ? detectionSummary.avg_detections_per_frame.toFixed(1) : null;
  const peakDensity = detectionSummary.max_detections_in_frame != null
    ? String(detectionSummary.max_detections_in_frame) : null;

  const summary    = result?.summary ?? null;
  const sceneCaps  = result?.captions?.scene_captions ?? null;
  const deepAnalysis = result?.deep_analysis ?? null;

  return (
    <div className="space-y-5">
      <SectionHeader>Person Detection Overview</SectionHeader>

      <div className="grid grid-cols-4 gap-3">
        <StatBox icon={Film}   label="Frames Processed"    accent="text-blue-400"    value={totalFrames} />
        <StatBox icon={Eye}    label="Total Detections"    accent="text-cyan-400"    value={totalDetections} />
        <StatBox icon={Users}  label="Unique Persons"      accent="text-emerald-400" value={uniquePersons} />
        <StatBox icon={Target} label="Avg Confidence"      accent="text-amber-400"   value={avgConf} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <StatBox icon={Activity}   label="Avg Persons / Frame"     accent="text-pink-400"   value={avgDensity} />
        <StatBox icon={TrendingUp} label="Peak Persons in Frame"   accent="text-orange-400" value={peakDensity} />
      </div>

      <SectionHeader>Performance</SectionHeader>

      <div className="grid grid-cols-4 gap-3">
        <StatBox icon={Clock}    label="Processing Time"  accent="text-purple-400" value={elapsedTime} />
        <StatBox icon={Zap}      label="Throughput"       accent="text-yellow-400" value={throughput} />
        <StatBox icon={Cpu}      label="Avg Inference"    accent="text-amber-400"  value={avgInference} />
        <StatBox icon={Gauge}    label="Inference Range"  accent="text-slate-400"  value={inferenceRange} sub="min – max" />
      </div>

      <SectionHeader>Video Metadata</SectionHeader>

      <div className="grid grid-cols-4 gap-3">
        <StatBox icon={Target}    label="Resolution"  accent="text-cyan-300"   value={resolution} />
        <StatBox icon={Film}      label="Source FPS"  accent="text-blue-300"   value={sourceFps} />
        <StatBox icon={Clock}     label="Duration"    accent="text-slate-300"  value={duration} />
        <StatBox icon={BarChart2} label="Sampled At"  accent="text-indigo-300" value={processedFps} sub={frameStep} />
      </div>

      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Bot size={13} className="text-blue-400" />
          <p className="text-xs font-semibold text-white">AI Summary</p>
        </div>

        {summary ? (
          <>
            <p className="text-sm text-slate-300 leading-relaxed mb-4">{summary}</p>
            {sceneCaps?.length > 0 && (
              <>
                <div className="h-px bg-slate-800 mb-4" />
                <p className="text-[10px] font-mono font-semibold text-slate-600 uppercase tracking-widest mb-3">
                  Scene Breakdown · {sceneCaps.length} scenes
                </p>
                <SceneCaptions scenes={sceneCaps} />
              </>
            )}
          </>
        ) : (
          <>
            <div className="space-y-2">
              {[100, 83, 80, 92, 75].map((w, i) => (
                <div key={i} className="h-2.5 rounded bg-slate-800 animate-pulse" style={{ width: `${w}%` }} />
              ))}
            </div>
            <p className="text-[11px] text-slate-600 mt-3 italic">
              Summary will appear once analysis completes.
            </p>
          </>
        )}
      </Card>
    </div>
  );
}