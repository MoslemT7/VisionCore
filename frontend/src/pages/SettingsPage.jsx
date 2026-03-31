import { useEffect, useState } from "react";
import {
  Sun, Moon, Bot, Cpu, Film, Sliders, RotateCcw,
  Check, ChevronDown, AlertCircle, Wifi,
} from "lucide-react";
import { useSettings } from "../hooks/useSettings";
import { settingsApi } from "../api/settingsApi";

const OPENROUTER_MODELS = [
  { value: "google/gemini-1.5-pro",   label: "Gemini 1.5 Pro" },
  { value: "google/gemini-1.5-flash", label: "Gemini 1.5 Flash" },
  { value: "google/gemini-2.0-flash", label: "Gemini 2.0 Flash" },
  { value: "openai/gpt-4o",           label: "GPT-4o" },
  { value: "openai/gpt-4o-mini",      label: "GPT-4o Mini" },
  { value: "anthropic/claude-3.5-sonnet", label: "Claude 3.5 Sonnet" },
  { value: "meta-llama/llama-3.1-70b-instruct", label: "Llama 3.1 70B" },
];

const GEMINI_MODELS = [
  { value: "gemini-1.5-pro",   label: "Gemini 1.5 Pro" },
  { value: "gemini-1.5-flash", label: "Gemini 1.5 Flash" },
  { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
];

const YOLO_MODELS = [
  { value: "n", label: "Nano  (fastest, least accurate)" },
  { value: "s", label: "Small (balanced)" },
  { value: "m", label: "Medium (most accurate, slower)" },
];

const FPS_OPTIONS    = [0.5, 1, 2, 5, 10, 15, 24, 30];
const IMGSZ_OPTIONS  = [320, 480, 640, 800, 1280];
const SCENE_OPTIONS  = [2, 3, 4, 5, 6, 8];

function Section({ icon: Icon, title, description, children }) {
  return (
    <div className="rounded-xl border border-slate-700/40 bg-slate-800/30 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-700/40 flex items-center gap-3">
        <div className="w-7 h-7 rounded-lg bg-slate-700/60 flex items-center justify-center shrink-0">
          <Icon size={13} className="text-blue-400" />
        </div>
        <div>
          <p className="text-sm font-semibold text-white">{title}</p>
          {description && <p className="text-[11px] text-slate-500 mt-0.5">{description}</p>}
        </div>
      </div>
      <div className="px-5 py-4 space-y-5">{children}</div>
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div className="flex items-start justify-between gap-6">
      <div className="shrink-0 pt-0.5">
        <p className="text-xs font-medium text-slate-300">{label}</p>
        {hint && <p className="text-[11px] text-slate-600 mt-0.5 max-w-[220px]">{hint}</p>}
      </div>
      <div className="flex-1 max-w-xs">{children}</div>
    </div>
  );
}

function Select({ value, onChange, options }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full appearance-none bg-slate-900/60 border border-slate-700/50 rounded-lg
          px-3 py-2 text-sm text-slate-300 outline-none cursor-pointer
          focus:border-blue-500/50 transition-colors pr-8"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
    </div>
  );
}

function Slider({ value, onChange, min, max, step, format }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-slate-500">{min}</span>
        <span className="text-xs font-mono text-blue-400">{format ? format(value) : value}</span>
        <span className="text-[11px] text-slate-500">{max}</span>
      </div>
      <input
        type="range"
        min={min} max={max} step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-blue-500 cursor-pointer"
      />
    </div>
  );
}

function ThemeButton({ value, current, label, icon: Icon, onClick }) {
  const active = current === value;
  return (
    <button
      onClick={() => onClick(value)}
      className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm
        transition-colors
        ${active
          ? "bg-blue-600/20 border-blue-500/40 text-blue-400"
          : "border-slate-700/50 text-slate-500 hover:text-slate-300 hover:border-slate-600"
        }`}
    >
      <Icon size={13} />
      {label}
      {active && <Check size={11} />}
    </button>
  );
}

function SaveBar({ dirty, saving, saved, error, onSave, onDiscard }) {
  if (!dirty && !saved && !error) return null;
  return (
    <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3
      px-5 py-3 rounded-xl border shadow-xl shadow-black/40
      ${error
        ? "bg-red-950/90 border-red-500/30"
        : "bg-slate-900/95 border-slate-700/50"
      } backdrop-blur-sm`}>
      {error
        ? <><AlertCircle size={13} className="text-red-400" /><p className="text-sm text-red-400">{error}</p></>
        : saved
          ? <><Check size={13} className="text-emerald-400" /><p className="text-sm text-emerald-400">Settings saved</p></>
          : <p className="text-sm text-slate-300">You have unsaved changes</p>
      }
      {dirty && !error && (
        <>
          <button
            onClick={onDiscard}
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            Discard
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg
              bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50 transition-colors"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </>
      )}
    </div>
  );
}

