import { useState, useMemo } from "react";
import { Search, ChevronUp, ChevronDown, ChevronsUpDown, Clock, Film, User, Car, Package } from "lucide-react";

const CATEGORY_MAP = {
  person: "People",
  bicycle: "Vehicles", motorcycle: "Vehicles", car: "Vehicles",
  truck: "Vehicles", bus: "Vehicles", train: "Vehicles", boat: "Vehicles",
};

function categorize(cls) {
  return CATEGORY_MAP[cls?.toLowerCase()] ?? "Objects";
}

const CATEGORY_STYLE = {
  People:   { text: "text-cyan-400",   bar: "bg-cyan-500",   soft: "bg-cyan-500/10",   border: "border-cyan-500/30",   Icon: User    },
  Vehicles: { text: "text-amber-400",  bar: "bg-amber-500",  soft: "bg-amber-500/10",  border: "border-amber-500/30",  Icon: Car     },
  Objects:  { text: "text-violet-400", bar: "bg-violet-500", soft: "bg-violet-500/10", border: "border-violet-500/30", Icon: Package },
};

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

function AppearanceBar({ firstFrame, lastFrame, totalFrames, cat }) {
  const s = CATEGORY_STYLE[cat];
  if (!totalFrames) return null;
  const left  = (firstFrame / totalFrames) * 100;
  const width = Math.max(2, ((lastFrame - firstFrame) / totalFrames) * 100);
  return (
    <div className="relative h-1.5 bg-slate-800 rounded-full overflow-hidden w-full">
      <div
        className={`absolute top-0 h-full rounded-full ${s.bar} opacity-80`}
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
  const [search,    setSearch]    = useState("");
  const [filterCat, setFilterCat] = useState("All");
  const [sortCol,   setSortCol]   = useState("frame_count");
  const [sortDir,   setSortDir]   = useState("desc");
  const [page,      setPage]      = useState(0);
  const PAGE_SIZE = 12;

  const trackDetails = result?.track_details ?? [];
  const totalFrames  = result?.total_frames  ?? 0;
  const sourceFps    = result?.video_meta?.source_fps ?? 25;
  const hasResult    = !!result && trackDetails.length > 0;
  const totalUnique  = result?.total_unique_objects ?? trackDetails.length;

  const categoryCounts = useMemo(() => {
    const c = { People: 0, Vehicles: 0, Objects: 0 };
    trackDetails.forEach(t => { c[categorize(t.class)] += 1; });
    return c;
  }, [trackDetails]);

  const filtered = useMemo(() => {
    let rows = [...trackDetails];
    if (filterCat !== "All") rows = rows.filter(t => categorize(t.class) === filterCat);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter(t => String(t.track_id).includes(q) || t.class?.toLowerCase().includes(q));
    }
    rows.sort((a, b) => {
      const av = a[sortCol] ?? 0;
      const bv = b[sortCol] ?? 0;
      return sortDir === "asc" ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
    });
    return rows;
  }, [trackDetails, filterCat, search, sortCol, sortDir]);

  const pageCount = Math.ceil(filtered.length / PAGE_SIZE);
  const pageRows  = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  function toggleSort(col) {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("desc"); }
    setPage(0);
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

      <div className="grid grid-cols-3 gap-3">
        {["People", "Vehicles", "Objects"].map(cat => {
          const s      = CATEGORY_STYLE[cat];
          const count  = categoryCounts[cat];
          const pct    = totalUnique > 0 ? Math.round((count / totalUnique) * 100) : 0;
          const active = filterCat === cat;
          return (
            <Card
              key={cat}
              onClick={() => { setFilterCat(active ? "All" : cat); setPage(0); }}
              className={`p-4 cursor-pointer transition-all border ${active ? `${s.soft} ${s.border}` : "border-slate-700/40 hover:border-slate-600/60"}`}
            >
              <div className="flex items-center justify-between mb-3">
                <s.Icon size={14} className={s.text} />
                {active && (
                  <span className={`text-[9px] px-1.5 py-0.5 rounded ${s.soft} ${s.text} border ${s.border}`}>
                    Active
                  </span>
                )}
              </div>
              {hasResult
                ? <p className={`text-2xl font-bold ${s.text} mb-0.5`}>{count}</p>
                : <div className="w-10 h-7 rounded bg-slate-800 mb-1" />}
              <p className="text-[11px] text-slate-500 mb-3">detected</p>
              <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                <div className={`h-full ${s.bar} rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
              </div>
              {hasResult && <p className={`text-[10px] mt-1.5 font-mono ${s.text}`}>{pct}% of total</p>}
            </Card>
          );
        })}
      </div>

      <Card className="overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 shrink-0">
            <Film size={13} className="text-slate-500" />
            <p className="text-xs font-semibold text-white">Detected Objects</p>
          </div>

          <div className="relative flex-1 min-w-[140px] max-w-xs">
            <Search size={10} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(0); }}
              placeholder="Search by ID or type…"
              className="w-full bg-slate-800/60 border border-slate-700/40 rounded-lg pl-7 pr-3 py-1.5 text-[11px] text-slate-300 placeholder-slate-600 outline-none focus:border-blue-500/40 transition-colors"
            />
          </div>

          <div className="flex gap-1 ml-auto">
            {["All", "People", "Vehicles", "Objects"].map(cat => {
              const s = CATEGORY_STYLE[cat] ?? {};
              const active = filterCat === cat;
              return (
                <button
                  key={cat}
                  onClick={() => { setFilterCat(cat); setPage(0); }}
                  className={`px-2.5 py-1 rounded-md text-[10px] font-medium transition-colors border ${
                    active
                      ? `${s.soft ?? "bg-blue-500/10"} ${s.text ?? "text-blue-400"} ${s.border ?? "border-blue-500/30"}`
                      : "text-slate-500 border-transparent hover:text-slate-300"
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>

          <span className="font-mono text-[10px] text-slate-600 shrink-0">
            {filtered.length} {filtered.length === 1 ? "object" : "objects"}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/40">
                <TH       col="track_id"    label="ID"           />
                <TH       col="class"       label="Type"         />
                <StaticTH                   label="Confidence"   />
                <TH       col="first_frame" label="First Seen"   />
                <TH       col="last_frame"  label="Last Seen"    />
                <TH       col="frame_count" label="Times Seen"   />
                <StaticTH                   label="When in Video" />
                <TH       col="last_frame"  label="On Screen For" />
              </tr>
            </thead>
            <tbody>
              {hasResult ? pageRows.map((t, i) => {
                const cat   = categorize(t.class);
                const s     = CATEGORY_STYLE[cat];
                const conf  = confidenceLabel(t.conf_avg);
                const dur   = durationLabel(t.first_frame, t.last_frame, sourceFps);
                const pres  = presenceLabel(t.frame_count, totalFrames);
                const framesPct = totalFrames > 0 ? Math.round((t.frame_count / totalFrames) * 100) : 0;

                return (
                  <tr
                    key={t.track_id}
                    className={`border-b border-slate-800/40 hover:bg-slate-800/25 transition-colors ${i % 2 === 0 ? "" : "bg-slate-900/20"}`}
                  >
                    <td className="px-4 py-3">
                      <span className={`font-mono text-[11px] font-bold ${s.text}`}>#{t.track_id}</span>
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className={`inline-flex items-center justify-center w-4 h-4 rounded ${s.soft}`}>
                          <s.Icon size={10} className={s.text} />
                        </span>
                        <span className="text-[11px] text-slate-200 capitalize">{t.class}</span>
                      </div>
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
                          {toTimecode(t.first_frame, sourceFps)}
                        </span>
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Film size={9} className="text-slate-600 shrink-0" />
                        <span className="font-mono text-[11px] text-slate-300">
                          {toTimecode(t.last_frame, sourceFps)}
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
                          cat={cat}
                        />
                        <p className={`text-[10px] font-medium ${s.text}`}>{pres}</p>
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Clock size={9} className="text-slate-600 shrink-0" />
                        <span className="font-mono text-[11px] text-slate-300">{dur ?? "—"}</span>
                      </div>
                    </td>
                  </tr>
                );
              }) : [...Array(8)].map((_, i) => (
                <tr key={i} className="border-b border-slate-800/40">
                  {[32, 80, 48, 44, 44, 36, 140, 36, 40].map((w, j) => (
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
              {hasResult ? `${filtered.length} objects detected` : "Awaiting analysis data"}
            </span>
          )}
        </div>
      </Card>
    </div>
  );
}