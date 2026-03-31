import { useRef, useMemo } from 'react';
import { useVideoUpload } from '../hooks/useVideoUpload';
import { API_BASE } from '../api/client';

export function VideoUpload() {
  const fileInputRef = useRef(null);
  const { upload, loading, result, error, progress } = useVideoUpload();

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      upload(file);
    }
  };

  const performanceSnapshot = useMemo(() => {
    if (!result || !result.performance_log) return [];
    return result.performance_log.slice(-30);
  }, [result]);

  const percent = progress?.percent ?? 0;
  const currentFrame = progress?.current_frame ?? 0;
  const totalFrames = progress?.total_frames ?? null;

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-4 rounded-xl bg-slate-900/60 border border-slate-800">
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-slate-100">Video Analysis</h3>
          <p className="text-sm text-slate-400">
            Upload a video to run YOLO detection and LLaMA-based summary.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            onChange={handleFileChange}
            disabled={loading}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
            className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium bg-sky-500 hover:bg-sky-400 disabled:opacity-50 disabled:cursor-not-allowed text-white shadow-sm transition-colors"
          >
            {loading ? 'Processing…' : 'Upload Video'}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-900/40 border border-red-700 text-sm text-red-100">
          {error}
        </div>
      )}

      {loading && (
        <div className="space-y-3 p-4 rounded-xl bg-slate-900/60 border border-slate-800">
          <div className="flex items-center justify-between text-sm text-slate-300">
            <span>Processing video…</span>
            <span>{percent.toFixed(1)}%</span>
          </div>
          <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-sky-500 transition-all"
              style={{ width: `${percent}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-slate-400">
            <span>
              Frame {currentFrame}
              {totalFrames ? ` / ${totalFrames}` : ''}
            </span>
          </div>
        </div>
      )}

      {result && (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
              <h4 className="text-sm font-semibold text-slate-100">Summary</h4>
              <p className="text-sm text-slate-300 whitespace-pre-wrap">
                {result.summary || 'No summary available.'}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
              <h4 className="text-sm font-semibold text-slate-100">Annotated Video</h4>
              <p className="text-xs text-slate-400 mb-2">
                Download and view the processed video with bounding boxes and labels.
              </p>
              {result.video_file && (
                <a
                  href={`${API_BASE}${result.video_file}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center px-3 py-1.5 rounded-md text-xs font-medium bg-sky-500 hover:bg-sky-400 text-white transition-colors"
                >
                  Open Annotated Video
                </a>
              )}
              {result.detections_file && (
                <a
                  href={`${API_BASE}${result.detections_file}`}
                  target="_blank"
                  rel="noreferrer"
                  className="ml-3 inline-flex items-center px-3 py-1.5 rounded-md text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-100 transition-colors"
                >
                  View Detections JSON
                </a>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
              <h4 className="text-sm font-semibold text-slate-100">Run Stats</h4>
              <div className="space-y-1 text-sm text-slate-300">
                <div>
                  <span className="text-slate-400">Energy:</span>{' '}
                  {result.energy_wh != null ? `${result.energy_wh.toFixed(4)} Wh` : '—'}
                </div>
                <div>
                  <span className="text-slate-400">Elapsed Time:</span>{' '}
                  {result.elapsed_time != null
                    ? `${result.elapsed_time.toFixed(2)} s`
                    : '—'}
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
              <h4 className="text-sm font-semibold text-slate-100">System Utilization (recent)</h4>
              <div className="space-y-2 text-xs text-slate-400">
                {performanceSnapshot.length === 0 ? (
                  <div>No metrics available.</div>
                ) : (
                  <>
                    <MetricsBar label="CPU" field="cpu_percent" data={performanceSnapshot} />
                    <MetricsBar label="RAM" field="ram_percent" data={performanceSnapshot} />
                    <MetricsBar label="GPU" field="gpu_percent" data={performanceSnapshot} />
                    <MetricsBar
                      label="GPU Memory"
                      field="gpu_memory_percent"
                      data={performanceSnapshot}
                    />
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MetricsBar({ label, field, data }) {
  const latest = data[data.length - 1]?.[field] ?? 0;
  const safe = typeof latest === 'number' ? latest : 0;

  return (
    <div className="space-y-1">
      <div className="flex justify-between">
        <span>{label}</span>
        <span>{safe ? `${safe.toFixed(1)}%` : '—'}</span>
      </div>
      <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
        <div
          className="h-full bg-emerald-400 transition-all"
          style={{ width: `${Math.min(100, safe)}%` }}
        />
      </div>
    </div>
  );
}
