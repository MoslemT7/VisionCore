import { useState } from "react";

const BASE_URL         = "http://localhost:8000";
const POLL_INTERVAL_MS = 1500; // poll every 1.5 seconds

export function useVideoUpload() {
  const [loading, setLoading]   = useState(false);
  const [result, setResult]     = useState(null);
  const [error, setError]       = useState(null);
  const [progress, setProgress] = useState(0);
  const [status, setStatus]     = useState("idle");
  const [analysisProgress, setAnalysisProgress] = useState(null);

  const upload = async (file) => {
    setLoading(true);
    setError(null);
    setResult(null);
    setProgress(0);
    setStatus("uploading");

    try {
      const formData = new FormData();
      formData.append("video", file);

      const postRes = await fetch(`${BASE_URL}/analyze/video`, {
        method: "POST",
        body: formData,
      });

      if (!postRes.ok) {
        const err = await postRes.json().catch(() => ({}));
        throw new Error(err.detail || `Upload failed: ${postRes.status}`);
      }

      const { job_id } = await postRes.json();
      if (!job_id) throw new Error("No job_id returned from server.");

      // Small nudge so the bar moves immediately
      setStatus("processing");
      setProgress(5);

      const finalResult = await new Promise((resolve, reject) => {
        const interval = setInterval(async () => {
          try {
            const pollRes = await fetch(`${BASE_URL}/analyze/video/${job_id}`);

            if (!pollRes.ok) {
              clearInterval(interval);
              reject(new Error(`Polling error: ${pollRes.status}`));
              return;
            }

            const data = await pollRes.json();
            console.log("POLL DATA:", JSON.stringify(data));

            setAnalysisProgress(data);

            if (data.progress != null) {
              setProgress(Math.max(5, data.progress));
            }

            if (data.status === "completed") {
              clearInterval(interval);
              setResult(data);
              setStatus("completed");
              setProgress(100);
              resolve(data);

            } else if (data.status === "failed") {
              clearInterval(interval);
              reject(new Error(data.error || "Analysis failed on the server."));
            }
            // "pending" / "running" → keep polling

          } catch (pollErr) {
            clearInterval(interval);
            reject(pollErr);
          }
        }, POLL_INTERVAL_MS);
      });

      return finalResult;

    } catch (err) {
      setError(err.message);
      setStatus("failed");
      throw err; // re-throw so AnalysePage.startAnalysis() catch block fires
    } finally {
      setLoading(false);
    }
  };
  const analyzeImages = async () => {
  setLoading(true);
  setError(null);
  setResult(null);
  setProgress(0);
  setStatus("processing");

  try {
    const postRes = await fetch(`${BASE_URL}/analyze/images`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (!postRes.ok) throw new Error("Failed to start images analysis");
    const { job_id } = await postRes.json();

    setProgress(5);

    const finalResult = await new Promise((resolve, reject) => {
      const interval = setInterval(async () => {
        try {
          const pollRes = await fetch(`${BASE_URL}/analyze/images/${job_id}`);
          if (!pollRes.ok) { clearInterval(interval); reject(new Error(`Polling error: ${pollRes.status}`)); return; }
          const data = await pollRes.json();
          setAnalysisProgress(data);

          if (data.progress != null) setProgress(Math.max(5, data.progress));
          if (data.status === "completed") {
            clearInterval(interval);
            const mapped = {
              ...data,
              total_unique_objects: data.total_unique,
              class_stats: data.rich_stats?.class_stats ?? [],
              top_classes: data.top_classes ?? [],
              performance: data.rich_stats?.performance ?? {},
              video_meta: data.rich_stats?.video_meta ?? {},
              detection_summary: data.rich_stats?.detection_summary ?? {},
            };
            setResult(mapped);
            setStatus("completed");
            setProgress(100);
            resolve(mapped);
          } else if (data.status === "failed") {
            clearInterval(interval);
            reject(new Error(data.error || "Analysis failed."));
          }
        } catch (err) { clearInterval(interval); reject(err); }
      }, POLL_INTERVAL_MS);
    });

    return finalResult;
  } catch (err) {
    setError(err.message);
    setStatus("failed");
    throw err;
  } finally {
    setLoading(false);
  }
};

  return { upload, analyzeImages, loading, result, error, progress, status, analysisProgress };

}
