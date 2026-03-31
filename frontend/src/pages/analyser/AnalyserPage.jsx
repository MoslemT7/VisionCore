import { useRef, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload, Play, CheckCircle, RotateCcw,
  Eye, FileJson, Download, AlertCircle, Loader2,
  Scan, Users, Clock, Zap, Film,
} from "lucide-react";
import { ANALYSER_TABS } from "./tabs";
import VideoVisualizerTab from "./VideoVisualizerTab";
import SummaryTab         from "./SummaryTab";
import ObjectsTab         from "./ObjectsTab";
import ChatTab            from "./ChatTab";
import CaptionTab            from "./CaptionTab";

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

function Bubble({ from, text }) {
  return (
    <div className={`flex gap-2.5 ${from === "user" ? "flex-row-reverse" : ""}`}>
      <div
        className={`w-6 h-6 rounded-lg flex-shrink-0 flex items-center justify-center text-[10px] font-bold
          ${from === "ai"
            ? "bg-blue-500/15 text-blue-400 border border-blue-500/20"
            : "bg-slate-700 text-slate-300"}`}
      >
        {from === "ai" ? "AI" : "U"}
      </div>
      <div
        className={`max-w-[80%] rounded-xl px-3 py-2.5 text-xs leading-relaxed
          ${from === "ai"
            ? "bg-slate-800 border border-slate-700 text-slate-200"
            : "bg-blue-500/10 border border-blue-500/20 text-slate-200"}`}
      >
        {text}
      </div>
    </div>
  );
}

function statusLabel(status) {
  switch (status) {
    case "uploading":  return "Uploading video…";
    case "processing": return "Running YOLO analysis…";
    case "completed":  return "Analysis complete";
    case "failed":     return "Analysis failed";
    default:           return "Starting…";
  }
}

const STEPS = [
  { label: "Uploading footage",     detail: "Transferring video to the server"             },
  { label: "Extracting frames",     detail: "Sampling frames at the configured rate"       },
  { label: "Running YOLO detection",detail: "Identifying objects frame by frame"           },
  { label: "ByteTrack tracking",    detail: "Linking detections into unique object tracks" },
  { label: "Building report",       detail: "Aggregating stats, heatmap & timeline"        },
];

function useElapsedTimer(active) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!active) { setElapsed(0); return; }
    const t0  = Date.now();
    const int = setInterval(() => setElapsed(Math.floor((Date.now() - t0) / 1000)), 1000);
    return () => clearInterval(int);
  }, [active]);
  return elapsed;
}

