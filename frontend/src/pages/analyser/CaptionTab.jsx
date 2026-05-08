import { useEffect, useRef, useState } from "react";
import { Bot, Clock, Sparkles, RefreshCw, AlertCircle, Loader2 } from "lucide-react";
import { captionApi } from "../../api/captionApi";
import { OllamaStatusBadge } from "../../components/OllamaStatusBadge";

function SceneCard({ scene, index, Card }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-2">
        <Clock size={12} className="text-blue-400 shrink-0" />
        <span className="text-[11px] font-mono text-slate-500">
          Scene {index + 1} &nbsp;·&nbsp; {scene.start_s}s → {scene.end_s}s
        </span>
      </div>
      <p className="text-sm text-slate-200 leading-relaxed">{scene.caption}</p>
    </Card>
  );
}

function Skeleton({ rows = 3, className = "" }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-2.5 rounded bg-slate-800 animate-pulse"
          style={{ width: `${[100, 88, 76, 92, 70][i % 5]}%` }}
        />
      ))}
    </div>
  );
}

function ProgressBanner({ progress }) {
  if (!progress || progress.stage === "idle") return null;

  const isGlobal = progress.stage === "global";
  const label = isGlobal
    ? "Generating global summary…"
    : progress.total > 0
    ? `Generating scene ${progress.scene} of ${progress.total}…`
    : "Starting caption generation…";

  const pct = isGlobal
    ? 95
    : progress.total > 0
    ? Math.round((progress.scene / progress.total) * 90)
    : 5;

  return (
    <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4 space-y-2">
      <div className="flex items-center gap-2">
        <Loader2 size={12} className="text-blue-400 animate-spin shrink-0" />
        <p className="text-[11px] text-blue-400 font-mono">{label}</p>
      </div>
      <div className="h-1 rounded-full bg-slate-700 overflow-hidden">
        <div
          className="h-full bg-blue-500 rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function CaptionTab({ Card, PlaceholderBox, result }) {
  const jobId = result?.job_id ?? null;

  const [captions,  setCaptions]  = useState(null);
  const [status,    setStatus]    = useState("idle");
  const [error,     setError]     = useState(null);
  const [progress,  setProgress]  = useState(null);

  const abortRef  = useRef(false);
  const pollRef   = useRef(null);

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  function startPolling() {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/caption/${jobId}/status`);
        if (res.ok) {
          const data = await res.json();
          setProgress(data);
          if (data.stage === "idle") stopPolling();
        }
      } catch {}
    }, 1500);
  }

  useEffect(() => {
    if (!jobId || result?.status !== "completed") return;

    abortRef.current = false;
    setStatus("loading");
    setError(null);
    setProgress({ stage: "starting", scene: 0, total: 0 });
    startPolling();

    (async () => {
      try {
        const data = await captionApi.generateCaptions(jobId);
        if (abortRef.current) return;
        setCaptions(data);
        setStatus("done");
        setProgress(null);
      } catch (err) {
        if (abortRef.current) return;
        setError(err?.message ?? "Unknown error");
        setStatus("error");
        setProgress(null);
      } finally {
        stopPolling();
      }
    })();

    return () => {
      abortRef.current = true;
      stopPolling();
    };
  }, [jobId]);

  async function handleRetry() {
    if (!jobId) return;
    setStatus("loading");
    setError(null);
    setProgress({ stage: "starting", scene: 0, total: 0 });
    startPolling();
    try {
      const data = await captionApi.generateCaptions(jobId);
      setCaptions(data);
      setStatus("done");
      setProgress(null);
    } catch (err) {
      setError(err?.message ?? "Unknown error");
      setStatus("error");
      setProgress(null);
    } finally {
      stopPolling();
    }
  }

  if (!jobId || result?.status !== "completed") {
    return (
      <div className="space-y-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={13} className="text-slate-600" />
            <p className="text-xs font-semibold text-slate-500">AI Captions</p>
          </div>
          <PlaceholderBox h="h-24" />
          <p className="text-[11px] text-slate-600 mt-3 italic">
            Captions will appear once a video is analysed.
          </p>
        </Card>
      </div>
    );
  }

  if (status === "error") {
    return (
      <Card className="p-4">
        <div className="flex items-start gap-3">
          <AlertCircle size={14} className="text-red-400 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-xs font-semibold text-red-400 mb-1">Caption generation failed</p>
            <p className="text-[11px] text-slate-500 mb-3">{error}</p>
            <button
              onClick={handleRetry}
              className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-lg
                bg-slate-800 border border-slate-700 text-slate-300
                hover:border-blue-500/50 hover:text-blue-400 transition-colors"
            >
              <RefreshCw size={10} />
              Retry
            </button>
          </div>
        </div>
      </Card>
    );
  }

  if (status === "loading" || !captions) {
    return (
      <div className="space-y-4">
        <ProgressBanner progress={progress} />

        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={13} className="text-blue-400" />
            <p className="text-xs font-semibold text-white">Global Description</p>
          </div>
          <Skeleton rows={4} />
        </Card>

        {[1, 2, 3, 4].map((n) => (
          <Card key={n} className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-20 h-2.5 rounded bg-slate-800 animate-pulse" />
            </div>
            <Skeleton rows={2} />
          </Card>
        ))}
      </div>
    );
  }

  const generatedAt = captions.generated_at
    ? new Date(captions.generated_at).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : null;

  return (
    <div className="space-y-4">
      <OllamaStatusBadge />

      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles size={13} className="text-blue-400" />
            <p className="text-xs font-semibold text-white">Global Description</p>
          </div>
          {generatedAt && (
            <span className="text-[10px] text-slate-600 font-mono">{generatedAt}</span>
          )}
        </div>
        <p className="text-sm text-slate-200 leading-relaxed">
          {captions.global_caption}
        </p>
      </Card>

      <div className="flex items-center gap-2 px-0.5">
        <Bot size={12} className="text-slate-500" />
        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600">
          Scene Captions
        </p>
      </div>

      {captions.scene_captions.map((scene, i) => (
        <SceneCard key={i} scene={scene} index={i} Card={Card} />
      ))}
    </div>
  );
}