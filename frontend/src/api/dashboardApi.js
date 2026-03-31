import { API_BASE } from "./client.js";

export const dashboardApi = {
  async getAggregate() {
    const res = await fetch(`${API_BASE}/history/aggregate`);
    const data = await res.json();
    console.log("AGGREGATE:", data);
    return data;
   },

  async getRecent(limit = 10) {
    const res = await fetch(`${API_BASE}/history?page=1&page_size=${limit}&status=all&sort_by=analysed_at&sort_order=desc`);
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    return res.json();
  },

  async getJobStats(jobId) {
    const res = await fetch(`${API_BASE}/history/${jobId}/stats`);
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    return res.json();
  },

  async getTopClasses(limit = 20) {
    const res = await fetch(`${API_BASE}/history?page=1&page_size=${limit}&status=completed&sort_by=total_detections&sort_order=desc`);
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    return res.json();
  },
};