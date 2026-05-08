import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import {
  User, Clock, Film, Activity, ChevronLeft, ChevronRight,
  Play, Pause, ChevronsLeft, ChevronsRight, Search,
  Eye, TrendingUp, LayoutGrid, X, ZoomIn,
} from "lucide-react";
import { API_BASE } from "../../api/client";

const PERSON_CLASSES = ["person", "pedestrian"];
const PERSONS_PER_PAGE = 6;

function isPerson(cls) {
  return PERSON_CLASSES.includes(cls?.toLowerCase());
}

function toTime(frame, fps) {
  if (!fps) return `#${frame}`;
  const s = frame / fps;
  if (s < 60) return `${s.toFixed(1)}s`;
  return `${Math.floor(s / 60)}m${Math.round(s % 60).toString().padStart(2, "0")}s`;
}

function getFrameImageUrl(jobId, frameIdx) {
  return `${API_BASE}/outputs/${jobId}/annotated_frames/frame_${String(frameIdx).padStart(6, "0")}_annotated.jpg`;
}

function FrameImage({ src, alt, className = "" }) {
  const [err, setErr]       = useState(false);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => { setErr(false); setLoaded(false); }, [src]);

  if (err) {
    return (
      <div className={`flex flex-col items-center justify-center bg-slate-900 border border-slate-800 rounded-xl ${className}`}>
        <Film size={20} className="text-slate-700 mb-1" />
        <p className="text-[10px] text-slate-600 font-mono">No image</p>
      </div>
    );
  }
  return (
    <div className={`relative ${className}`}>
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900 rounded-xl">
          <div className="w-5 h-5 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
        </div>
      )}
      <img
        src={src} alt={alt}
        onLoad={() => setLoaded(true)}
        onError={() => setErr(true)}
        className={`w-full h-full object-contain rounded-xl transition-opacity duration-200 ${loaded ? "opacity-100" : "opacity-0"}`}
      />
    </div>
  );
}

