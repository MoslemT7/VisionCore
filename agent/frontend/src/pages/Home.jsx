import { ImageUpload } from '../components/ImageUpload';
import { QueryInput } from '../components/QueryInput';
import { VideoUpload } from '../components/VideoUpload';
import { MetricsDisplay } from '../components/MetricsDisplay';
import styles from '../styles/Home.module.css';

export function Home() {
  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Vision-Language System</h1>
      
      <div className={styles.section}>
        <h2>System Metrics</h2>
        <MetricsDisplay />
      </div>
      
      <div className={styles.section}>
        <h2>Video Analysis</h2>
        <VideoUpload />
      </div>
    </div>
  );
}

