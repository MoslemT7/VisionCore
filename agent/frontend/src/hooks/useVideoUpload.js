import { useState } from 'react';
import { api } from '../api/client';

export function useVideoUpload() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(null);
  const [jobId, setJobId] = useState(null);
  
  const upload = async (file) => {
    if (!file) return;
    
    setLoading(true);
    setError(null);
    setResult(null);
    setProgress(null);
    setJobId(null);
    
    try {
      const { job_id } = await api.startVideoAnalysis(file);
      setJobId(job_id);

      // Poll for status until completed or failed
      const poll = async () => {
        const status = await api.getVideoAnalysisStatus(job_id);

        if (status.progress) {
          setProgress(status.progress);
        }

        if (status.status === 'completed') {
          setResult(status);
          setLoading(false);
          return;
        }

        if (status.status === 'failed') {
          throw new Error(status.error || 'Video analysis failed');
        }

        // Continue polling
        setTimeout(poll, 1000);
      };

      await poll();
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };
  
  return { upload, loading, result, error, progress, jobId };
}

