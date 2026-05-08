import { useState, useEffect } from "react";
import { API_BASE } from "../api/client";

export function useOllamaHealth(intervalMs = 30000) {
  const [status, setStatus] = useState(null);

  const check = async () => {
    try {
      const res = await fetch(`${API_BASE}/health/ollama`);
      setStatus(await res.json());
    } catch {
      setStatus({ online: false, model_available: false });
    }
  };

  useEffect(() => {
    check();
    const id = setInterval(check, intervalMs);
    return () => clearInterval(id);
  }, []);

  return { status, refresh: check };
}