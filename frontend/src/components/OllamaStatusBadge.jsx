import { useOllamaHealth } from "../hooks/useOllamaHealth";
import { Cpu, RefreshCw } from "lucide-react";

export function OllamaStatusBadge() {
  const { status, refresh } = useOllamaHealth();

  if (!status) return null;

  const ok    = status.online && status.model_available;
  const warn  = status.online && !status.model_available;

  const color = ok   ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
              : warn ? "text-amber-400 border-amber-500/30 bg-amber-500/10"
                     : "text-red-400 border-red-500/30 bg-red-500/10";

  const label = ok   ? "Model ready"
              : warn ? "Model not loaded"
                     : "Ollama offline";

  return (
    <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[10px] font-mono ${color}`}>
      <Cpu size={10} />
      <span>{status.model}</span>
      <span className="opacity-60">·</span>
      <span>{label}</span>
      <button onClick={refresh} className="ml-1 opacity-50 hover:opacity-100 transition-opacity">
        <RefreshCw size={9} />
      </button>
    </div>
  );
}