export default function SettingsPage() {
  const { settings, update, reset } = useSettings();

  const [original, setOriginal] = useState(() => ({ ...settings }));
  const [saving,   setSaving]   = useState(false);
  const [saved,    setSaved]    = useState(false);
  const [error,    setError]    = useState(null);

  const dirty = JSON.stringify(settings) !== JSON.stringify(original);

  useEffect(() => {
    if (saved) {
      const t = setTimeout(() => setSaved(false), 3000);
      return () => clearTimeout(t);
    }
  }, [saved]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await settingsApi.push(settings);
      setOriginal({ ...settings });
      setSaved(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function handleDiscard() {
    Object.entries(original).forEach(([k, v]) => update(k, v));
  }

  function handleReset() {
    reset();
    setOriginal({});
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-8 space-y-6 pb-28">

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white">Settings</h1>
          <p className="text-xs text-slate-500 mt-0.5">Configure appearance, models, and analysis defaults</p>
        </div>
        <button
          onClick={handleReset}
          className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-400 transition-colors"
        >
          <RotateCcw size={11} />
          Reset all
        </button>
      </div>

      <Section icon={Sun} title="Appearance" description="Visual theme for the interface">
        <Field label="Theme">
          <div className="flex gap-2">
            <ThemeButton value="dark"  current={settings.theme} label="Dark"  icon={Moon} onClick={(v) => update("theme", v)} />
            <ThemeButton value="light" current={settings.theme} label="Light" icon={Sun}  onClick={(v) => update("theme", v)} />
          </div>
        </Field>
      </Section>

      <Section
        icon={Wifi}
        title="VLM Provider"
        description="Language model used for captions and chat"
      >
        <Field label="Provider">
          <Select
            value={settings.vlmProvider}
            onChange={(v) => update("vlmProvider", v)}
            options={[
              { value: "openrouter", label: "OpenRouter" },
              { value: "gemini",     label: "Gemini (direct)" },
            ]}
          />
        </Field>

        {settings.vlmProvider === "openrouter" && (
          <Field label="Model" hint="Vision-capable models recommended">
            <Select
              value={settings.openrouterModel}
              onChange={(v) => update("openrouterModel", v)}
              options={OPENROUTER_MODELS}
            />
          </Field>
        )}

        {settings.vlmProvider === "gemini" && (
          <Field label="Model">
            <Select
              value={settings.geminiModel}
              onChange={(v) => update("geminiModel", v)}
              options={GEMINI_MODELS}
            />
          </Field>
        )}

        <Field label="Temperature" hint="Higher = more creative, lower = more factual">
          <Slider
            value={settings.vlmTemperature}
            onChange={(v) => update("vlmTemperature", v)}
            min={0} max={1} step={0.05}
            format={(v) => v.toFixed(2)}
          />
        </Field>

        <Field label="Max tokens" hint="Maximum response length">
          <Slider
            value={settings.vlmMaxTokens}
            onChange={(v) => update("vlmMaxTokens", v)}
            min={256} max={4096} step={256}
            format={(v) => `${v}`}
          />
        </Field>
      </Section>

      <Section
        icon={Cpu}
        title="YOLO Detection"
        description="Object detection model and confidence settings"
      >
        <Field label="Default model" hint="Larger models are more accurate but slower">
          <Select
            value={settings.yoloModel}
            onChange={(v) => update("yoloModel", v)}
            options={YOLO_MODELS}
          />
        </Field>

        <Field label="Confidence threshold" hint="Detections below this score are ignored">
          <Slider
            value={settings.defaultConf}
            onChange={(v) => update("defaultConf", v)}
            min={0.05} max={0.95} step={0.05}
            format={(v) => `${Math.round(v * 100)}%`}
          />
        </Field>

        <Field label="Input image size" hint="Larger = more accurate, slower inference">
          <Select
            value={settings.defaultImgsz}
            onChange={(v) => update("defaultImgsz", parseInt(v))}
            options={IMGSZ_OPTIONS.map((v) => ({ value: v, label: `${v}px` }))}
          />
        </Field>
      </Section>

      <Section
        icon={Film}
        title="Video Analysis"
        description="Default parameters for video processing"
      >
        <Field label="Sampling rate" hint="Frames analysed per second of video">
          <Select
            value={settings.defaultFps}
            onChange={(v) => update("defaultFps", parseFloat(v))}
            options={FPS_OPTIONS.map((v) => ({ value: v, label: `${v} fps` }))}
          />
        </Field>
      </Section>

      <Section
        icon={Bot}
        title="Captions"
        description="AI scene captioning behaviour"
      >
        <Field label="Number of scenes" hint="How many scene windows to caption per video">
          <Select
            value={settings.nScenes}
            onChange={(v) => update("nScenes", parseInt(v))}
            options={SCENE_OPTIONS.map((v) => ({ value: v, label: `${v} scenes` }))}
          />
        </Field>
      </Section>

      <Section
        icon={Sliders}
        title="About"
        description="System information"
      >
        <div className="space-y-2 text-[11px] font-mono text-slate-500">
          <div className="flex justify-between">
            <span>App</span>
            <span className="text-slate-400">VisionCore</span>
          </div>
          <div className="flex justify-between">
            <span>Provider</span>
            <span className="text-slate-400">{settings.vlmProvider}</span>
          </div>
          <div className="flex justify-between">
            <span>Model</span>
            <span className="text-slate-400">
              {settings.vlmProvider === "openrouter"
                ? settings.openrouterModel
                : settings.geminiModel}
            </span>
          </div>
          <div className="flex justify-between">
            <span>YOLO</span>
            <span className="text-slate-400">yolo26{settings.yoloModel}.pt</span>
          </div>
        </div>
      </Section>

      <SaveBar
        dirty={dirty}
        saving={saving}
        saved={saved}
        error={error}
        onSave={handleSave}
        onDiscard={handleDiscard}
      />

    </div>
  );
}