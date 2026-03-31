import { useState } from "react";

const BASE_URL         = "http://localhost:8000";
const POLL_INTERVAL_MS = 1500; // poll every 1.5 seconds

export function useVideoUpload() {
  const [loading, setLoading]   = useState(false);
  const [result, setResult]     = useState(null);
  const [error, setError]       = useState(null);
  const [progress, setProgress] = useState(0);
  const [status, setStatus]     = useState("idle"); // idle | uploading | processing | completed | failed

  const upload = async (file) => {
    setLoading(true);
    setError(null);
    setResult(null);
    setProgress(0);
    setStatus("uploading");

    try {
      // ── Step 1: POST video to /analyze/video ──────────────────────────────
      // Key must be "video" — matches the FastAPI UploadFile param name.
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

      // ── Step 2: Poll GET /analyze/video/{job_id} until completed/failed ───
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

            // Mirror backend progress (never drop below 5 to avoid visual jump)
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

  return { upload, loading, result, error, progress, status };
}