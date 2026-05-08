const BASE = "/analysis";

export async function fetchHistory({
  page     = 1,
  limit    = 10,
  search   = "",
  sortBy   = "date",
  sortDir  = "desc",
  status   = "all",
} = {}) {
  const params = new URLSearchParams({ page, limit, sort_by: sortBy, sort_dir: sortDir });
  if (search) params.set("search", search);
  if (status && status !== "all") params.set("status", status);

  const res = await fetch(`${BASE}/history?${params}`);
  if (!res.ok) throw new Error(`Failed to load history (${res.status})`);
  return res.json();
}

export async function fetchRecord(jobId) {
  const res = await fetch(`${BASE}/${jobId}/record`);
  if (!res.ok) throw new Error(`Record not found (${res.status})`);
  return res.json();
}

export async function bulkDelete(ids) {
  const res = await fetch(`${BASE}/bulk-delete`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ ids }),
  });
  if (!res.ok) throw new Error(`Bulk delete failed (${res.status})`);
  return res.json();
}

export async function retryAnalysis(jobId) {
  const res = await fetch(`${BASE}/${jobId}/retry`, { method: "POST" });
  if (!res.ok) throw new Error(`Retry failed (${res.status})`);
  return res.json();
}

export function getExportUrl(jobId) {
  return `${BASE}/${jobId}/export`;
}