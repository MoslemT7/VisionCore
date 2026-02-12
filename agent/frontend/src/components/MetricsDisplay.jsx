import { useMetrics } from '../hooks/useMetrics';
import styles from '../styles/MetricsDisplay.module.css';

export function MetricsDisplay() {
  const { metrics, error } = useMetrics(2000);

  if (error) {
    return <div className={styles.error}>Error loading metrics: {error}</div>;
  }

  if (!metrics) {
    return <div className={styles.loading}>Loading metrics...</div>;
  }

  const safeValue = (val, decimals = 1) =>
    val !== undefined && val !== null ? val.toFixed(decimals) : "--";

  return (
    <div className={styles.container}>
      <div className={styles.grid}>
        <div className={styles.metric}>
          <div className={styles.value}>{safeValue(metrics.cpu_percent)}%</div>
          <div className={styles.label}>CPU</div>
        </div>

        <div className={styles.metric}>
          <div className={styles.value}>
            {metrics.ram_mb ? metrics.ram_mb.toFixed(0) : "--"}MB
          </div>
          <div className={styles.label}>RAM</div>
        </div>

        {metrics.gpu_percent !== null && metrics.gpu_percent !== undefined && (
          <>
            <div className={styles.metric}>
              <div className={styles.value}>{safeValue(metrics.gpu_percent)}%</div>
              <div className={styles.label}>GPU</div>
            </div>

            <div className={styles.metric}>
              <div className={styles.value}>
                {metrics.gpu_memory_mb
                  ? metrics.gpu_memory_mb.toFixed(0)
                  : "--"}{" "}
                MB
              </div>
              <div className={styles.label}>GPU Memory</div>
            </div>
          </>
        )}

        <div className={styles.metric}>
          <div className={styles.value}>
            {metrics.inference_time_ms
              ? metrics.inference_time_ms.toFixed(1)
              : "--"}
            ms
          </div>
          <div className={styles.label}>Inference Time</div>
        </div>

        {metrics.fps !== null && metrics.fps !== undefined && (
          <div className={styles.metric}>
            <div className={styles.value}>{safeValue(metrics.fps)}</div>
            <div className={styles.label}>FPS</div>
          </div>
        )}
      </div>
    </div>
  );
}
