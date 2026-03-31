import { useEffect, useState } from "react";

const STORAGE_KEY = "visioncore_settings";

const DEFAULTS = {
  theme:          "dark",
  vlmProvider:    "openrouter",
  openrouterModel:"google/gemini-1.5-pro",
  geminiModel:    "gemini-1.5-pro",
  vlmTemperature: 0.4,
  vlmMaxTokens:   2048,
  yoloModel:      "s",
  defaultFps:     1.0,
  defaultConf:    0.25,
  defaultImgsz:   640,
  nScenes:        4,
  language:       "en",
};

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS };
  } catch {
    return { ...DEFAULTS };
  }
}

function save(settings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function useSettings() {
  const [settings, setSettings] = useState(load);

  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === "light") {
      root.classList.add("light");
      root.classList.remove("dark");
    } else {
      root.classList.add("dark");
      root.classList.remove("light");
    }
  }, [settings.theme]);

  function update(key, value) {
    setSettings((prev) => {
      const next = { ...prev, [key]: value };
      save(next);
      return next;
    });
  }

  function reset() {
    save(DEFAULTS);
    setSettings({ ...DEFAULTS });
  }

  return { settings, update, reset };
}