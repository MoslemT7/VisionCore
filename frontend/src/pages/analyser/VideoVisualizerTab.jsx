import { useState, useRef } from "react";
import { Film, Play, Pause, Download, Info, BarChart2, Clock, Target } from "lucide-react";
import { API_BASE } from "../../api/client";

function getVideoUrl(videoFile) {
  if (!videoFile) return null;
  // Normalize Windows or Unix path → extract everything after "outputs/"
  const normalized = videoFile.replace(/\\/g, "/");
  const idx = normalized.indexOf("outputs/");
  if (idx === -1) return null;
  return `${API_BASE}/${normalized.slice(idx)}`;
}

function StatPill({ icon: Icon, label, value, accent = "text-slate-300" }) {
  return (
    <div className="flex items-center gap-2.5 bg-slate-800/60 border border-slate-700/40 rounded-xl px-3 py-2.5">
      <Icon size={13} className="text-slate-500 flex-shrink-0" />
      <div>
        <p className={`text-sm font-semibold font-mono leading-none ${accent}`}>{value ?? "—"}</p>
        <p className="text-[10px] text-slate-500 mt-0.5">{label}</p>
      </div>
    </div>
  );
}

function VideoPlayer({ src, label, badge }) {
  const videoRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play(); setPlaying(true); }
    else          { v.pause(); setPlaying(false); }
  };

  const onTimeUpdate = () => {
    const v = videoRef.current;
    if (!v || !v.duration) return;
    setProgress((v.currentTime / v.duration) * 100);
  };

  const onLoadedMetadata = () => {
    setDuration(videoRef.current?.duration ?? 0);
  };

  const seek = (e) => {
    const v = videoRef.current;
    if (!v) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct  = (e.clientX - rect.left) / rect.width;
    v.currentTime = pct * v.duration;
  };

  const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  return (
    <div className="bg-slate-950 rounded-xl overflow-hidden border border-slate-800 flex flex-col">
      <div className="relative group bg-black flex items-center justify-center">
        <video
          ref={videoRef}
          src={src}
          className="max-w-full max-h-[70vh] object-contain"
          onTimeUpdate={onTimeUpdate}
          onLoadedMetadata={onLoadedMetadata}
          onEnded={() => setPlaying(false)}
        />
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={togglePlay}
            className="w-10 h-10 rounded-full bg-black/60 border border-white/20 flex items-center justify-center text-white hover:bg-black/80 transition-colors"
          >
            {playing ? <Pause size={16} /> : <Play size={16} />}
          </button>
        </div>
        {badge && (
          <span className="absolute top-2 left-2 text-[9px] font-mono font-semibold px-2 py-0.5 rounded-full bg-black/70 border border-slate-700 text-slate-300">
            {badge}
          </span>
        )}
      </div>

      <div className="px-3 py-2 flex flex-col gap-1.5">
        <div
          className="h-1 bg-slate-800 rounded-full cursor-pointer overflow-hidden"
          onClick={seek}
        >
          <div
            className="h-full bg-blue-500 rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-slate-500 font-mono">
            {fmt(videoRef.current?.currentTime ?? 0)} / {fmt(duration)}
          </span>
          <span className="text-[10px] text-slate-500 font-mono">{label}</span>
        </div>
      </div>
    </div>
  );
}

export default function VideoVisualizerTab({
  file, result, analysisLoading, analysisError, analysisProgress, Card, PlaceholderBox,
}) {
  const videoUrl = getVideoUrl(result?.video_file);

  const topClasses = result?.top_classes?.slice(0, 5) ?? [];
  const maxCount   = topClasses[0]?.count ?? 1;

  return (
    <div className="space-y-4">

      {/* Status bar */}
      <Card className="p-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0">
            <Film size={14} className="text-blue-400" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-white truncate">{file?.name ?? "Video"}</p>
            <p className="text-[10px] text-slate-500 font-mono">
              {file ? `${(file.size / 1024 / 1024).toFixed(1)} MB` : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {analysisLoading && (
            <span className="text-[10px] font-mono text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-1 rounded-full">
              Processing {analysisProgress}%
            </span>
          )}
          {result?.status === "completed" && (
            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded-full">
              ✓ Completed
            </span>
          )}
          {videoUrl && (
            <a
              href={videoUrl}
              download
              className="flex items-center gap-1 text-[10px] font-mono text-slate-400 hover:text-slate-200 bg-slate-800 border border-slate-700 px-2 py-1 rounded-lg transition-colors"
            >
              <Download size={10} /> Download
            </a>
          )}
        </div>
      </Card>

      {analysisError && (
        <Card className="p-3 border-red-500/30 bg-red-500/5">
          <p className="text-[11px] text-red-400 font-mono">Error: {analysisError}</p>
        </Card>
      )}

      {/* Stats row */}
      {result && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatPill icon={Target}   label="Total detections" value={result.total_detections}                              accent="text-blue-400"    />
          <StatPill icon={Film}     label="Frames processed" value={result.total_frames}                                  accent="text-slate-300"   />
          <StatPill icon={Clock}    label="Elapsed time"     value={result.elapsed_time != null ? `${result.elapsed_time}s` : null} accent="text-amber-400" />
          <StatPill icon={BarChart2} label="Classes found"   value={result.top_classes?.length ?? 0}                      accent="text-purple-400"  />
        </div>
      )}

      {/* Video player */}
      {videoUrl ? (
        <Card className="p-4">
          <p className="text-xs font-semibold text-white mb-0.5">Annotated Output</p>
          <p className="text-[11px] text-slate-500 mb-3">YOLO26 processed video with bounding boxes.</p>
          <VideoPlayer src={videoUrl} label="annotated.mp4" badge="YOLO26" />
        </Card>
      ) : (
        <Card className="p-4">
          <p className="text-xs font-semibold text-white mb-0.5">Annotated Output</p>
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center">
              <Film size={18} className="text-slate-600" />
            </div>
            <p className="text-[11px] text-slate-500">
              {analysisLoading ? "Processing video — output will appear here when done." : "Start analysis to see the annotated video."}
            </p>
            {analysisLoading && (
              <div className="w-48 h-1 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all duration-300"
                  style={{ width: `${analysisProgress}%` }}
                />
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Top detected classes */}
      {topClasses.length > 0 && (
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <BarChart2 size={13} className="text-slate-500" />
            <p className="text-xs font-semibold text-white">Top Detected Classes</p>
          </div>
          <div className="space-y-2">
            {topClasses.map(c => (
              <div key={c.class} className="flex items-center gap-3">
                <span className="text-[11px] font-mono text-slate-400 w-24 truncate">{c.class}</span>
                <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500/70 rounded-full"
                    style={{ width: `${(c.count / maxCount) * 100}%` }}
                  />
                </div>
                <span className="text-[11px] font-mono text-slate-500 w-8 text-right">{c.count}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Summary */}
      {result?.summary && (
        <Card className="p-4 flex gap-3">
          <Info size={13} className="text-slate-500 flex-shrink-0 mt-0.5" />
          <p className="text-[11px] text-slate-400 font-mono leading-relaxed">{result.summary}</p>
        </Card>
      )}

    </div>
  );
}