function PersonZoomPopup({ person, frameImageUrl, onClose }) {
  const canvasRef = useRef(null);
  const [cropDataUrl, setCropDataUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!frameImageUrl) { setError(true); setLoading(false); return; }
    setLoading(true);
    setError(false);
    setCropDataUrl(null);

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const cx = person.last_centroid?.x;
      const cy = person.last_centroid?.y;
      if (cx == null || cy == null) {
        setCropDataUrl(frameImageUrl);
        setLoading(false);
        return;
      }

      const area   = person.avg_box_area_px2 ?? 10000;
      const aspect = 0.45;
      const bh     = Math.sqrt(area / aspect);
      const bw     = area / bh;
      const PAD    = Math.max(20, bw * 0.3);

      const x1 = Math.max(0, cx - bw / 2 - PAD);
      const y1 = Math.max(0, cy - bh / 2 - PAD);
      const x2 = Math.min(img.naturalWidth,  cx + bw / 2 + PAD);
      const y2 = Math.min(img.naturalHeight, cy + bh / 2 + PAD);
      const cw = x2 - x1;
      const ch = y2 - y1;

      const canvas = document.createElement("canvas");
      canvas.width  = cw;
      canvas.height = ch;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, x1, y1, cw, ch, 0, 0, cw, ch);

      ctx.strokeStyle = "#22d3ee";
      ctx.lineWidth   = 2;
      ctx.strokeRect(cx - bw / 2 - x1, cy - bh / 2 - y1, bw, bh);

      setCropDataUrl(canvas.toDataURL("image/jpeg", 0.92));
      setLoading(false);
    };
    img.onerror = () => { setError(true); setLoading(false); };
    img.src = frameImageUrl;
  }, [person, frameImageUrl]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative bg-slate-900 border border-cyan-500/30 rounded-2xl shadow-2xl shadow-cyan-900/40 p-4 max-w-sm w-full mx-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <User size={12} className="text-cyan-400" />
            <span className="font-mono text-xs font-bold text-cyan-400">Person #{person.track_id}</span>
            {person.dominant_pose && person.dominant_pose !== "unknown" && (
              <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-emerald-400 border border-emerald-500/20">
                {person.dominant_pose}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X size={12} />
          </button>
        </div>

        <div className="rounded-xl overflow-hidden bg-slate-950 border border-slate-800 min-h-[160px] flex items-center justify-center">
          {loading && (
            <div className="flex flex-col items-center gap-2">
              <div className="w-6 h-6 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
              <p className="text-[10px] text-slate-600 font-mono">Cropping…</p>
            </div>
          )}
          {error && (
            <div className="flex flex-col items-center gap-1">
              <Film size={20} className="text-slate-700" />
              <p className="text-[10px] text-slate-600 font-mono">No image available</p>
            </div>
          )}
          {!loading && !error && cropDataUrl && (
            <img src={cropDataUrl} alt={`Person #${person.track_id}`} className="w-full h-full object-contain rounded-xl" />
          )}
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          {[
            { label: "Confidence", val: `${Math.round(person.conf_avg * 100)}%`, accent: "text-cyan-400" },
            { label: "Travel",     val: `${Math.round(person.travel_px ?? 0)}px`, accent: "text-purple-400" },
            { label: "Frames",     val: `${(person.last_frame ?? 0) - (person.first_frame ?? 0)}`, accent: "text-amber-400" },
          ].map(({ label, val, accent }) => (
            <div key={label} className="bg-slate-800/60 rounded-lg px-2 py-1.5 text-center">
              <p className="text-[8px] text-slate-500 mb-0.5">{label}</p>
              <p className={`font-mono text-[11px] font-bold ${accent}`}>{val}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ScrubBar({ frames, currentIdx, onSeek, personCounts }) {
  const ref = useRef(null);

  const seek = useCallback((e) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const pct  = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    onSeek(Math.round(pct * (frames.length - 1)));
  }, [frames.length, onSeek]);

  const onMouseMove = useCallback((e) => { if (e.buttons === 1) seek(e); }, [seek]);
  const maxCount = useMemo(() => Math.max(...personCounts, 1), [personCounts]);

  return (
    <div
      ref={ref}
      className="relative h-10 w-full cursor-crosshair select-none rounded-lg overflow-hidden bg-slate-900 border border-slate-800"
      onClick={seek}
      onMouseMove={onMouseMove}
    >
      <div className="absolute inset-0 flex items-end gap-px px-0.5 pb-0.5">
        {frames.map((f, i) => {
          const h      = Math.max(3, Math.round((personCounts[i] / maxCount) * 30));
          const active = i === currentIdx;
          return (
            <div
              key={i}
              className={`flex-1 rounded-sm transition-colors ${
                active ? "bg-cyan-400" : personCounts[i] > 0 ? "bg-cyan-500/35 hover:bg-cyan-500/60" : "bg-slate-800 hover:bg-slate-700"
              }`}
              style={{ height: Math.max(3, h) }}
            />
          );
        })}
      </div>
      <div
        className="absolute top-0 bottom-0 w-0.5 bg-cyan-400 pointer-events-none"
        style={{ left: `${(currentIdx / Math.max(frames.length - 1, 1)) * 100}%` }}
      />
    </div>
  );
}

function PersonsPanel({ persons, Card, frameImageUrl }) {
  const [page, setPage] = useState(0);
  const [zoomedPerson, setZoomedPerson] = useState(null);
  useEffect(() => { setPage(0); }, [persons.length]);

  const totalPages = Math.ceil(persons.length / PERSONS_PER_PAGE);
  const pageItems  = persons.slice(page * PERSONS_PER_PAGE, (page + 1) * PERSONS_PER_PAGE);

  return (
    <>
      <Card className="p-3 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <User size={11} className="text-cyan-400" />
            <p className="text-[11px] font-semibold text-white">Persons in Frame</p>
          </div>
          <span className="font-mono text-[10px] text-slate-500">{persons.length}</span>
        </div>

        {persons.length === 0 ? (
          <p className="text-[11px] text-slate-600 italic text-center py-3">No persons detected</p>
        ) : (
          <>
            <div className="space-y-1">
              {pageItems.map(t => (
                <button
                  key={t.track_id}
                  onClick={() => setZoomedPerson(t)}
                  className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg bg-cyan-500/8 border border-cyan-500/15 hover:bg-cyan-500/15 hover:border-cyan-500/30 transition-all group cursor-pointer"
                  title="Click to zoom"
                >
                  <div className="flex items-center gap-1.5">
                    <User size={9} className="text-cyan-400" />
                    <span className="font-mono text-[10px] font-bold text-cyan-400">#{t.track_id}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {t.dominant_pose && t.dominant_pose !== "unknown" && (
                      <span className="font-mono text-[9px] px-1 py-0.5 rounded bg-slate-800 text-emerald-400 border border-emerald-500/20">
                        {t.dominant_pose}
                      </span>
                    )}
                    <span className="font-mono text-[9px] text-slate-500">{Math.round(t.conf_avg * 100)}%</span>
                    <span className="font-mono text-[9px] text-slate-600">{Math.round(t.travel_px ?? 0)}px</span>
                    <ZoomIn size={8} className="text-slate-600 group-hover:text-cyan-400 transition-colors" />
                  </div>
                </button>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-1">
                <button
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="p-1 rounded text-slate-500 hover:text-slate-300 disabled:opacity-30 transition-colors"
                >
                  <ChevronLeft size={11} />
                </button>
                <span className="font-mono text-[9px] text-slate-600">{page + 1} / {totalPages}</span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={page === totalPages - 1}
                  className="p-1 rounded text-slate-500 hover:text-slate-300 disabled:opacity-30 transition-colors"
                >
                  <ChevronRight size={11} />
                </button>
              </div>
            )}
          </>
        )}
      </Card>

      {zoomedPerson && (
        <PersonZoomPopup
          person={zoomedPerson}
          frameImageUrl={frameImageUrl}
          onClose={() => setZoomedPerson(null)}
        />
      )}
    </>
  );
}

function FrameStrip({ frames, currentIdx, onSelect, jobId, personCounts, visible = 6 }) {
  const half  = Math.floor(visible / 2);
  const start = Math.max(0, Math.min(currentIdx - half, frames.length - visible));
  const slice = frames.slice(start, Math.min(frames.length, start + visible));

  return (
    <div className="flex gap-1.5">
      {slice.map((f, i) => {
        const realIdx = start + i;
        const active  = realIdx === currentIdx;
        const imgUrl  = jobId ? getFrameImageUrl(jobId, f.frame) : null;
        const pCount  = personCounts[realIdx] ?? 0;
        return (
          <button
            key={realIdx}
            onClick={() => onSelect(realIdx)}
            className={`relative flex-1 aspect-video rounded-lg overflow-hidden border-2 transition-all
              ${active ? "border-cyan-500 shadow-md shadow-cyan-900/50 scale-[1.03]" : "border-slate-700 hover:border-slate-500 opacity-55 hover:opacity-100"}`}
          >
            {imgUrl
              ? <FrameImage src={imgUrl} alt={`f${f.frame}`} className="w-full h-full bg-slate-950" />
              : <div className="w-full h-full bg-slate-900 flex items-center justify-center"><Film size={10} className="text-slate-700" /></div>
            }
            <div className="absolute bottom-0 left-0 right-0 bg-black/70 px-1 py-0.5 flex justify-between">
              <span className="text-[7px] font-mono text-slate-400">#{f.frame}</span>
              <span className="text-[7px] font-mono text-cyan-400">{pCount}</span>
            </div>
            {active && <div className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-cyan-400" />}
          </button>
        );
      })}
    </div>
  );
}

export default function TimelineTab({ Card, PlaceholderBox, result }) {
  console.log(result);
  const richStats    = result?.rich_stats ?? {};
  const perfLog      = richStats.performance_log ?? result?.performance_log ?? [];
  const trackDetails = result?.track_details ?? richStats.track_details ?? [];
  const videoMeta    = richStats.video_meta ?? result?.video_meta ?? {};
  const sourceFps    = videoMeta.source_fps ?? 25;
  const duration     = videoMeta.duration_s ?? 0;
  const jobId        = result?.job_id ?? null;
  const hasResult    = !!result && perfLog.length > 0;

  const personTracks = useMemo(() => trackDetails.filter(t => isPerson(t.class)), [trackDetails]);

  const [currentIdx,   setCurrentIdx]   = useState(0);
  const [playing,      setPlaying]      = useState(false);
  const [playSpeed,    setPlaySpeed]    = useState(4);
  const [searchQuery,  setSearchQuery]  = useState("");
  const [showStrip,    setShowStrip]    = useState(false);
  const playRef = useRef(null);

  const frames = useMemo(() => perfLog, [perfLog]);

  const filteredFrames = useMemo(() => {
    if (!searchQuery.trim()) return frames;
    const q = searchQuery.toLowerCase();
    return frames.filter(f =>
      personTracks
        .filter(t => t.first_frame <= f.frame && t.last_frame >= f.frame)
        .some(t => String(t.track_id).includes(q))
    );
  }, [frames, searchQuery, personTracks]);

  const personCountsPerFrame = useMemo(() =>
    filteredFrames.map(f => personTracks.filter(t => t.first_frame <= f.frame && t.last_frame >= f.frame).length),
    [filteredFrames, personTracks]
  );

  const currentFrame = filteredFrames[currentIdx] ?? null;

  const currentPersons = useMemo(() => {
    if (!currentFrame) return [];
    return personTracks.filter(t => t.first_frame <= currentFrame.frame && t.last_frame >= currentFrame.frame);
  }, [currentFrame, personTracks]);

  useEffect(() => { setCurrentIdx(0); }, [searchQuery]);

  useEffect(() => {
    if (!playing) { clearInterval(playRef.current); return; }
    playRef.current = setInterval(() => {
      setCurrentIdx(i => {
        if (i >= filteredFrames.length - 1) { setPlaying(false); return i; }
        return i + 1;
      });
    }, 1000 / playSpeed);
    return () => clearInterval(playRef.current);
  }, [playing, playSpeed, filteredFrames.length]);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === "ArrowRight") setCurrentIdx(i => Math.min(i + 1, filteredFrames.length - 1));
      if (e.key === "ArrowLeft")  setCurrentIdx(i => Math.max(i - 1, 0));
      if (e.key === " ")          { e.preventDefault(); setPlaying(p => !p); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [filteredFrames.length]);

  if (!hasResult) {
    return (
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <User size={13} className="text-slate-600" />
          <p className="text-xs font-semibold text-slate-500">Person Timeline</p>
        </div>
        <PlaceholderBox h="h-48" />
        <p className="text-[11px] text-slate-600 mt-3 italic text-center">Timeline available after analysis</p>
      </Card>
    );
  }

  const frameImageUrl = jobId && currentFrame ? getFrameImageUrl(jobId, currentFrame.frame) : null;

  return (
    <div className="flex gap-3" style={{ minHeight: 0 }}>
      <div className="flex-1 min-w-0 flex flex-col gap-2">
        <Card className="overflow-hidden p-0">
          {frameImageUrl ? (
            <div className="relative bg-black">
              <FrameImage
                src={frameImageUrl}
                alt={`Frame ${currentFrame.frame}`}
                className="w-full bg-slate-950"
                style={{ maxHeight: 340 }}
              />
              <div className="absolute top-2 left-2 flex gap-1.5">
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-black/75 border border-slate-700 text-blue-400">
                  #{currentFrame?.frame}
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/75 border border-slate-700 text-slate-300">
                  {toTime(currentFrame?.frame, sourceFps)}
                </span>
              </div>
              <div className="absolute top-2 right-2">
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-black/75 border border-cyan-500/40 text-cyan-400">
                  <User size={8} className="inline mr-1" />{currentPersons.length}
                </span>
              </div>
              <div className="absolute bottom-2 right-2 flex gap-1.5">
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/75 border border-slate-700 text-slate-400">
                  {currentFrame?.inference_ms}ms
                </span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center bg-slate-900 rounded-xl gap-2 py-16">
              <Film size={28} className="text-slate-700" />
              <p className="text-[11px] text-slate-600">Frame images not available</p>
            </div>
          )}
        </Card>

        <Card className="p-2.5">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex items-center gap-0.5">
              <button onClick={() => setCurrentIdx(0)} className="p-1.5 rounded text-slate-500 hover:text-white hover:bg-slate-800 transition-colors">
                <ChevronsLeft size={12} />
              </button>
              <button onClick={() => setCurrentIdx(i => Math.max(0, i - 1))} className="p-1.5 rounded text-slate-500 hover:text-white hover:bg-slate-800 transition-colors">
                <ChevronLeft size={12} />
              </button>
              <button onClick={() => setPlaying(p => !p)} className="p-1.5 rounded bg-cyan-600 hover:bg-cyan-500 text-white transition-colors mx-0.5">
                {playing ? <Pause size={12} /> : <Play size={12} />}
              </button>
              <button onClick={() => setCurrentIdx(i => Math.min(i + 1, filteredFrames.length - 1))} className="p-1.5 rounded text-slate-500 hover:text-white hover:bg-slate-800 transition-colors">
                <ChevronRight size={12} />
              </button>
              <button onClick={() => setCurrentIdx(filteredFrames.length - 1)} className="p-1.5 rounded text-slate-500 hover:text-white hover:bg-slate-800 transition-colors">
                <ChevronsRight size={12} />
              </button>
            </div>

            <div className="flex items-center gap-1">
              {[1, 2, 4, 8].map(s => (
                <button
                  key={s}
                  onClick={() => setPlaySpeed(s)}
                  className={`px-1.5 py-0.5 rounded text-[9px] font-mono transition-colors ${
                    playSpeed === s ? "bg-cyan-600 text-white" : "text-slate-600 hover:text-slate-300"
                  }`}
                >
                  {s}×
                </button>
              ))}
            </div>

            <div className="ml-auto flex items-center gap-2">
              <span className="font-mono text-[10px] text-slate-600">
                {currentIdx + 1} / {filteredFrames.length}
              </span>
              <span className="font-mono text-[10px] text-slate-500">
                {toTime(currentFrame?.frame, sourceFps)}
              </span>
              <button
                onClick={() => setShowStrip(s => !s)}
                title="Toggle filmstrip"
                className={`p-1.5 rounded border transition-colors ${
                  showStrip ? "bg-slate-700 border-slate-600 text-slate-200" : "border-slate-700/40 text-slate-600 hover:text-slate-400"
                }`}
              >
                <LayoutGrid size={11} />
              </button>
            </div>
          </div>

          <ScrubBar
            frames={filteredFrames}
            currentIdx={currentIdx}
            onSeek={setCurrentIdx}
            personCounts={personCountsPerFrame}
          />

          <p className="text-[9px] text-slate-700 font-mono mt-1 text-center">
            ← → to navigate · Space to play/pause
          </p>
        </Card>

        {showStrip && (
          <FrameStrip
            frames={filteredFrames}
            currentIdx={currentIdx}
            onSelect={setCurrentIdx}
            jobId={jobId}
            personCounts={personCountsPerFrame}
            visible={6}
          />
        )}
      </div>

      <div className="w-52 flex-shrink-0 flex flex-col gap-2">
        <div className="flex items-center gap-1.5 mb-0.5">
          <User size={11} className="text-cyan-400" />
          <p className="text-[10px] font-semibold text-white uppercase tracking-widest">Person Timeline</p>
        </div>

        <div className="relative">
          <Search size={9} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Filter by ID…"
            className="w-full bg-slate-800/60 border border-slate-700/40 rounded-lg pl-5 pr-2 py-1 text-[10px] text-slate-300 placeholder-slate-600 outline-none focus:border-cyan-500/40"
          />
        </div>

        <PersonsPanel persons={currentPersons} Card={Card} frameImageUrl={frameImageUrl} />

        <Card className="p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <Activity size={10} className="text-slate-500" />
            <p className="text-[10px] font-semibold text-white">Frame Stats</p>
          </div>
          <div className="space-y-1.5">
            {[
              { label: "Frame",    val: `#${currentFrame?.frame ?? "—"}`,           accent: "text-blue-400"   },
              { label: "Time",     val: toTime(currentFrame?.frame, sourceFps),      accent: "text-slate-300"  },
              { label: "Persons",  val: currentPersons.length,                       accent: "text-cyan-400"   },
              { label: "All dets", val: currentFrame?.detections ?? "—",             accent: "text-slate-400"  },
              { label: "Infer",    val: `${currentFrame?.inference_ms ?? "—"}ms`,   accent: "text-amber-400"  },
              { label: "Tracked",  val: currentFrame?.unique_so_far ?? "—",          accent: "text-purple-400" },
              { label: "Pose",     val: currentPersons[0]?.dominant_pose ?? "—",         accent: "text-emerald-400" },
            ].map(({ label, val, accent }) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-[10px] text-slate-500">{label}</span>
                <span className={`font-mono text-[10px] font-semibold ${accent}`}>{val}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-0 overflow-hidden flex-1">
          <div className="px-3 py-2 border-b border-slate-800 flex items-center justify-between">
            <p className="text-[10px] font-semibold text-white">Event Log</p>
            <span className="font-mono text-[9px] text-slate-600">{filteredFrames.length}</span>
          </div>
          <div className="overflow-y-auto" style={{ maxHeight: 220 }}>
            {filteredFrames.slice(0, 100).map((f, i) => {
              const active  = i === currentIdx;
              const pCount  = personCountsPerFrame[i] ?? 0;
              return (
                <button
                  key={i}
                  onClick={() => setCurrentIdx(i)}
                  className={`w-full px-3 py-1.5 flex items-center gap-2 text-left transition-colors border-l-2
                    ${active ? "bg-cyan-500/10 border-cyan-500" : "hover:bg-slate-800/30 border-transparent"}`}
                >
                  <span className="font-mono text-[9px] text-slate-500 w-10 shrink-0">{toTime(f.frame, sourceFps)}</span>
                  <span className={`font-mono text-[9px] font-bold ${pCount > 0 ? "text-cyan-400" : "text-slate-600"}`}>
                    <User size={7} className="inline mr-0.5" />{pCount}
                  </span>
                  {active && <div className="ml-auto w-1 h-1 rounded-full bg-cyan-400" />}
                </button>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}