function formatElapsed(s) {
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${(s % 60).toString().padStart(2, "0")}s`;
}

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
  analysisStatus,
  upload,
  reset,
}) {
  const fileInput = useRef(null);
  const endRef    = useRef(null);
  const openHistoricalAnalysis = (record) => {
    if (!record) return;

    const pseudoFile = record.filename
      ? { name: record.filename, size: record.size ?? 0 }
      : null;

    setFile(pseudoFile); 
    setUploadedFile(pseudoFile);
    setResult(record);
    setActiveTab("video"); 
  };
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
    if (!file || analysisLoading) return;
    setUploadError("");
    try {
      await upload(file);
      setUploadedFile(file);
      setActiveTab("video");
    } catch (err) {
      setUploadError(err?.message || "Analysis failed. Make sure the backend is running on port 8000.");
    }
  };

  const sendChat = () => {
    const msg = chatInput.trim();
    if (!msg) return;
    setMessages(m => [...m, { from: "user", text: msg }]);
    setChatInput("");
    setTimeout(() => {
      setMessages(m => [...m, { from: "ai", text: "Placeholder response — connect your backend to enable real answers." }]);
      endRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 700);
  };

  const UploadScreen = () => {
    const elapsed    = useElapsedTimer(analysisLoading);
    const activeStep = analysisStatus === "uploading" ? 0 : Math.min(4, 1 + Math.floor((analysisProgress / 100) * 4));

    return (
      <motion.div
        key="upload-screen"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        className="flex flex-col items-center justify-center min-h-full px-4"
      >
        <div className="text-center mb-10">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.05 }}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 mb-5"
          >
            <Scan size={11} className="text-blue-400" />
            <span className="mono text-[10px] text-blue-400 font-semibold tracking-widest uppercase">AI Video Analyser</span>
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-[28px] font-bold text-white mb-3 tracking-tight"
          >
            Upload Footage to Analyse
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15 }}
            className="text-sm text-slate-500 max-w-sm mx-auto leading-relaxed"
          >
            The AI pipeline detects objects, tracks individuals, and generates a full behavioural report.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex items-center justify-center gap-5 mt-6"
          >
            {[
              { icon: Eye,   label: "Object Detection" },
              { icon: Users, label: "Person Tracking"  },
              { icon: Film,  label: "Frame Analysis"   },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-1.5 text-slate-600">
                <Icon size={11} />
                <span className="text-[11px]">{label}</span>
              </div>
            ))}
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18 }}
          className={`w-full max-w-xl border-2 border-dashed rounded-2xl p-12 text-center transition-all duration-200
            ${analysisLoading ? "pointer-events-none opacity-60" : "cursor-pointer"}
            ${file
              ? "border-emerald-500/50 bg-emerald-500/5"
              : "border-slate-700 hover:border-blue-500/40 hover:bg-blue-500/5"}`}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); handleFile(e.dataTransfer.files[0]); }}
          onClick={() => !analysisLoading && fileInput.current.click()}
        >
          <input ref={fileInput} type="file" accept="video/*" className="hidden" onChange={e => handleFile(e.target.files[0])} />
          <AnimatePresence mode="wait">
            {file ? (
              <motion.div key="file" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle size={24} className="text-emerald-400" />
                </div>
                <p className="font-semibold text-white mb-1">{file.name}</p>
                <p className="text-xs text-slate-500 mono">
                  {(file.size / 1024 / 1024).toFixed(1)} MB
                  {!analysisLoading && <span className="text-slate-600"> · Click to replace</span>}
                </p>
              </motion.div>
            ) : (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="w-14 h-14 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-center mx-auto mb-4">
                  <Upload size={22} className="text-slate-500" />
                </div>
                <p className="font-semibold text-white mb-1.5">Drop video here or click to browse</p>
                <p className="text-xs text-slate-600 mono">MP4 · AVI · MOV · MKV · up to 5 GB</p>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {uploadError && (
          <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="mt-3 flex items-center gap-2 text-xs text-red-400 mono">
            <AlertCircle size={12} />
            {uploadError}
          </motion.div>
        )}

        <AnimatePresence>
          {analysisLoading && (
            <motion.div
              initial={{ opacity: 0, y: 10, height: 0 }}
              animate={{ opacity: 1, y: 0, height: "auto" }}
              exit={{ opacity: 0, y: -6, height: 0 }}
              className="w-full max-w-xl mt-5 overflow-hidden"
            >
              <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Loader2 size={13} className="animate-spin text-blue-400" />
                    <span className="text-sm font-semibold text-white">{STEPS[activeStep]?.label ?? "Processing…"}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 mono text-[11px] text-slate-500">
                      <Clock size={10} />
                      <span className="tabular-nums">{formatElapsed(elapsed)}</span>
                    </div>
                    <span className="mono text-[11px] text-blue-400 font-semibold tabular-nums">{analysisProgress}%</span>
                  </div>
                </div>

                <div className="h-1.5 rounded-full bg-slate-700/60 overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-blue-600 to-blue-400"
                    initial={{ width: 0 }}
                    animate={{ width: `${analysisProgress}%` }}
                    transition={{ ease: "linear", duration: 0.4 }}
                  />
                </div>

                <div className="space-y-2">
                  {STEPS.map((step, i) => {
                    const done    = i < activeStep;
                    const current = i === activeStep;
                    return (
                      <div key={i} className="flex items-start gap-3">
                        <div className="mt-0.5 flex-shrink-0">
                          {done ? (
                            <div className="w-4 h-4 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
                              <CheckCircle size={9} className="text-emerald-400" />
                            </div>
                          ) : current ? (
                            <div className="w-4 h-4 rounded-full bg-blue-500/20 border border-blue-500/40 flex items-center justify-center">
                              <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                            </div>
                          ) : (
                            <div className="w-4 h-4 rounded-full bg-slate-700/60 border border-slate-700 flex items-center justify-center">
                              <div className="w-1.5 h-1.5 rounded-full bg-slate-600" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-[11px] font-medium leading-none mb-0.5 ${done ? "text-emerald-400" : current ? "text-white" : "text-slate-600"}`}>
                            {step.label}
                          </p>
                          {current && <p className="text-[10px] text-slate-500 mt-0.5">{step.detail}</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <p className="text-[10px] text-slate-600 mono border-t border-slate-700/40 pt-3">
                  Processing runs in the background — you can navigate away and return.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {file && !analysisLoading && (
          <motion.button
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={startAnalysis}
            className="mt-6 flex items-center gap-2.5 px-7 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition-colors shadow-lg shadow-blue-900/30"
          >
            <Play size={15} />
            Start Analysis
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
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
              <CheckCircle size={16} className="text-emerald-400" />
            </div>
            <div>
              <p className="text-[10px] font-semibold text-emerald-400 uppercase tracking-widest mono mb-0.5">Analysis Complete</p>
              <h2 className="text-base font-bold text-white leading-tight truncate max-w-xs">
                {uploadedFile?.name}
              </h2>
              <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                {[
                  { icon: Film,  val: uploadedFile ? `${(uploadedFile.size / 1024 / 1024).toFixed(1)} MB` : null },
                  { icon: Eye,   val: result?.total_detections != null ? `${result.total_detections.toLocaleString()} detections` : null },
                  { icon: Users, val: result?.total_unique_objects != null ? `${result.total_unique_objects} unique objects` : null },
                  { icon: Clock, val: result?.elapsed_time != null ? `${result.elapsed_time}s` : null },
                  { icon: Zap,   val: result?.performance?.avg_inference_ms != null ? `${result.performance.avg_inference_ms}ms avg inference` : null },
                ].filter(s => s.val).map(({ icon: Icon, val }) => (
                  <div key={val} className="flex items-center gap-1 text-slate-500">
                    <Icon size={10} />
                    <span className="mono text-[10px]">{val}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700/60 bg-slate-800/40 text-slate-400 hover:border-slate-600 hover:text-slate-200 text-xs font-medium transition-all">
              <FileJson size={11} /> JSON
            </button>
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700/60 bg-slate-800/40 text-slate-400 hover:border-slate-600 hover:text-slate-200 text-xs font-medium transition-all">
              <Download size={11} /> PDF
            </button>
            <button
              onClick={reset}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700/60 bg-slate-800/40 text-slate-400 hover:border-red-500/30 hover:text-red-400 hover:bg-red-500/5 text-xs font-medium transition-all"
            >
              <RotateCcw size={11} /> New
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

      <div className="flex-1 overflow-y-auto px-6 py-5">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            {activeTab === "video"    && <VideoVisualizerTab file={uploadedFile} result={result} analysisLoading={false} analysisError={analysisError} analysisProgress={100} Card={Card} PlaceholderBox={PlaceholderBox} />}
            {activeTab === "summary"  && <SummaryTab  Card={Card} StatBox={StatBox} PlaceholderBox={PlaceholderBox} result={result} />}
            {activeTab === "objects"  && <ObjectsTab  Card={Card} PlaceholderBox={PlaceholderBox} result={result} />}
            {activeTab === "chat" && <ChatTab Card={Card} PlaceholderBox={PlaceholderBox} result={result} />}
            {activeTab === "captions"     && <CaptionTab Card={Card} PlaceholderBox={PlaceholderBox} result={result}  />}

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