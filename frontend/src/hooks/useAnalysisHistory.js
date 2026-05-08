// hooks/useAnalysisHistory.js

import { useState, useEffect, useCallback, useRef } from "react";
import { fetchHistory, bulkDelete, retryAnalysis } from "../api/analysisApi";

const DEBOUNCE_MS = 350;

export function useAnalysisHistory() {
  const [records, setRecords] = useState([]);
  const [total,   setTotal  ] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error,   setError  ] = useState(null);
  const [search,      setSearch     ] = useState("");
  const [statusFilter,setStatusFilter] = useState("all");
  const [sortBy,      setSortBy     ] = useState("date");
  const [sortDir,     setSortDir    ] = useState("desc");
  const [page,        setPage       ] = useState(1);
  const [pageSize,    setPageSize   ] = useState(10);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const debounceTimer = useRef(null);

  useEffect(() => {
    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, DEBOUNCE_MS);
    return () => clearTimeout(debounceTimer.current);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const json = await fetchHistory({
        page,
        limit:   pageSize,
        search:  debouncedSearch,
        sortBy,
        sortDir,
        status:  statusFilter,
      });
      setRecords(json.data  ?? []);
      setTotal  (json.total ?? 0);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, debouncedSearch, sortBy, sortDir, statusFilter]);

  useEffect(() => { load(); }, [load]);

  // ── Sort helper ──
  const toggleSort = useCallback((field) => {
    if (sortBy === field) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortDir("desc");
    }
    setPage(1);
  }, [sortBy]);

  // ── Bulk delete ──
  const handleBulkDelete = useCallback(async (ids) => {
    try {
      await bulkDelete(ids);
      await load();
    } catch (e) {
      setError(e.message);
    }
  }, [load]);

  // ── Retry ──
  const handleRetry = useCallback(async (jobId) => {
    try {
      await retryAnalysis(jobId);
      await load();
    } catch (e) {
      setError(e.message);
    }
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return {
    // data
    records,
    total,
    totalPages,

    // fetch state
    loading,
    error,
    refresh: load,

    // filters
    search,        setSearch,
    statusFilter,  setStatusFilter: (v) => { setStatusFilter(v); setPage(1); },
    sortBy,
    sortDir,
    toggleSort,

    // pagination
    page,          setPage,
    pageSize,      setPageSize: (v) => { setPageSize(v); setPage(1); },

    // actions
    handleBulkDelete,
    handleRetry,
  };
}