import { useState } from 'react';
import { useQuery } from '../hooks/useQuery';
import styles from '../styles/QueryInput.module.css';

export function QueryInput() {
  const [query, setQuery] = useState('');
  const [imagePath, setImagePath] = useState('');
  const { submit, loading, result, error } = useQuery();
  
  const handleSubmit = (e) => {
    e.preventDefault();
    if (query && imagePath) {
      submit(query, imagePath);
    }
  };
  
  return (
    <div className={styles.container}>
      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.inputGroup}>
          <label>Query</label>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g., Count people wearing red"
            disabled={loading}
            className={styles.input}
          />
        </div>
        
        <div className={styles.inputGroup}>
          <label>Image Path</label>
          <input
            type="text"
            value={imagePath}
            onChange={(e) => setImagePath(e.target.value)}
            placeholder="data/inputs/image.jpg"
            disabled={loading}
            className={styles.input}
          />
        </div>
        
        <button
          type="submit"
          disabled={loading || !query || !imagePath}
          className={styles.button}
        >
          {loading ? 'Processing...' : 'Analyze Query'}
        </button>
      </form>
      
      {error && <div className={styles.error}>{error}</div>}
      
      {result && (
        <div className={styles.result}>
          <div className={styles.answer}>
            <strong>Answer:</strong> {result.answer}
          </div>
          
          <div className={styles.details}>
            <div className={styles.task}>
              <strong>Task:</strong> {JSON.stringify(result.task, null, 2)}
            </div>
            
            {result.vision_result && (
              <div className={styles.visionResult}>
                <strong>Detections:</strong> {result.vision_result.count}
              </div>
            )}
            
            {result.metrics && (
              <div className={styles.metrics}>
                <span>Time: {result.metrics.inference_time_ms.toFixed(1)}ms</span>
                <span>CPU: {result.metrics.cpu_percent.toFixed(1)}%</span>
                <span>RAM: {result.metrics.ram_mb.toFixed(0)}MB</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

