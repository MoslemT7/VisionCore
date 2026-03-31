import { useState, useMemo } from "react";
import { User, Car, Package, Clock, Film, Activity, ChevronLeft, ChevronRight } from "lucide-react";

const CATEGORY_MAP = {
  person: "People",
  bicycle: "Vehicles", motorcycle: "Vehicles", car: "Vehicles",
  truck: "Vehicles", bus: "Vehicles", train: "Vehicles", boat: "Vehicles",
};

function categorize(cls) {
  return CATEGORY_MAP[cls?.toLowerCase()] ?? "Objects";
}

const CAT_STYLE = {
  People:   { text: "text-cyan-400",   bar: "bg-cyan-500",   soft: "bg-cyan-500/10",   dot: "bg-cyan-400",   Icon: User    },
  Vehicles: { text: "text-amber-400",  bar: "bg-amber-500",  soft: "bg-amber-500/10",  dot: "bg-amber-400",  Icon: Car     },
  Objects:  { text: "text-violet-400", bar: "bg-violet-500", soft: "bg-violet-500/10", dot: "bg-violet-400", Icon: Package },
};

function toTime(frame, fps) {
  if (!fps) return `#${frame}`;
  const s = frame / fps;
  if (s < 60) return `${s.toFixed(1)}s`;
  return `${Math.floor(s / 60)}m${Math.round(s % 60).toString().padStart(2, "0")}s`;
}

function toSeconds(frame, fps) {
  return fps ? frame / fps : frame;
}

