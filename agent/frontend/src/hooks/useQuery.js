import { useState } from 'react';
import { api } from '../api/client';

export function useQuery() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  
  const submit = async (query, imagePath) => {
    if (!query || !imagePath) return;
    
    setLoading(true);
    setError(null);
    setResult(null);
    
    try {
      const data = await api.analyzeQuery(query, imagePath);
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  return { submit, loading, result, error };
}

