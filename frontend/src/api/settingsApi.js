import { API_BASE } from "./client.js";

export const settingsApi = {
  async push(settings) {
    const response = await fetch(`${API_BASE}/settings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.detail ?? `HTTP error! status: ${response.status}`);
    }

    return await response.json();
  },

  async fetch() {
    const response = await fetch(`${API_BASE}/settings`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  },
};