import { useState, useEffect } from 'react';
import { api } from '../api/client';

export function useMetrics(interval = 2000) {
  const [metrics, setMetrics] = useState(null);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const data = await api.getMetrics();
        setMetrics(data);
        setError(null);
      } catch (err) {
        setError(err.message);
      }
    };
    
    fetchMetrics();
    const id = setInterval(fetchMetrics, interval);
    
    return () => clearInterval(id);
  }, [interval]);
  
  return { metrics, error };
}

