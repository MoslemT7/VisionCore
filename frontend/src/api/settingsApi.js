import { API_BASE } from "./client";

export const settingsApi = {
  async get(profileId = "default") {
    const res = await fetch(`${API_BASE}/settings?profile_id=${profileId}`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async save(data, profileId = "default") {
    const res = await fetch(`${API_BASE}/settings`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ ...data, profile_id: profileId }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async reset(profileId = "default") {
    const res = await fetch(`${API_BASE}/settings/reset?profile_id=${profileId}`, {
      method: "POST",
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
};