import { useRef, useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload, Play, CheckCircle, RotateCcw,
  Eye, FileJson, Download, AlertCircle, Loader2,
  Scan, Users, Clock, Zap, Film, ChevronUp, ChevronDown, Activity,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { getAnalyserTabs } from "./tabs";

import VideoVisualizerTab from "./VideoVisualizerTab";
import SummaryTab         from "./SummaryTab";
import ObjectsTab         from "./ObjectsTab";
import ChatTab            from "./ChatTab";
import CaptionTab         from "./CaptionTab";
import TimelineTab         from "./TimelineTab";


function Card({ children, className = "" }) {
  return (
    <div className={`bg-slate-900 border border-slate-800 rounded-2xl ${className}`}>
      {children}
    </div>
  );
}

function PlaceholderBox({ h = "h-16", className = "" }) {
  return (
    <div className={`${h} rounded-xl bg-slate-800/60 border border-slate-700/30 ${className}`} />
  );
}

function StatBox({ icon: Icon, label, accent = "text-blue-400" }) {
  return (
    <div className="bg-slate-800/50 border border-slate-700/40 rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <Icon size={14} className={accent} />
        <div className="w-2 h-2 rounded-full bg-slate-700" />
      </div>
      <div>
        <div className="w-12 h-5 rounded bg-slate-700/60 mb-1.5" />
        <p className="text-[11px] text-slate-500">{label}</p>
      </div>
    </div>
  );
}

function statusLabel(status) {
  switch (status) {
    case "uploading":  return "Uploading video…";
    case "processing": return "Running person detection…";
    case "completed":  return "Analysis complete";
    case "failed":     return "Analysis failed";
    default:           return "Starting…";
  }
};

function useElapsedTimer(active, createdAt) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!active) { setElapsed(0); return; }
    const t0 = createdAt ? createdAt * 1000 : Date.now();
    const int = setInterval(() => setElapsed(Math.floor((Date.now() - t0) / 1000)), 500);
    return () => clearInterval(int);
  }, [active, createdAt]);
  return elapsed;
};