export default function TimelineTab({ Card, PlaceholderBox, result }) {
  const [cursor, setCursor] = useState(null);
  const [visibleCats, setVisibleCats] = useState(new Set(["People", "Vehicles", "Objects"]));

  const trackDetails   = result?.track_details   ?? [];
  const perfLog        = result?.performance_log ?? [];
  const totalFrames    = result?.total_frames    ?? 0;
  const sourceFps      = result?.video_meta?.source_fps ?? 25;
  const duration       = result?.video_meta?.duration_s ?? 0;
  const hasResult      = !!result && (trackDetails.length > 0 || perfLog.length > 0);

  function toggleCat(cat) {
    setVisibleCats(prev => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  }

  const classes = useMemo(() => {
    const seen = new Map();
    trackDetails.forEach(t => {
      if (!seen.has(t.class)) seen.set(t.class, categorize(t.class));
    });
    return Array.from(seen.entries())
      .filter(([, cat]) => visibleCats.has(cat))
      .sort((a, b) => a[0].localeCompare(b[0]));
  }, [trackDetails, visibleCats]);

  const activeAtCursor = useMemo(() => {
    if (cursor === null || !totalFrames) return [];
    const cursorFrame = (cursor / 100) * totalFrames;
    return trackDetails.filter(t =>
      t.first_frame <= cursorFrame && t.last_frame >= cursorFrame &&
      visibleCats.has(categorize(t.class))
    );
  }, [cursor, trackDetails, totalFrames, visibleCats]);

  const eventLog = useMemo(() => {
    if (!trackDetails.length) return [];
    const events = [];
    trackDetails.forEach(t => {
      events.push({
        type: "appeared",
        track_id: t.track_id,
        cls: t.class,
        cat: categorize(t.class),
        frame: t.first_frame,
        time: toSeconds(t.first_frame, sourceFps),
      });
      if (t.last_frame !== t.first_frame) {
        events.push({
          type: "left",
          track_id: t.track_id,
          cls: t.class,
          cat: categorize(t.class),
          frame: t.last_frame,
          time: toSeconds(t.last_frame, sourceFps),
        });
      }
    });
    return events
      .filter(e => visibleCats.has(e.cat))
      .sort((a, b) => a.time - b.time);
  }, [trackDetails, sourceFps, visibleCats]);

  const SWIMLANE_H = 18;
  const TOTAL_H    = Math.max(80, classes.length * (SWIMLANE_H + 8) + 40);

  return (
    <div className="space-y-4">

      <div className="flex gap-2 flex-wrap">
        {["People", "Vehicles", "Objects"].map(cat => {
          const s      = CAT_STYLE[cat];
          const active = visibleCats.has(cat);
          return (
            <button
              key={cat}
              onClick={() => toggleCat(cat)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium border transition-all ${
                active
                  ? `${s.soft} ${s.text} border-current/30`
                  : "bg-transparent text-slate-600 border-slate-800 hover:text-slate-400"
              }`}
            >
              <s.Icon size={11} />
              {cat}
            </button>
          );
        })}
      </div>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs font-semibold text-white">Object Timeline</p>
          <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-mono">
            <Clock size={10} />
            {hasResult ? `${duration}s total` : "—"}
          </div>
        </div>
        <p className="text-[11px] text-slate-500 mb-4">When each object was present in the video</p>

        {hasResult && classes.length > 0 ? (
          <div className="space-y-1">
            <div
              className="relative w-full select-none"
              style={{ height: TOTAL_H }}
              onMouseMove={e => {
                const rect = e.currentTarget.getBoundingClientRect();
                setCursor(Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100)));
              }}
              onMouseLeave={() => setCursor(null)}
            >
              {[0, 25, 50, 75, 100].map(pct => (
                <div
                  key={pct}
                  className="absolute top-0 bottom-0 border-l border-slate-800/60"
                  style={{ left: `${pct}%` }}
                >
                  <span className="absolute bottom-0 text-[9px] text-slate-600 font-mono translate-x-1">
                    {pct === 0 ? "0s" : pct === 100 ? `${duration}s` : `${((pct / 100) * duration).toFixed(0)}s`}
                  </span>
                </div>
              ))}

              {classes.map(([cls, cat], idx) => {
                const s      = CAT_STYLE[cat];
                const tracks = trackDetails.filter(t => t.class === cls && visibleCats.has(cat));
                const y      = idx * (SWIMLANE_H + 8);
                return (
                  <div key={cls} className="absolute w-full" style={{ top: y }}>
                    <div
                      className="absolute left-0 flex items-center"
                      style={{ width: 72, height: SWIMLANE_H }}
                    >
                      <span className={`text-[10px] font-medium capitalize ${s.text} truncate`}>{cls}</span>
                    </div>
                    <div
                      className="absolute bg-slate-800/40 rounded"
                      style={{ left: 76, right: 0, height: SWIMLANE_H }}
                    >
                      {tracks.map(t => {
                        const left  = (t.first_frame / Math.max(totalFrames, 1)) * 100;
                        const width = Math.max(0.5, ((t.last_frame - t.first_frame) / Math.max(totalFrames, 1)) * 100);
                        return (
                          <div
                            key={t.track_id}
                            title={`#${t.track_id} ${cls} — ${toTime(t.first_frame, sourceFps)} to ${toTime(t.last_frame, sourceFps)}`}
                            className={`absolute top-1 bottom-1 rounded-sm ${s.bar} opacity-75 hover:opacity-100 transition-opacity cursor-pointer`}
                            style={{ left: `${left}%`, width: `${width}%` }}
                          />
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {cursor !== null && (
                <div
                  className="absolute top-0 bottom-0 w-px bg-blue-400/60 pointer-events-none"
                  style={{ left: `calc(${cursor}% * (100% - 76px) / 100% + 76px)` }}
                >
                  <div className="absolute -top-5 left-1 bg-blue-500/20 border border-blue-500/30 rounded px-1.5 py-0.5 text-[9px] text-blue-400 font-mono whitespace-nowrap">
                    {((cursor / 100) * duration).toFixed(1)}s
                    {activeAtCursor.length > 0 && ` · ${activeAtCursor.length} object${activeAtCursor.length > 1 ? "s" : ""}`}
                  </div>
                </div>
              )}
            </div>

            {cursor !== null && activeAtCursor.length > 0 && (
              <div className="mt-3 pt-3 border-t border-slate-800/60 flex flex-wrap gap-1.5">
                {activeAtCursor.map(t => {
                  const s = CAT_STYLE[categorize(t.class)];
                  return (
                    <span key={t.track_id} className={`text-[10px] px-2 py-0.5 rounded-full ${s.soft} ${s.text} font-mono`}>
                      #{t.track_id} {t.class}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <PlaceholderBox h="h-32" className="flex items-center justify-center">
            <div className="text-center space-y-1">
              <Activity size={18} className="text-slate-600 mx-auto" />
              <p className="text-xs text-slate-600">Timeline available after analysis</p>
            </div>
          </PlaceholderBox>
        )}
      </Card>

      {hasResult && perfLog.length > 0 && (
        <Card className="p-4">
          <p className="text-xs font-semibold text-white mb-1">Detection Density</p>
          <p className="text-[11px] text-slate-500 mb-3">Objects detected per sampled frame</p>
          <div className="flex items-end gap-px h-16">
            {perfLog.map((entry, i) => {
              const maxD = Math.max(...perfLog.map(e => e.detections), 1);
              const h    = Math.max(4, Math.round((entry.detections / maxD) * 64));
              return (
                <div
                  key={i}
                  title={`Frame ${entry.frame}: ${entry.detections} detections, ${entry.inference_ms}ms`}
                  className="flex-1 bg-blue-500/40 hover:bg-blue-500/70 rounded-sm transition-colors cursor-default"
                  style={{ height: h }}
                />
              );
            })}
          </div>
          <div className="flex justify-between mt-1 text-[9px] text-slate-600 font-mono">
            <span>0s</span>
            <span>{duration}s</span>
          </div>
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <p className="text-xs font-semibold text-white">Event Log</p>
          <span className="font-mono text-[10px] text-slate-600">{eventLog.length} events</span>
        </div>

        <div className="divide-y divide-slate-800/40 max-h-80 overflow-y-auto">
          {hasResult && eventLog.length > 0 ? eventLog.map((ev, i) => {
            const s        = CAT_STYLE[ev.cat];
            const appeared = ev.type === "appeared";
            return (
              <div key={i} className="px-4 py-2.5 flex items-center gap-3 hover:bg-slate-800/20 transition-colors">
                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${appeared ? s.dot : "bg-slate-600"}`} />
                <span className="font-mono text-[10px] text-slate-500 w-12 shrink-0">
                  {toTime(ev.frame, sourceFps)}
                </span>
                <div className="flex-1 flex items-center gap-2">
                  <s.Icon size={10} className={s.text} />
                  <span className="text-[11px] text-slate-300 capitalize">{ev.cls}</span>
                  <span className="font-mono text-[10px] text-slate-600">#{ev.track_id}</span>
                </div>
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                  appeared ? `${s.soft} ${s.text}` : "bg-slate-800 text-slate-500"
                }`}>
                  {appeared ? "appeared" : "left"}
                </span>
              </div>
            );
          }) : [...Array(5)].map((_, i) => (
            <div key={i} className="px-4 py-3 flex items-center gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-slate-700 flex-shrink-0" />
              <div className="w-10 h-2 rounded bg-slate-800 animate-pulse" />
              <div className="flex-1 h-2.5 rounded bg-slate-800 animate-pulse w-48" />
              <div className="w-14 h-4 rounded-full bg-slate-800 animate-pulse" />
            </div>
          ))}
        </div>

        <div className="px-4 py-2.5 border-t border-slate-800/50 font-mono text-[11px] text-slate-600">
          {hasResult ? `${eventLog.length} total events across ${duration}s` : "Awaiting backend data"}
        </div>
      </Card>
    </div>
  );
}