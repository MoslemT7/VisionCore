import { API_BASE } from "./client.js";

export const chatApi = {
  async send(jobId, question, history = []) {
    const response = await fetch(`${API_BASE}/chat/${jobId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, history }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.detail ?? `HTTP error! status: ${response.status}`);
    }

    return await response.json();
  },
};