function formatElapsed(s) {
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${(s % 60).toString().padStart(2, "0")}s`;
};

export default function AnalyserPage({
  file,         setFile,
  uploadedFile, setUploadedFile,
  uploadError,  setUploadError,
  activeTab,    setActiveTab,
  messages,     setMessages,
  chatInput,    setChatInput,
  analysisLoading,
  result,
  analysisError,
  analysisProgress,
  analysisProgressPct,
  analysisStatus,
  upload,
  analyzeImages,
  reset,
}) {
  const fileInput = useRef(null);
  const endRef    = useRef(null);
  const [mode, setMode] = useState("video");
  const [headerExpanded, setHeaderExpanded] = useState(true);
  const { tc } = useTranslation("common");
  const { t } = useTranslation("upload");

  const ANALYSER_TABS = useMemo(() => getAnalyserTabs(t), [t]);

  const handleFile = (f) => {
    if (!f) return;
    const maxSizeBytes = 5 * 1024 * 1024 * 1024;
    const allowedExt   = [".mp4", ".avi", ".mov", ".mkv", ".webm"];
    const nameLower    = (f.name || "").toLowerCase();
    const isVideo      = f.type?.startsWith("video/") || allowedExt.some(e => nameLower.endsWith(e));
    if (!isVideo) { setUploadError("Please upload a valid video file (MP4, AVI, MOV, MKV, WEBM)."); return; }
    if (f.size > maxSizeBytes) { setUploadError("Video is too large. Maximum size is 5 GB."); return; }
    setUploadError("");
    setFile(f);
    setUploadedFile(null);
  };

  const startAnalysis = async () => {
    if (analysisLoading) return;
    try {
      if (mode === "video") {
        if (!file) return;
        await upload(file);
        setUploadedFile(file);
      } else {
        await analyzeImages();
        setUploadedFile({ name: "dataset1_144Images" });
      }
      setActiveTab("video");
    } catch (err) {
      setUploadError(err?.message || "Analysis failed.");
    }
  };

  const UploadScreen = () => {
  const createdAt     = analysisProgress?.created_at ?? null;
  const frames        = analysisProgress?.performance_log ?? [];
  const lastFrame     = frames[frames.length - 1] ?? null;
  const progress      = analysisProgressPct ?? 0;
  const uniqueSoFar   = analysisProgress?.unique_objects ?? lastFrame?.unique_so_far ?? 0;
  const processed     = lastFrame?.frame != null ? lastFrame.frame + 1 : 0;
  const totalFrames   = analysisProgress?.total_frames ?? null;
  const totalDets     = analysisProgress?.total_detections ?? 0;
  const inferMs       = frames.length ? frames.reduce((a, b) => a + b.inference_ms, 0) / frames.length : null;
  const elapsedTime   = analysisProgress?.elapsed_time ?? 0;
  const throughputFps = analysisProgress?.throughput_fps ?? null;
  const elapsed       = useElapsedTimer(analysisLoading, createdAt);

  const logRef = useRef(null);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = 0;
  }, [frames.length]);

  const stats = [
    { label: "Unique objects",   value: uniqueSoFar,    icon: Users },
    { label: "Detections",       value: totalDets,      icon: Eye },
    { label: "Avg inference",    value: inferMs != null ? `${inferMs.toFixed(1)}ms` : "—", icon: Zap },
    { label: "Elapsed",          value: elapsedTime >= 60 ? `${Math.floor(elapsedTime/60)}m ${Math.round(elapsedTime%60)}s` : `${Math.round(elapsedTime)}s`, icon: Clock },
    { label: "Throughput",       value: throughputFps ? `${throughputFps} fps` : "—", icon: Activity },
    { label: "Frames done",      value: totalFrames ? `${processed}/${totalFrames}` : processed, icon: Film },
  ];

  return (
    <motion.div
      key="upload-screen"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="flex flex-col items-center justify-center min-h-full px-6 py-6"
    >
      {/* ── Top header (hidden during analysis to save space) ── */}
      <AnimatePresence>
        {!analysisLoading && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8, height: 0 }}
            className="text-center mb-8 w-full"
          >
            <div className="flex gap-2 mb-5 justify-center">
              <button onClick={() => setMode("video")} className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-colors ${mode === "video" ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-400 hover:text-slate-300"}`}>Video</button>
              <button onClick={() => setMode("images")} className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-colors ${mode === "images" ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-400 hover:text-slate-300"}`}>Images Folder</button>
            </div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 mb-4">
              <Scan size={11} className="text-blue-400" />
              <span className="mono text-[10px] text-blue-400 font-semibold tracking-widest uppercase">AI Person Analyser</span>
            </div>
            <h1 className="text-2xl font-bold text-white mb-2 tracking-tight">{t("mainTitle")}</h1>
            <p className="text-sm text-slate-500 max-w-sm mx-auto leading-relaxed">{t("mainText")}</p>
            <div className="flex items-center justify-center gap-5 mt-4">
              {[{ icon: Eye, label: t("mainFeatures.detect") }, { icon: Users, label: t("mainFeatures.track") }, { icon: Film, label: t("mainFeatures.analysis") }].map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-1.5 text-slate-600">
                  <Icon size={11} /><span className="text-[11px]">{label}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Upload zone (video) ── */}
      {!analysisLoading && mode === "video" && (
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className={`w-full max-w-lg border-2 border-dashed rounded-2xl p-10 text-center transition-all duration-200 cursor-pointer
            ${file ? "border-emerald-500/50 bg-emerald-500/5" : "border-slate-700 hover:border-blue-500/40 hover:bg-blue-500/5"}`}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); handleFile(e.dataTransfer.files[0]); }}
          onClick={() => fileInput.current.click()}
        >
          <input ref={fileInput} type="file" accept="video/*" className="hidden" onChange={e => handleFile(e.target.files[0])} />
          <AnimatePresence mode="wait">
            {file ? (
              <motion.div key="file" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto mb-3">
                  <CheckCircle size={22} className="text-emerald-400" />
                </div>
                <p className="font-semibold text-white mb-1">{file.name}</p>
                <p className="text-xs text-slate-500 mono">{(file.size / 1024 / 1024).toFixed(1)} MB <span className="text-slate-600">· Click to replace</span></p>
              </motion.div>
            ) : (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="w-12 h-12 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-center mx-auto mb-3">
                  <Upload size={20} className="text-slate-500" />
                </div>
                <p className="font-semibold text-white mb-1">{t("upload.text")}</p>
                <p className="text-xs text-slate-600 mono">MP4 · AVI · MOV · MKV · up to 5 GB</p>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}

      {!analysisLoading && mode === "images" && (
        <div className="text-center text-slate-500 text-sm mt-4">
          Dataset will be loaded from backend folder
          <motion.button initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={startAnalysis}
            className="mt-4 flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition-colors mx-auto">
            <Play size={14} />Start Images Analysis
          </motion.button>
        </div>
      )}

      {uploadError && (
        <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="mt-3 flex items-center gap-2 text-xs text-red-400 mono">
          <AlertCircle size={12} />{uploadError}
        </motion.div>
      )}

      {/* ── Live analysis panel ── */}
      <AnimatePresence>
        {analysisLoading && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.25 }}
            className="w-full max-w-4xl"
          >
            {/* File pill */}
            {file && (
              <div className="flex items-center gap-2 mb-3 justify-center">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/60 border border-slate-700/50">
                  <Film size={11} className="text-slate-500" />
                  <span className="mono text-[11px] text-slate-400 truncate max-w-[260px]">{file.name}</span>
                  <span className="mono text-[10px] text-slate-600">{(file.size/1024/1024).toFixed(1)} MB</span>
                </div>
              </div>
            )}

            <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-5">

              {/* Status + progress header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Loader2 size={13} className="animate-spin text-blue-400 flex-shrink-0" />
                  <span className="text-sm font-semibold text-white">
                    {analysisStatus === "uploading" ? "Uploading footage…" : "Running person detection…"}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1 mono text-[11px] text-slate-500">
                    <Clock size={10} />
                    <span className="tabular-nums">{formatElapsed(elapsed)}</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="mono text-[12px] text-blue-400 font-semibold tabular-nums">{progress}%</span>
                    {totalFrames && (
                      <span className="mono text-[10px] text-slate-600 tabular-nums">{processed}/{totalFrames} frames</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Progress bar */}
              <div className="h-1.5 rounded-full bg-slate-700/60 overflow-hidden mb-4">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-blue-600 to-blue-400"
                  animate={{ width: `${progress}%` }}
                  transition={{ ease: "linear", duration: 0.4 }}
                />
              </div>

              {/* Two-column body */}
              {analysisStatus !== "uploading" && (
                <div className="flex gap-4">

                  {/* Left — stats grid */}
                  <div className="grid grid-cols-2 gap-2 w-64 flex-shrink-0 content-start">
                    {stats.map(({ label, value, icon: Icon }) => (
                      <div key={label} className="bg-slate-900/70 border border-slate-700/40 rounded-xl px-3 py-2.5">
                        <div className="flex items-center gap-1.5 mb-1">
                          <Icon size={9} className="text-slate-600" />
                          <p className="text-[9px] text-slate-600 uppercase tracking-widest mono">{label}</p>
                        </div>
                        <p className="text-[15px] font-semibold text-white mono tabular-nums leading-none">{value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Right — frame log */}
                  <div className="flex-1 rounded-xl bg-slate-900/60 border border-slate-700/40 overflow-hidden flex flex-col">
                    <div className="flex items-center justify-between px-3 py-2 border-b border-slate-700/40 flex-shrink-0">
                      <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                        <span className="mono text-[10px] text-slate-500 uppercase tracking-widest">Frame log</span>
                      </div>
                      <span className="mono text-[10px] text-slate-600">{frames.length} entries</span>
                    </div>

                    {frames.length === 0 ? (
                      <div className="flex-1 flex items-center justify-center py-8">
                        <span className="mono text-[11px] text-slate-700">Waiting for frames…</span>
                      </div>
                    ) : (
                      <div ref={logRef} className="overflow-y-auto" style={{ maxHeight: "196px" }}>
                        {[...frames].reverse().map((f, i) => (
                          <div
                            key={f.frame}
                            className={`flex items-center justify-between px-3 py-1.5 border-b border-slate-800/60 last:border-0 ${i === 0 ? "bg-blue-500/5" : ""}`}
                          >
                            <div className="flex items-center gap-2">
                              {i === 0
                                ? <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse flex-shrink-0" />
                                : <div className="w-1.5 h-1.5 flex-shrink-0" />
                              }
                              <span className="mono text-[10px] text-slate-500 tabular-nums">#{String(f.frame + 1).padStart(4, "0")}</span>
                            </div>
                            <div className="flex items-center gap-4 flex-shrink-0">
                              <span className={`mono text-[10px] tabular-nums w-14 text-right ${f.detections > 0 ? "text-emerald-400" : "text-slate-700"}`}>
                                {f.detections > 0 ? `+${f.detections} det` : "— det"}
                              </span>
                              <span className="mono text-[10px] text-blue-400 tabular-nums w-14 text-right">{f.unique_so_far ?? "—"} uniq</span>
                              <span className="mono text-[10px] text-slate-600 tabular-nums w-12 text-right">{f.inference_ms?.toFixed(0)}ms</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <p className="text-[10px] text-slate-700 mono border-t border-slate-700/40 pt-3 mt-4">
                Processing runs in the background — you can navigate away and return.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Start button ── */}
      {file && !analysisLoading && (
        <motion.button
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
          onClick={startAnalysis}
          className="mt-5 flex items-center gap-2.5 px-7 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition-colors shadow-lg shadow-blue-900/30"
        >
          <Play size={15} />Start Analysis
        </motion.button>
      )}
    </motion.div>
  );
};

  const ResultsScreen = () => (
    
    <motion.div
      key="results-screen"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="flex flex-col h-full"
    >
      <div className="flex-shrink-0 px-6 pt-5 pb-0 border-b border-slate-800/60 bg-slate-950/60 backdrop-blur-sm">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
              <CheckCircle size={13} className="text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-[9px] font-semibold text-emerald-400 uppercase tracking-widest mono">Analysis Complete</p>
                <span className="text-slate-600">·</span>
                <h2 className="text-xs font-bold text-white truncate max-w-[180px]">
                  {uploadedFile?.name}
                </h2>
              </div>
              <AnimatePresence initial={false}>
                {headerExpanded && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      {[
                        { icon: Film,  val: uploadedFile?.size ? `${(uploadedFile.size / 1024 / 1024).toFixed(1)} MB` : null },
                        { icon: Eye,   val: result?.total_detections != null ? `${result.total_detections.toLocaleString()} detections` : null },
                        { icon: Users, val: result?.total_unique_objects != null ? `${result.total_unique_objects} unique persons` : null },
                        { icon: Clock, val: result?.elapsed_time != null ? `${result.elapsed_time}s` : null },
                        { icon: Zap,   val: result?.performance?.avg_inference_ms != null ? `${result.performance.avg_inference_ms}ms avg inference` : null },
                      ].filter(s => s.val).map(({ icon: Icon, val }) => (
                        <div key={val} className="flex items-center gap-1 text-slate-500">
                          <Icon size={9} />
                          <span className="mono text-[9px]">{val}</span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-700/60 bg-slate-800/40 text-slate-400 hover:border-slate-600 hover:text-slate-200 text-xs font-medium transition-all">
              <FileJson size={11} /> JSON
            </button>
            <button className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-700/60 bg-slate-800/40 text-slate-400 hover:border-slate-600 hover:text-slate-200 text-xs font-medium transition-all">
              <Download size={11} /> PDF
            </button>
            <button
              onClick={reset}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-700/60 bg-slate-800/40 text-slate-400 hover:border-red-500/30 hover:text-red-400 hover:bg-red-500/5 text-xs font-medium transition-all"
            >
              <RotateCcw size={11} /> New
            </button>
            <button
              onClick={() => setHeaderExpanded(e => !e)}
              className="flex items-center justify-center w-7 h-7 rounded-lg border border-slate-700/60 bg-slate-800/40 text-slate-400 hover:border-slate-600 hover:text-slate-200 transition-all"
            >
              {headerExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>
          </div>
        </div>

        <div className="flex gap-0.5">
          {ANALYSER_TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`relative flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium transition-all
                ${activeTab === t.id ? "text-white" : "text-slate-500 hover:text-slate-300"}`}
            >
              <t.icon size={11} />
              {t.label}
              {activeTab === t.id && (
                <motion.div
                  layoutId="tab-indicator"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-full"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            {activeTab === "video"    && <VideoVisualizerTab file={uploadedFile} result={result} analysisLoading={false} analysisError={analysisError} analysisProgress={100} Card={Card} PlaceholderBox={PlaceholderBox} />}
            {activeTab === "summary"  && <SummaryTab  Card={Card} StatBox={StatBox} PlaceholderBox={PlaceholderBox} result={result} jobId={result?.job_id} />}
            {activeTab === "objects"  && <ObjectsTab  Card={Card} PlaceholderBox={PlaceholderBox} result={result} />}
            {activeTab === "chat"     && <ChatTab     Card={Card} PlaceholderBox={PlaceholderBox} result={result} />}
            {activeTab === "captions" && <CaptionTab  Card={Card} PlaceholderBox={PlaceholderBox} result={result} />}
            {activeTab === "timeline" && <TimelineTab Card={Card} PlaceholderBox={PlaceholderBox} result={result} />}

          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  );

  return (
    <div className="flex flex-col h-full bg-slate-950" style={{ fontFamily: "'Sora', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
        .mono { font-family: 'DM Mono', monospace !important; }
      `}</style>

      <AnimatePresence mode="wait">
        {uploadedFile
          ? <ResultsScreen key="results" />
          : <UploadScreen  key="upload"  />
        }
      </AnimatePresence>
    </div>
  );
}