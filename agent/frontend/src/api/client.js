const API_BASE = 'http://127.0.0.1:8000';

export const api = {
  async analyzeImage(file) {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await fetch(`${API_BASE}/analyze/image`, {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  },
  
  async analyzeQuery(query, imagePath) {
    const response = await fetch(`${API_BASE}/analyze/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, image_path: imagePath })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  },
  
  async startVideoAnalysis(file, options = {}) {
    const formData = new FormData();
    formData.append('video', file);

    const {
      fps = 1.0,
      modelSize = 's',
      confThreshold = 0.25,
      imgSize = 640
    } = options;

    const params = new URLSearchParams({
      fps: String(fps),
      model_size: modelSize,
      conf_threshold: String(confThreshold),
      imgsz: String(imgSize)
    });

    const response = await fetch(`${API_BASE}/analyze/video?${params.toString()}`, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  },

  async getVideoAnalysisStatus(jobId) {
    const response = await fetch(`${API_BASE}/analyze/video/${jobId}`);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  },
  
  async getMetrics() {
    const response = await fetch(`${API_BASE}/metrics`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  },
  
  async healthCheck() {
    const response = await fetch(`${API_BASE}/health`);
    return response.ok;
  }
};

