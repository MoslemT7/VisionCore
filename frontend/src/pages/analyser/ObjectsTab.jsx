import { useState, useMemo } from "react";
import { Search, ChevronUp, ChevronDown, ChevronsUpDown, Clock, Film, User } from "lucide-react";

function confidenceLabel(conf) {
  if (conf >= 0.85) return { label: "High",   cls: "text-emerald-400 bg-emerald-500/10" };
  if (conf >= 0.65) return { label: "Medium", cls: "text-amber-400 bg-amber-500/10"     };
  return                   { label: "Low",    cls: "text-red-400 bg-red-500/10"         };
}

function presenceLabel(frameCount, totalFrames) {
  if (!totalFrames) return "—";
  const pct = frameCount / totalFrames;
  if (pct >= 0.7)  return "Throughout";
  if (pct >= 0.35) return "Often";
  if (pct >= 0.1)  return "Briefly";
  return "Glimpsed";
}

function durationLabel(firstFrame, lastFrame, sourceFps) {
  if (!sourceFps) return null;
  const secs = (lastFrame - firstFrame) / sourceFps;
  if (secs < 1)  return "< 1s";
  if (secs < 60) return `${Math.round(secs)}s`;
  return `${Math.floor(secs / 60)}m ${Math.round(secs % 60)}s`;
}

function toTimecode(frame, sourceFps) {
  if (!sourceFps) return `#${frame}`;
  const s = frame / sourceFps;
  return `${s.toFixed(1)}s`;
}

function AppearanceBar({ firstFrame, lastFrame, totalFrames }) {
  if (!totalFrames) return null;
  const left  = (firstFrame / totalFrames) * 100;
  const width = Math.max(2, ((lastFrame - firstFrame) / totalFrames) * 100);
  return (
    <div className="relative h-1.5 bg-slate-800 rounded-full overflow-hidden w-full">
      <div
        className="absolute top-0 h-full rounded-full bg-cyan-500 opacity-80"
        style={{ left: `${left}%`, width: `${width}%` }}
      />
    </div>
  );
}

function SortIcon({ col, sortCol, sortDir }) {
  if (sortCol !== col) return <ChevronsUpDown size={10} className="text-slate-600 ml-1 inline" />;
  return sortDir === "asc"
    ? <ChevronUp   size={10} className="text-blue-400 ml-1 inline" />
    : <ChevronDown size={10} className="text-blue-400 ml-1 inline" />;
}

