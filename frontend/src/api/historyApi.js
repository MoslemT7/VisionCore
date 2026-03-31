import { API_BASE } from "./client";

export const historyApi = {
  async list(params) {
    const query = new URLSearchParams(params).toString();
    return fetch(`${API_BASE}/history?${query}`).then(r => r.json());
  },

  async details(jobId) {
    return fetch(`${API_BASE}/history/details/${jobId}`)
      .then(r => r.json());
  }
};