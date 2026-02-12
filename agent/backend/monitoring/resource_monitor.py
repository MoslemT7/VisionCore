"""
Resource monitoring module with GPU-safe implementation.
Provides ResourceMonitor class and get_metrics() function for live metrics.
"""
import psutil
import time
import threading
from typing import Dict, Any, Optional

# GPU support with safe fallback
_GPU_AVAILABLE = False
_GPU_HANDLE = None

try:
    import pynvml
    try:
        pynvml.nvmlInit()
        _GPU_HANDLE = pynvml.nvmlDeviceGetHandleByIndex(0)
        _GPU_AVAILABLE = True
    except (pynvml.NVMLError, Exception):
        _GPU_AVAILABLE = False
        _GPU_HANDLE = None
except ImportError:
    _GPU_AVAILABLE = False
    _GPU_HANDLE = None


class ResourceMonitor:
    """
    Thread-based resource monitor that collects CPU, RAM, GPU metrics.
    GPU-safe: gracefully handles missing or unavailable GPU.
    """
    
    def __init__(self, interval: float = 1.0):
        self.interval = interval
        self.running = False
        self.data: list[Dict[str, Any]] = []
        self._start_time: Optional[float] = None
        self.thread: Optional[threading.Thread] = None
        self._lock = threading.Lock()

    def start(self) -> None:
        """Start the monitoring thread."""
        if self.running:
            return
        self.running = True
        self._start_time = time.time()
        self.thread = threading.Thread(target=self._monitor, daemon=True)
        self.thread.start()

    def stop(self) -> None:
        """Stop the monitoring thread and wait for it to finish."""
        self.running = False
        if self.thread is not None:
            self.thread.join(timeout=2.0)
            self.thread = None

    def _monitor(self) -> None:
        """Main monitoring loop running in background thread."""
        while self.running:
            metrics = self._collect_metrics()
            with self._lock:
                self.data.append(metrics)
            time.sleep(self.interval)

    def _collect_metrics(self) -> Dict[str, Any]:
        """Collect current system metrics."""
        now = time.time()
        elapsed = now - (self._start_time or now)

        cpu = psutil.cpu_percent(interval=None)
        ram = psutil.virtual_memory().percent

        gpu = None
        gpu_mem = None
        
        if _GPU_AVAILABLE and _GPU_HANDLE is not None:
            try:
                util = pynvml.nvmlDeviceGetUtilizationRates(_GPU_HANDLE)
                mem = pynvml.nvmlDeviceGetMemoryInfo(_GPU_HANDLE)
                gpu = util.gpu
                gpu_mem = (mem.used / mem.total) * 100
            except (pynvml.NVMLError, Exception):
                gpu = None
                gpu_mem = None

        return {
            "timestamp": now,
            "elapsed_time": elapsed,
            "cpu_percent": cpu,
            "ram_percent": ram,
            "gpu_percent": gpu,
            "gpu_memory_percent": gpu_mem,
        }

    def get_latest(self) -> Dict[str, Any]:
        """Return the latest collected metrics."""
        with self._lock:
            if self.data:
                return self.data[-1].copy()
        return self._collect_metrics()

    def get_all_data(self) -> list[Dict[str, Any]]:
        """Return all collected metrics (thread-safe copy)."""
        with self._lock:
            return self.data.copy()


# Global instance for get_metrics() function
_global_monitor: Optional[ResourceMonitor] = None
_monitor_lock = threading.Lock()


def get_metrics() -> Dict[str, Any]:
    """
    Get latest system metrics (CPU, RAM, GPU, timestamp, elapsed time).
    Creates and starts a global ResourceMonitor instance if needed.
    """
    global _global_monitor
    
    with _monitor_lock:
        if _global_monitor is None:
            _global_monitor = ResourceMonitor(interval=1.0)
            _global_monitor.start()
        return _global_monitor.get_latest()
