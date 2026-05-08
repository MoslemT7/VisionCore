import React from "react";

export default function AnalysisModal({ data, onClose }) {
  if (!data) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-2xl p-6 space-y-4">

        <div className="flex justify-between items-center">
          <h2 className="text-sm text-slate-200 font-semibold">Analysis Details</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300">✕</button>
        </div>

        <div className="grid grid-cols-2 gap-4 text-xs font-mono">
          <div>
            <p className="text-slate-500">Job ID</p>
            <p className="text-slate-300">{data.job_id}</p>
          </div>

          <div>
            <p className="text-slate-500">Status</p>
            <p className="text-slate-300">{data.status}</p>
          </div>

          <div>
            <p className="text-slate-500">Frames</p>
            <p className="text-slate-300">{data.total_frames ?? "—"}</p>
          </div>

          <div>
            <p className="text-slate-500">Detections</p>
            <p className="text-slate-300">{data.total_detections ?? "—"}</p>
          </div>

          <div>
            <p className="text-slate-500">Unique</p>
            <p className="text-slate-300">{data.total_unique ?? "—"}</p>
          </div>

          <div>
            <p className="text-slate-500">Elapsed</p>
            <p className="text-slate-300">{data.elapsed_time ?? "—"}s</p>
          </div>
        </div>

        {data.classes?.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-slate-500 font-mono">Classes</p>
            <div className="flex flex-wrap gap-2">
              {data.classes.map((c) => (
                <span key={c.class} className="text-[10px] px-2 py-1 bg-slate-800 rounded border border-slate-700">
                  {c.class} ×{c.count}
                </span>
              ))}
            </div>
          </div>
        )}

        {data.summary && (
          <p className="text-xs text-slate-400 font-mono bg-slate-800/50 p-3 rounded">
            {data.summary}
          </p>
        )}

      </div>
    </div>
  );
}