import { useCallback, useEffect, useState } from "react";
import { dashboardApi } from "../api/dashboardApi";

function computeClassLeaderboard(jobs) {
  const map = {};
  for (const job of jobs) {
    const stats = job.rich_stats?.class_stats ?? [];
    for (const cs of stats) {
      if (!map[cs.class]) {
        map[cs.class] = {
          class:           cs.class,
          unique_tracks:   0,
          total_detections:0,
          avg_conf_sum:    0,
          avg_conf_count:  0,
          jobs:            0,
        };
      }
      const entry = map[cs.class];
      entry.unique_tracks    += cs.unique_tracks    ?? 0;
      entry.total_detections += cs.total_detections ?? 0;
      entry.avg_conf_sum     += cs.avg_conf         ?? 0;
      entry.avg_conf_count   += 1;
      entry.jobs             += 1;
    }
  }
  return Object.values(map)
    .map((e) => ({
      ...e,
      avg_conf: e.avg_conf_count > 0
        ? Math.round((e.avg_conf_sum / e.avg_conf_count) * 100)
        : 0,
    }))
    .sort((a, b) => b.unique_tracks - a.unique_tracks)
    .slice(0, 10);
}

function computeActivityTimeline(jobs) {
  const byDay = {};
  for (const job of jobs) {
    if (!job.analysed_at) continue;
    const day = job.analysed_at.slice(0, 10);
    if (!byDay[day]) byDay[day] = { date: day, jobs: 0, detections: 0, objects: 0 };
    byDay[day].jobs       += 1;
    byDay[day].detections += job.total_detections ?? 0;
    byDay[day].objects    += job.total_unique     ?? 0;
  }
  return Object.values(byDay).sort((a, b) => a.date.localeCompare(b.date)).slice(-30);
}

function computePerformanceStats(jobs) {
  const completed = jobs.filter((j) => j.status === "completed" && j.elapsed_time);
  if (!completed.length) return null;
  const times  = completed.map((j) => j.elapsed_time);
  const fps    = completed.map((j) => j.rich_stats?.performance?.throughput_fps ?? 0).filter(Boolean);
  const infers = completed.map((j) => j.rich_stats?.performance?.avg_inference_ms ?? 0).filter(Boolean);
  const mean   = (arr) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
  return {
    avg_elapsed:       Math.round(mean(times) * 10) / 10,
    min_elapsed:       Math.min(...times),
    max_elapsed:       Math.max(...times),
    avg_throughput:    Math.round(mean(fps) * 10) / 10,
    avg_inference_ms:  Math.round(mean(infers) * 10) / 10,
  };
}

export function useDashboard() {
  const [aggregate,   setAggregate]   = useState(null);
  const [recentJobs,  setRecentJobs]  = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [timeline,    setTimeline]    = useState([]);
  const [perfStats,   setPerfStats]   = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [aggRes, recentRes, topRes] = await Promise.all([
        dashboardApi.getAggregate(),
        dashboardApi.getRecent(10),
        dashboardApi.getTopClasses(50),
      ]);

      const allJobs = topRes.items ?? [];

      setAggregate(aggRes);
      setRecentJobs(recentRes.items ?? []);
      setLeaderboard(computeClassLeaderboard(allJobs));
      setTimeline(computeActivityTimeline(allJobs));
      setPerfStats(computePerformanceStats(allJobs));
      setLastRefresh(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return {
    aggregate,
    recentJobs,
    leaderboard,
    timeline,
    perfStats,
    loading,
    error,
    lastRefresh,
    refresh: load,
  };
}