export default function ObjectsTab({ Card, PlaceholderBox, result }) {
  const [search,  setSearch]  = useState("");
  const [sortCol, setSortCol] = useState("frame_count");
  const [sortDir, setSortDir] = useState("desc");
  const [page,    setPage]    = useState(0);
  const PAGE_SIZE = 12;

  const isImagesMode = !!result?.rich_stats?.images_meta;

  const trackDetails = result?.rich_stats?.track_details
                    ?? result?.track_details
                    ?? [];

  const totalFrames = result?.total_frames
                   ?? result?.rich_stats?.images_meta?.processed_images
                   ?? result?.rich_stats?.video_meta?.total_frames
                   ?? 0;

  const sourceFps = isImagesMode
    ? (result?.rich_stats?.images_meta?.synthetic_fps ?? 1)
    : (result?.rich_stats?.video_meta?.source_fps ?? result?.video_meta?.source_fps ?? 25);

  const personTracks = useMemo(
    () => trackDetails.filter(t => t.class?.toLowerCase() === "person"),
    [trackDetails]
  );

  const hasResult = !!result && personTracks.length > 0;

  const filtered = useMemo(() => {
    let rows = [...personTracks];
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter(t => String(t.track_id).includes(q));
    }
    rows.sort((a, b) => {
      const av = a[sortCol] ?? 0;
      const bv = b[sortCol] ?? 0;
      return sortDir === "asc" ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
    });
    return rows;
  }, [personTracks, search, sortCol, sortDir]);

  const pageCount = Math.ceil(filtered.length / PAGE_SIZE);
  const pageRows  = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  function toggleSort(col) {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("desc"); }
    setPage(0);
  }

  function formatFrameLabel(frameIdx) {
    if (isImagesMode) return `#${frameIdx}`;
    return toTimecode(frameIdx, sourceFps);
  }

  function formatDuration(firstFrame, lastFrame) {
    if (isImagesMode) {
      const count = (lastFrame - firstFrame) + 1;
      return `${count} frame${count !== 1 ? "s" : ""}`;
    }
    return durationLabel(firstFrame, lastFrame, sourceFps);
  }

  const TH = ({ col, label }) => (
    <th
      onClick={() => toggleSort(col)}
      className="px-4 py-3 text-left text-[10px] text-slate-500 uppercase tracking-wider font-semibold cursor-pointer select-none hover:text-slate-300 transition-colors whitespace-nowrap"
    >
      {label}<SortIcon col={col} sortCol={sortCol} sortDir={sortDir} />
    </th>
  );

  const StaticTH = ({ label }) => (
    <th className="px-4 py-3 text-left text-[10px] text-slate-500 uppercase tracking-wider font-semibold whitespace-nowrap">
      {label}
    </th>
  );

  return (
    <div className="space-y-4">

      <Card className="p-4 flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
          <User size={20} className="text-cyan-400" />
        </div>
        <div>
          {hasResult
            ? <p className="text-3xl font-bold text-cyan-400">{personTracks.length}</p>
            : <div className="w-10 h-7 rounded bg-slate-800 mb-1" />}
          <p className="text-[11px] text-slate-500">unique persons detected</p>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 shrink-0">
            <User size={13} className="text-cyan-400" />
            <p className="text-xs font-semibold text-white">Detected Persons</p>
            {isImagesMode && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-400 border border-violet-500/20 font-medium">
                Images Mode
              </span>
            )}
          </div>

          <div className="relative flex-1 min-w-[140px] max-w-xs">
            <Search size={10} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(0); }}
              placeholder="Search by ID…"
              className="w-full bg-slate-800/60 border border-slate-700/40 rounded-lg pl-7 pr-3 py-1.5 text-[11px] text-slate-300 placeholder-slate-600 outline-none focus:border-blue-500/40 transition-colors"
            />
          </div>

          <span className="font-mono text-[10px] text-slate-600 shrink-0 ml-auto">
            {filtered.length} {filtered.length === 1 ? "person" : "persons"}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/40">
                <TH       col="track_id"    label="ID"                                              />
                <StaticTH                   label="Confidence"                                      />
                <TH       col="first_frame" label={isImagesMode ? "First Image" : "First Seen"}    />
                <TH       col="last_frame"  label={isImagesMode ? "Last Image"  : "Last Seen"}     />
                <TH       col="frame_count" label="Times Seen"                                      />
                <StaticTH                   label={isImagesMode ? "Across Images" : "When in Video"} />
                <TH       col="last_frame"  label={isImagesMode ? "Span" : "On Screen For"}        />
              </tr>
            </thead>
            <tbody>
              {hasResult ? pageRows.map((t, i) => {
                const conf      = confidenceLabel(t.conf_avg);
                const pres      = presenceLabel(t.frame_count, totalFrames);
                const framesPct = totalFrames > 0 ? Math.round((t.frame_count / totalFrames) * 100) : 0;

                return (
                  <tr
                    key={t.track_id}
                    className={`border-b border-slate-800/40 hover:bg-slate-800/25 transition-colors ${i % 2 === 0 ? "" : "bg-slate-900/20"}`}
                  >
                    <td className="px-4 py-3">
                      <span className="font-mono text-[11px] font-bold text-cyan-400">#{t.track_id}</span>
                    </td>

                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${conf.cls}`}>
                        {conf.label}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Film size={9} className="text-slate-600 shrink-0" />
                        <span className="font-mono text-[11px] text-slate-300">
                          {formatFrameLabel(t.first_frame)}
                        </span>
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Film size={9} className="text-slate-600 shrink-0" />
                        <span className="font-mono text-[11px] text-slate-300">
                          {formatFrameLabel(t.last_frame)}
                        </span>
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <span className="font-mono text-[11px] text-slate-300">
                        {t.frame_count}
                        {totalFrames > 0 && (
                          <span className="text-slate-600 ml-1">({framesPct}%)</span>
                        )}
                      </span>
                    </td>

                    <td className="px-4 py-3 min-w-[160px]">
                      <div className="space-y-1.5">
                        <AppearanceBar
                          firstFrame={t.first_frame}
                          lastFrame={t.last_frame}
                          totalFrames={totalFrames}
                        />
                        <p className="text-[10px] font-medium text-cyan-400">{pres}</p>
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Clock size={9} className="text-slate-600 shrink-0" />
                        <span className="font-mono text-[11px] text-slate-300">
                          {formatDuration(t.first_frame, t.last_frame) ?? "—"}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              }) : [...Array(8)].map((_, i) => (
                <tr key={i} className="border-b border-slate-800/40">
                  {[32, 48, 44, 44, 36, 140, 40].map((w, j) => (
                    <td key={j} className="px-4 py-3.5">
                      <div className="h-2 rounded bg-slate-800/80 animate-pulse" style={{ width: w }} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-3 border-t border-slate-800/50 flex items-center justify-between">
          {hasResult && pageCount > 1 ? (
            <>
              <span className="font-mono text-[11px] text-slate-600">
                Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
              </span>
              <div className="flex gap-1">
                <button
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="px-3 py-1 rounded text-[11px] bg-slate-800 text-slate-400 disabled:opacity-30 hover:bg-slate-700 transition-colors"
                >
                  ← Prev
                </button>
                <button
                  onClick={() => setPage(p => Math.min(pageCount - 1, p + 1))}
                  disabled={page === pageCount - 1}
                  className="px-3 py-1 rounded text-[11px] bg-slate-800 text-slate-400 disabled:opacity-30 hover:bg-slate-700 transition-colors"
                >
                  Next →
                </button>
              </div>
            </>
          ) : (
            <span className="font-mono text-[11px] text-slate-600">
              {hasResult ? `${filtered.length} persons detected` : "Awaiting analysis data"}
            </span>
          )}
        </div>
      </Card>
    </div>
  );
}