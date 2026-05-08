import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Settings, Palette, Sliders, Cpu, Save, RotateCcw,
  ChevronDown, ChevronUp, Check, AlertTriangle, Loader2,
  Moon, Sun, Zap, Database, Film, Eye,
  Activity, Server, MessageSquare, Info, PersonStanding,
} from "lucide-react";
import { settingsApi } from "../api/settingsApi";

const ACCENT_COLORS = [
  { id: "blue",    bg: "bg-blue-500",    ring: "ring-blue-500"    },
  { id: "cyan",    bg: "bg-cyan-500",    ring: "ring-cyan-500"    },
  { id: "violet",  bg: "bg-violet-500",  ring: "ring-violet-500"  },
  { id: "emerald", bg: "bg-emerald-500", ring: "ring-emerald-500" },
  { id: "rose",    bg: "bg-rose-500",    ring: "ring-rose-500"    },
  { id: "amber",   bg: "bg-amber-500",   ring: "ring-amber-500"   },
];

function Toggle({ value, onChange }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={`relative w-9 h-5 rounded-full transition-colors duration-200 flex-shrink-0 ${value ? "bg-blue-600" : "bg-slate-700"}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${value ? "translate-x-4" : "translate-x-0"}`} />
    </button>
  );
}

function SliderInput({ value, onChange, min, max, step = 1, unit = "" }) {
  return (
    <div className="flex items-center gap-3 w-52">
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="flex-1 h-1.5 rounded-full appearance-none bg-slate-700 accent-blue-500 cursor-pointer"
      />
      <span className="font-mono text-[11px] text-slate-300 w-16 text-right shrink-0">{value}{unit}</span>
    </div>
  );
}

function NumberInput({ value, onChange, min, max, step = 1 }) {
  return (
    <input
      type="number" value={value} min={min} max={max} step={step}
      onChange={e => onChange(Number(e.target.value))}
      className="w-24 bg-slate-800 border border-slate-700/60 rounded-lg px-2.5 py-1.5 text-[11px] font-mono text-slate-200 outline-none focus:border-blue-500/60 transition-colors text-right"
    />
  );
}

function SelectInput({ value, onChange, options }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="bg-slate-800 border border-slate-700/60 rounded-lg px-2.5 py-1.5 text-[11px] font-mono text-slate-200 outline-none focus:border-blue-500/60 transition-colors"
    >
      {options.map(o => (
        <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>
      ))}
    </select>
  );
}

