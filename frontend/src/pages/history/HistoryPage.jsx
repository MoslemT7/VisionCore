import React, { useState, useEffect } from "react";
import { STATUS_CONFIG, formatDate, formatDuration, getFileExt } from "./historyUtils";
import { historyApi } from "../../api/historyApi";

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-1 rounded-full font-mono border ${cfg.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function SkeletonRow({ cols = 7 }) {
  return (
    <tr className="border-b border-slate-800/50">
      {[...Array(cols)].map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div
            className="h-3 rounded bg-slate-800 animate-pulse"
            style={{ width: `${40 + (i * 13) % 50}%` }}
          />
        </td>
      ))}
    </tr>
  );
}

export default function HistoryPage() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [activeTab, setActiveTab] = useState("recent"); // recent | historical
  const [selectedAnalysis, setSelectedAnalysis] = useState(null);

  const loadRecords = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await historyApi.list();
      setRecords(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecords();
  }, []);

  const displayRecords =
    records.length > 0
      ? records
      : Array.from({ length: 4 }, (_, i) => ({
          _id: `empty-${i}`,
          job_id: "—",
          filename: "No file",
          status: "pending",
          analysed_at: null,
          elapsed_time: null,
          total_detections: null,
          top_classes: [],
        }));

  const openHistorical = (analysis) => {
    setSelectedAnalysis(analysis);
    setActiveTab("historical");
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-100 tracking-tight">
            Analysis History
          </h1>
          <p className="text-xs text-slate-500 font-mono mt-0.5">
            VisionCore · AnalysisHistory
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab("recent")}
            className={`px-3 py-1.5 rounded-lg text-xs ${
              activeTab === "recent"
                ? "bg-slate-700 border border-slate-600 text-slate-100"
                : "bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700"
            }`}
          >
            Recent Analysis
          </button>
          <button
            onClick={() => setActiveTab("historical")}
            className={`px-3 py-1.5 rounded-lg text-xs ${
              activeTab === "historical"
                ? "bg-slate-700 border border-slate-600 text-slate-100"
                : "bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700"
            }`}
          >
            Historical Analysis
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 flex items-center gap-3">
          <span className="text-red-400 text-sm">⚠</span>
          <p className="text-red-400 text-xs font-mono">{error}</p>
          <button onClick={loadRecords} className="ml-auto text-xs text-red-400 hover:text-red-300">
            Retry
          </button>
        </div>
      )}

      {activeTab === "recent" && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-left">
                {["Job ID", "File", "Analysed", "Duration", "Detections", "Status", "Full"].map((h) => (
                  <th key={h} className="px-4 py-3 text-[10px] font-mono text-slate-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading
                ? [...Array(4)].map((_, i) => <SkeletonRow key={i} />)
                : displayRecords.map((r) => {
                    const isEmpty = r._id?.startsWith("empty-");
                    return (
                      <tr key={r._id} className="border-b border-slate-800/50 hover:bg-white/[0.02] transition-colors">
                        <td className="px-4 py-3 font-mono text-xs text-slate-500">{(r.job_id?.slice(-8) || "—").toUpperCase()}</td>
                        <td className="px-4 py-3 text-slate-300 font-mono truncate">{r.filename || "No file"}</td>
                        <td className="px-4 py-3 text-slate-500 font-mono text-[10px] whitespace-nowrap">{r.analysed_at ? formatDate(r.analysed_at) : "—"}</td>
                        <td className="px-4 py-3 text-slate-500 font-mono text-xs">{r.elapsed_time ? formatDuration(r.elapsed_time) : "—"}</td>
                        <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-300">{r.total_detections ?? "—"}</td>
                        <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                        <td className="px-4 py-3">
                          {!isEmpty && (
                            <button
                              className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-500 rounded text-white"
                              onClick={() => openHistorical(r)}
                            >
                              View Full
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === "historical" && selectedAnalysis && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-slate-800 rounded-lg p-4">
              <h2 className="text-xs text-slate-400 font-mono uppercase">Job ID</h2>
              <p className="text-sm text-slate-200 font-mono">{selectedAnalysis.job_id}</p>
            </div>
            <div className="bg-slate-800 rounded-lg p-4">
              <h2 className="text-xs text-slate-400 font-mono uppercase">Filename</h2>
              <p className="text-sm text-slate-200 font-mono">{selectedAnalysis.filename}</p>
            </div>
            <div className="bg-slate-800 rounded-lg p-4">
              <h2 className="text-xs text-slate-400 font-mono uppercase">Total Detections</h2>
              <p className="text-sm text-slate-200 font-mono">{selectedAnalysis.total_detections}</p>
            </div>
            <div className="bg-slate-800 rounded-lg p-4">
              <h2 className="text-xs text-slate-400 font-mono uppercase">Total Frames</h2>
              <p className="text-sm text-slate-200 font-mono">{selectedAnalysis.total_frames}</p>
            </div>
            <div className="bg-slate-800 rounded-lg p-4">
              <h2 className="text-xs text-slate-400 font-mono uppercase">Elapsed Time</h2>
              <p className="text-sm text-slate-200 font-mono">{formatDuration(selectedAnalysis.elapsed_time)}</p>
            </div>
            <div className="bg-slate-800 rounded-lg p-4">
              <h2 className="text-xs text-slate-400 font-mono uppercase">Status</h2>
              <StatusBadge status={selectedAnalysis.status} />
            </div>
          </div>

          {/* Top Classes */}
          {selectedAnalysis.top_classes?.length > 0 && (
            <div className="bg-slate-800 p-4 rounded-lg">
              <h2 className="text-xs text-slate-400 font-mono uppercase mb-2">Top Classes</h2>
              <div className="flex flex-wrap gap-2">
                {selectedAnalysis.top_classes.map((c) => (
                  <span key={c.class} className="text-[10px] font-mono px-2 py-1 rounded-md bg-slate-700 text-slate-300 border border-slate-600">
                    {c.class} ×{c.count}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Detection Summary */}
          {selectedAnalysis.summary_json?.detection_summary && (
            <div className="bg-slate-800 p-4 rounded-lg">
              <h2 className="text-xs text-slate-400 font-mono uppercase mb-2">Detection Summary</h2>
              <pre className="text-[11px] text-slate-200 font-mono overflow-x-auto">{JSON.stringify(selectedAnalysis.summary_json.detection_summary, null, 2)}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}