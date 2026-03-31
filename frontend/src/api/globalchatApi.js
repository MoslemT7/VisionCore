import { API_BASE } from "./client.js";

export const globalChatApi = {
  async send(jobIds, question, history = []) {
    const response = await fetch(`${API_BASE}/chat/global`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ job_ids: jobIds, question, history }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.detail ?? `HTTP error! status: ${response.status}`);
    }

    return response.json();
  },

  async getHistory(pageSize = 50) {
    const response = await fetch(
      `${API_BASE}/history?page=1&page_size=${pageSize}&status=completed&sort_by=analysed_at&sort_order=desc`
    );

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return response.json();
  },
};