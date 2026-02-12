import { useRef } from 'react';
import { useImageUpload } from '../hooks/useImageUpload';
import styles from '../styles/ImageUpload.module.css';

export function ImageUpload() {
  const fileInputRef = useRef(null);
  const { upload, loading, result, error } = useImageUpload();
  
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      upload(file);
    }
  };
  
  return (
    <div className={styles.container}>
      <div className={styles.uploadSection}>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          disabled={loading}
          className={styles.fileInput}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={loading}
          className={styles.button}
        >
          {loading ? 'Processing...' : 'Upload Image'}
        </button>
      </div>
      
      {error && <div className={styles.error}>{error}</div>}
      
      {result && (
        <div className={styles.result}>
          <div className={styles.summary}>
            <div className={styles.count}>Detections: {result.count}</div>
            {result.metrics && (
              <div className={styles.metrics}>
                <span>Time: {result.metrics.inference_time_ms.toFixed(1)}ms</span>
                <span>CPU: {result.metrics.cpu_percent.toFixed(1)}%</span>
                <span>RAM: {result.metrics.ram_mb.toFixed(0)}MB</span>
              </div>
            )}
          </div>
          
          {result.detections && result.detections.length > 0 && (
            <div className={styles.detections}>
              {result.detections.map((det, idx) => (
                <div key={idx} className={styles.detection}>
                  <div>Confidence: {(det.confidence * 100).toFixed(1)}%</div>
                  {det.attributes && (
                    <div>
                      Color: {det.attributes.dominant_color}
                      {det.attributes.height_ratio && (
                        <span> | Height: {(det.attributes.height_ratio * 100).toFixed(1)}%</span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

