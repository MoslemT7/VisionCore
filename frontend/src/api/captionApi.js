import { API_BASE } from "./client.js";

export const captionApi = {
  async generateCaptions(jobId) {
    const response = await fetch(`${API_BASE}/caption/${jobId}`, {
      method: "POST",
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.detail ?? `HTTP error! status: ${response.status}`);
    }

    return await response.json();
  },

  async getCaptions(jobId) {
    const response = await fetch(`${API_BASE}/caption/${jobId}`);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  },

  async generateDeepAnalysis(jobId) {
    const response = await fetch(`${API_BASE}/caption/${jobId}/deep-analysis`, {
      method: "POST",
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.detail ?? `HTTP error! status: ${response.status}`);
    }

    return await response.json();
  },

  async getDeepAnalysis(jobId) {
    const response = await fetch(`${API_BASE}/caption/${jobId}/deep-analysis`);

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.detail ?? `HTTP error! status: ${response.status}`);
    }

    return await response.json();
  },
};