function Row({ label, description, children, indent }) {
  return (
    <div className={`flex items-center justify-between gap-4 py-3 border-b border-slate-800/50 last:border-0 ${indent ? "pl-3 border-l border-slate-800/40" : ""}`}>
      <div className="min-w-0">
        <p className="text-[12px] font-medium text-slate-200">{label}</p>
        {description && <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">{description}</p>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

function Sub({ title }) {
  return <p className="text-[9px] font-bold uppercase tracking-widest text-slate-600 mt-5 mb-1">{title}</p>;
}

function Section({ icon: Icon, title, accent = "text-blue-400", children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-800/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700/50 flex items-center justify-center">
            <Icon size={13} className={accent} />
          </div>
          <p className="text-sm font-semibold text-white">{title}</p>
        </div>
        {open ? <ChevronUp size={14} className="text-slate-500" /> : <ChevronDown size={14} className="text-slate-500" />}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 border-t border-slate-800/60">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SaveBar({ dirty, saving, onSave, onDiscard }) {
  return (
    <AnimatePresence>
      {dirty && (
        <motion.div
          initial={{ y: 60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 60, opacity: 0 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl shadow-black/50"
        >
          <span className="text-[11px] text-slate-400">Unsaved changes</span>
          <button onClick={onDiscard} className="text-[11px] px-3 py-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition-colors">
            Discard
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            className="flex items-center gap-1.5 text-[11px] px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-colors disabled:opacity-60"
          >
            {saving ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
            {saving ? "Saving…" : "Save changes"}
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function SettingsPage() {
  const [settings,  setSettings]  = useState(null);
  const [snapshot,  setSnapshot]  = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [saved,     setSaved]     = useState(false);
  const [error,     setError]     = useState(null);
  const [activeTab, setActiveTab] = useState("theme");
  const [resetting, setResetting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await settingsApi.get();
      setSettings(data);
      setSnapshot(JSON.stringify(data));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const dirty = settings && JSON.stringify(settings) !== snapshot;

  const set = useCallback((path, value) => {
    setSettings(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      const keys = path.split(".");
      let obj = next;
      for (let i = 0; i < keys.length - 1; i++) obj = obj[keys[i]];
      obj[keys[keys.length - 1]] = value;
      return next;
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const result = await settingsApi.save({
        theme:    settings.theme,
        basic:    settings.basic,
        advanced: settings.advanced,
      });
      setSettings(result);
      setSnapshot(JSON.stringify(result));
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => setSettings(JSON.parse(snapshot));

  const handleReset = async () => {
    if (!confirm("Reset all settings to defaults?")) return;
    setResetting(true);
    setError(null);
    try {
      const fresh = await settingsApi.reset();
      setSettings(fresh);
      setSnapshot(JSON.stringify(fresh));
    } catch (e) {
      setError(e.message);
    } finally {
      setResetting(false);
    }
  };

  const TABS = [
    { id: "theme",    label: "Theme",    icon: Palette },
    { id: "basic",    label: "Basic",    icon: Sliders },
    { id: "advanced", label: "Advanced", icon: Cpu     },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 gap-3">
        <Loader2 size={16} className="animate-spin text-blue-400" />
        <p className="text-sm text-slate-500">Loading settings…</p>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="flex items-center gap-3 p-6 bg-red-500/5 border border-red-500/20 rounded-2xl">
        <AlertTriangle size={16} className="text-red-400" />
        <p className="text-sm text-red-400">{error ?? "Failed to load settings"}</p>
        <button onClick={load} className="ml-auto text-[11px] px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors">Retry</button>
      </div>
    );
  }

  const th = settings.theme;
  const b  = settings.basic;
  const a  = settings.advanced;

  return (
    <div className="max-w-3xl mx-auto space-y-5 pb-28" style={{ fontFamily: "'Sora', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');`}</style>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
            <Settings size={16} className="text-blue-400" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white">Settings</h1>
            <p className="text-[11px] text-slate-500">Configure your analysis pipeline</p>
          </div>
        </div>
        <button
          onClick={handleReset}
          disabled={resetting}
          className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-lg border border-slate-700/60 bg-slate-800/40 text-slate-500 hover:text-red-400 hover:border-red-500/30 transition-colors"
        >
          {resetting ? <Loader2 size={10} className="animate-spin" /> : <RotateCcw size={10} />}
          Reset defaults
        </button>
      </div>

      <AnimatePresence>
        {error && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/8 border border-red-500/20 text-red-400 text-[11px]">
            <AlertTriangle size={12} />{error}
          </motion.div>
        )}
        {saved && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/8 border border-emerald-500/20 text-emerald-400 text-[11px]">
            <Check size={12} />Settings saved to database
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`relative flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium transition-all ${
              activeTab === tab.id ? "bg-slate-800 text-white shadow-sm" : "text-slate-500 hover:text-slate-300"
            }`}
          >
            <tab.icon size={12} />
            {tab.label}
            {tab.id === "advanced" && (
              <span className="text-[8px] px-1 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/20 font-mono">PRO</span>
            )}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="space-y-4"
        >
          {activeTab === "theme" && (
            <Section icon={Palette} title="Appearance" accent="text-violet-400">
              <Sub title="Color Mode" />
              <div className="flex gap-2 mt-2">
                {[
                  { id: "dark",  icon: Moon, label: "Dark"  },
                  { id: "light", icon: Sun,  label: "Light" },
                ].map(({ id, icon: Icon, label }) => (
                  <button
                    key={id}
                    onClick={() => set("theme.mode", id)}
                    className={`flex-1 flex flex-col items-center gap-2 py-4 rounded-xl border-2 transition-all text-xs font-medium ${
                      th.mode === id
                        ? "border-blue-500 bg-blue-500/10 text-blue-400"
                        : "border-slate-700/50 text-slate-500 hover:border-slate-600 hover:text-slate-300"
                    }`}
                  >
                    <Icon size={18} />
                    {label}
                  </button>
                ))}
              </div>

              <Sub title="Accent Color" />
              <div className="flex gap-3 mt-2">
                {ACCENT_COLORS.map(c => (
                  <button
                    key={c.id}
                    onClick={() => set("theme.accent", c.id)}
                    title={c.id}
                    className={`w-8 h-8 rounded-full ${c.bg} ring-offset-2 ring-offset-slate-900 transition-all ${
                      th.accent === c.id ? `ring-2 ${c.ring} scale-110` : "opacity-40 hover:opacity-75"
                    }`}
                  />
                ))}
              </div>
            </Section>
          )}

          {activeTab === "basic" && (
            <>
              <Section icon={Film} title="Video Processing" accent="text-blue-400">
                <Row label="Frames Per Second" description="Frames to sample per second of video">
                  <SliderInput value={b.default_fps} onChange={v => set("basic.default_fps", v)} min={0.5} max={10} step={0.5} unit=" fps" />
                </Row>
                <Row label="Confidence Threshold" description="Minimum detection score to keep a result">
                  <SliderInput value={b.conf_threshold} onChange={v => set("basic.conf_threshold", v)} min={0.05} max={0.95} step={0.05} />
                </Row>
                <Row label="Input Resolution" description="Image size fed to YOLO — larger is more accurate but slower">
                  <SelectInput
                    value={b.imgsz}
                    onChange={v => set("basic.imgsz", Number(v))}
                    options={[320, 416, 480, 640, 800, 960, 1280].map(v => ({ value: v, label: `${v}px` }))}
                  />
                </Row>
              </Section>

              <Section icon={Database} title="Output" accent="text-emerald-400">
                <Row label="Save Annotated Frames" description="Export individual JPEG frames with bounding boxes drawn">
                  <Toggle value={b.save_frames} onChange={v => set("basic.save_frames", v)} />
                </Row>
                <Row label="Auto-generate Captions" description="Run AI caption generation automatically after each analysis">
                  <Toggle value={b.auto_caption} onChange={v => set("basic.auto_caption", v)} />
                </Row>
              </Section>

              <Section icon={PersonStanding} title="Pose Estimation" accent="text-pink-400">
                <Row
                  label="Extract Pose Keypoints"
                  description="Run YOLOv8-pose on each detected person to extract 17 body keypoints. Increases processing time."
                >
                  <Toggle value={b.extract_pose ?? false} onChange={v => set("basic.extract_pose", v)} />
                </Row>
                {b.extract_pose && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-2"
                  >
                    <Row
                      label="Draw Skeleton on Video"
                      description="Overlay pose skeleton on the annotated output video"
                      indent
                    >
                      <Toggle
                        value={a.output.annotate_pose ?? true}
                        onChange={v => set("advanced.output.annotate_pose", v)}
                      />
                    </Row>
                    <div className="flex items-start gap-2 mt-3 px-3 py-2.5 rounded-xl bg-amber-500/8 border border-amber-500/20">
                      <Info size={11} className="text-amber-400 mt-0.5 shrink-0" />
                      <p className="text-[10px] text-amber-300 leading-relaxed">
                        Pose model runs per-person per-frame. Expect ~2–5× slower analysis depending on person count.
                        Keypoints are saved in <span className="font-mono">track_details[].keypoints</span> for downstream classifiers.
                      </p>
                    </div>
                  </motion.div>
                )}
              </Section>
            </>
          )}

          {activeTab === "advanced" && (
            <>
              <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/8 border border-amber-500/20">
                <Info size={12} className="text-amber-400 shrink-0" />
                <p className="text-[11px] text-amber-300">Advanced settings directly affect the detection pipeline. Incorrect values may degrade results.</p>
              </div>

              <Section icon={Activity} title="ByteTrack Tracker" accent="text-cyan-400">
                <Row label="Track Activation Threshold" description="Minimum confidence to initialise a new tracked object">
                  <SliderInput value={a.tracker.track_activation_threshold} onChange={v => set("advanced.tracker.track_activation_threshold", v)} min={0.05} max={0.95} step={0.05} />
                </Row>
                <Row label="Lost Track Buffer" description="How many frames to keep a disappeared track alive">
                  <SliderInput value={a.tracker.lost_track_buffer} onChange={v => set("advanced.tracker.lost_track_buffer", v)} min={5} max={120} step={5} unit=" fr" />
                </Row>
                <Row label="Minimum Matching Threshold" description="IoU threshold for associating detections to tracks">
                  <SliderInput value={a.tracker.minimum_matching_threshold} onChange={v => set("advanced.tracker.minimum_matching_threshold", v)} min={0.1} max={0.99} step={0.01} />
                </Row>
                <Row label="Min Consecutive Frames" description="Frames a detection must appear before a track is confirmed">
                  <NumberInput value={a.tracker.min_consecutive_frames} onChange={v => set("advanced.tracker.min_consecutive_frames", v)} min={1} max={10} />
                </Row>
              </Section>

              <Section icon={Eye} title="Detection" accent="text-violet-400">
                <Row label="IoU Threshold (NMS)" description="Non-max suppression overlap threshold — lower removes more duplicates">
                  <SliderInput value={a.detection.iou_threshold} onChange={v => set("advanced.detection.iou_threshold", v)} min={0.1} max={0.95} step={0.05} />
                </Row>
                <Row label="Max Detections Per Frame" description="Hard ceiling on the number of boxes per frame">
                  <NumberInput value={a.detection.max_detections} onChange={v => set("advanced.detection.max_detections", v)} min={10} max={1000} step={10} />
                </Row>
              </Section>

              <Section icon={Film} title="Output & Encoding" accent="text-amber-400">
                <Row label="JPEG Frame Quality" description="Quality of saved annotated frame images">
                  <SliderInput value={a.output.jpeg_quality} onChange={v => set("advanced.output.jpeg_quality", v)} min={20} max={100} step={5} unit="%" />
                </Row>
                <Row label="ffmpeg Preset" description="Encoding speed vs output file size — faster = larger file">
                  <SelectInput
                    value={a.output.ffmpeg_preset}
                    onChange={v => set("advanced.output.ffmpeg_preset", v)}
                    options={["ultrafast","superfast","veryfast","faster","fast","medium","slow","veryslow"]}
                  />
                </Row>
                <Row label="ffmpeg CRF" description="Constant Rate Factor — lower value = better quality, bigger file">
                  <SliderInput value={a.output.ffmpeg_crf} onChange={v => set("advanced.output.ffmpeg_crf", v)} min={0} max={51} step={1} />
                </Row>
                <Row label="Performance Log Size" description="Number of per-frame entries kept in the analysis report">
                  <NumberInput value={a.output.performance_log_size} onChange={v => set("advanced.output.performance_log_size", v)} min={10} max={1000} step={10} />
                </Row>

                <Sub title="Annotation Style" />
                <Row label="Draw Bounding Boxes" indent>
                  <Toggle value={a.output.annotate_boxes} onChange={v => set("advanced.output.annotate_boxes", v)} />
                </Row>
                <Row label="Show Labels" indent>
                  <Toggle value={a.output.annotate_labels} onChange={v => set("advanced.output.annotate_labels", v)} />
                </Row>
                <Row label="Show Confidence Score" indent>
                  <Toggle value={a.output.annotate_conf} onChange={v => set("advanced.output.annotate_conf", v)} />
                </Row>
                <Row label="Box Thickness" description="Bounding box line width in pixels" indent>
                  <SliderInput value={a.output.box_thickness} onChange={v => set("advanced.output.box_thickness", v)} min={1} max={6} step={1} unit="px" />
                </Row>
                <Row label="Label Font Scale" description="Text size for detection labels drawn on frames" indent>
                  <SliderInput value={a.output.label_font_scale} onChange={v => set("advanced.output.label_font_scale", v)} min={0.3} max={1.5} step={0.1} />
                </Row>
              </Section>

              <Section icon={MessageSquare} title="LLM / AI" accent="text-rose-400">
                <Row label="Chat Temperature" description="Higher = more creative chat responses, lower = more precise">
                  <SliderInput value={a.llm.temperature} onChange={v => set("advanced.llm.temperature", v)} min={0} max={2} step={0.05} />
                </Row>
                <Row label="Caption Temperature" description="Creativity level for scene and global caption generation">
                  <SliderInput value={a.llm.caption_temperature} onChange={v => set("advanced.llm.caption_temperature", v)} min={0} max={2} step={0.05} />
                </Row>
              </Section>

              <Section icon={Server} title="System" accent="text-slate-400">
                <Row label="Max Concurrent Jobs" description="Number of video analysis jobs that can run in parallel">
                  <NumberInput value={a.system.max_concurrent_jobs} onChange={v => set("advanced.system.max_concurrent_jobs", v)} min={1} max={8} />
                </Row>
                <Row label="Job Timeout" description="Maximum seconds a job can run before being forcibly stopped">
                  <NumberInput value={a.system.job_timeout_seconds} onChange={v => set("advanced.system.job_timeout_seconds", v)} min={60} max={14400} step={60} />
                </Row>
              </Section>
            </>
          )}
        </motion.div>
      </AnimatePresence>

      <SaveBar dirty={dirty} saving={saving} onSave={handleSave} onDiscard={handleDiscard} />
    </div>
  );
}