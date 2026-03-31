import { API_BASE } from "./client.js";

export const captionApi = {
  async generateCaptions(jobId) {
    const response = await fetch(`${API_BASE}/caption/${jobId}`, {
      method: "POST",
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
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

};

