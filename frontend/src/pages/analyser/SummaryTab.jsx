import {
  Film,
  Eye,
  Users,
  Layers,
  Clock,
  Cpu,
  Zap,
  Bot,
  Activity,
  Target,
  TrendingUp,
  BarChart2,
  Gauge,
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

function ClassRow({ entry, maxUnique }) {
  const cls       = entry.class;
  const unique    = entry.unique_tracks ?? entry.count ?? 0;
  const totalDets = entry.total_detections ?? null;
  const avgConf   = entry.avg_conf         ?? null;
  const pct       = maxUnique > 0 ? Math.min(100, Math.round((unique / maxUnique) * 100)) : 0;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-slate-300 capitalize font-medium">{cls}</span>
        <div className="flex items-center gap-2">
          {avgConf != null && <ConfPill conf={avgConf} />}
          <span className="text-slate-500 font-mono">
            {unique} unique{totalDets != null ? ` · ${totalDets} det` : ""}
          </span>
        </div>
      </div>

      <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
        <div
          className="h-full bg-blue-500 rounded-full transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>

    </div>
  );
}

export default function SummaryTab({ Card, PlaceholderBox, result }) {
  const hasResult = !!result;
  const totalFrames     = result?.total_frames         ?? null;
  const totalDetections = result?.total_detections     ?? null;
  const totalUnique     = result?.total_unique_objects ?? null;
  const elapsedTime     = result?.elapsed_time != null ? `${result.elapsed_time}s` : null;
  const videoMeta        = result?.video_meta        ?? {};
  const performance      = result?.performance       ?? {};
  const detectionSummary = result?.detection_summary ?? {};
  const classStats       = result?.class_stats       ?? [];
  const topClasses       = result?.top_classes       ?? [];
  const resolution   = videoMeta.width && videoMeta.height
    ? `${videoMeta.width}×${videoMeta.height}` : null;
  const sourceFps    = videoMeta.source_fps    != null ? `${videoMeta.source_fps} fps`     : null;
  const duration     = videoMeta.duration_s    != null ? `${videoMeta.duration_s}s`        : null;
  const processedFps = videoMeta.processed_fps != null ? `${videoMeta.processed_fps} fps`  : null;
  const frameStep    = videoMeta.frame_step    != null ? `every ${videoMeta.frame_step} frames` : null;
  const throughput   = performance.throughput_fps   != null ? `${performance.throughput_fps} fps` : null;
  const avgInference = performance.avg_inference_ms != null ? `${performance.avg_inference_ms}ms` : null;
  const minInference = performance.min_inference_ms != null ? `${performance.min_inference_ms}ms` : null;
  const maxInference = performance.max_inference_ms != null ? `${performance.max_inference_ms}ms` : null;
  const inferenceRange = minInference && maxInference ? `${minInference} – ${maxInference}` : null;

  const avgDensity  = detectionSummary.avg_detections_per_frame != null
    ? detectionSummary.avg_detections_per_frame.toFixed(1) : null;
  const peakDensity = detectionSummary.max_detections_in_frame  != null
    ? String(detectionSummary.max_detections_in_frame) : null;
  const numClasses  = detectionSummary.num_classes != null
    ? String(detectionSummary.num_classes)
    : hasResult ? String(classStats.length || topClasses.length || 0) : null;

  const classes   = classStats.length > 0 ? classStats : topClasses;
  const maxUnique = classes.length > 0
    ? Math.max(...classes.map((e) => e.unique_tracks ?? e.count ?? 0))
    : 1;

  const summary = result?.summary ?? null;

  return (
    <div className="space-y-5">
      <SectionHeader>Detection Overview</SectionHeader>

      <div className="grid grid-cols-4 gap-3">
        <StatBox icon={Film}    label="Frames Processed" accent="text-blue-400"    value={totalFrames} />
        <StatBox icon={Eye}     label="Total Detections" accent="text-cyan-400"    value={totalDetections} />
        <StatBox icon={Users}   label="Unique Objects"   accent="text-emerald-400" value={totalUnique} />
        <StatBox icon={Layers}  label="Classes Found"    accent="text-red-400"     value={numClasses} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <StatBox icon={Activity}   label="Avg Detections / Frame"   accent="text-pink-400"   value={avgDensity} />
        <StatBox icon={TrendingUp} label="Peak Detections in Frame" accent="text-orange-400" value={peakDensity} />
      </div>

      {/* ── Performance ──────────────────────────────────────────────────── */}
      <SectionHeader>Performance</SectionHeader>

      <div className="grid grid-cols-4 gap-3">
        <StatBox icon={Clock} label="Processing Time" accent="text-purple-400" value={elapsedTime} />
        <StatBox icon={Zap}   label="Throughput"      accent="text-yellow-400" value={throughput} />
        <StatBox icon={Cpu}   label="Avg Inference"   accent="text-amber-400"  value={avgInference} />
        <StatBox
          icon={Gauge}
          label="Inference Range"
          accent="text-slate-400"
          value={inferenceRange}
          sub="min – max"
        />
      </div>

      {/* ── Video Metadata ───────────────────────────────────────────────── */}
      <SectionHeader>Video Metadata</SectionHeader>

      <div className="grid grid-cols-4 gap-3">
        <StatBox icon={Target}   label="Resolution"  accent="text-cyan-300"   value={resolution} />
        <StatBox icon={Film}     label="Source FPS"  accent="text-blue-300"   value={sourceFps} />
        <StatBox icon={Clock}    label="Duration"    accent="text-slate-300"  value={duration} />
        <StatBox
          icon={BarChart2}
          label="Sampled At"
          accent="text-indigo-300"
          value={processedFps}
          sub={frameStep}
        />
      </div>

      {/* ── Class Breakdown ──────────────────────────────────────────────── */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-0.5">
          <p className="text-xs font-semibold text-white">Class Breakdown</p>
          {hasResult && classes.length > 0 && (
            <span className="text-[10px] text-slate-600 font-mono">
              {classes.length} class{classes.length !== 1 ? "es" : ""}
            </span>
          )}
        </div>
        <p className="text-[11px] text-slate-500 mb-4">
          Unique tracked objects · avg confidence · movement
        </p>

        {hasResult && classes.length > 0 ? (
          <div className="space-y-4">
            {classes.slice(0, 8).map((entry) => (
              <ClassRow key={entry.class} entry={entry} maxUnique={maxUnique} />
            ))}
          </div>
        ) : (
          <PlaceholderBox h="h-36" />
        )}
      </Card>

      {/* ── AI Summary ───────────────────────────────────────────────────── */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Bot size={13} className="text-blue-400" />
          <p className="text-xs font-semibold text-white">AI Summary</p>
        </div>

        {summary ? (
          <p className="text-sm text-slate-300 leading-relaxed">{summary}</p>
        ) : (
          <>
            <div className="space-y-2">
              {[..."xxxxx"].map((_, i) => (
                <div
                  key={i}
                  className="h-2.5 rounded bg-slate-800 animate-pulse"
                  style={{ width: `${[100, 83, 80, 92, 75][i]}%` }}
                />
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