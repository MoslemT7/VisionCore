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
    Monitors the CPU, RAM, and GPU usage of the current process dynamically.
    Collects metrics every `interval` seconds in a separate thread.
    """

    def __init__(self, interval: float = 1.0):
        self.interval = interval
        self.running = False
        self.data: list[Dict[str, Any]] = []
        self._start_time: Optional[float] = None
        self.thread: Optional[threading.Thread] = None
        self._lock = threading.Lock()
        self._process = psutil.Process()  # current Python process

    def start(self) -> None:
        if self.running:
            return
        self.running = True
        self._start_time = time.time()
        self.thread = threading.Thread(target=self._monitor, daemon=True)
        self.thread.start()

    def stop(self) -> None:
        self.running = False
        if self.thread is not None:
            self.thread.join(timeout=2.0)
            self.thread = None

    def _monitor(self) -> None:
        while self.running:
            metrics = self._collect_metrics()
            with self._lock:
                self.data.append(metrics)
            time.sleep(self.interval)

    def _collect_metrics(self) -> Dict[str, Any]:
        now = time.time()
        elapsed = now - (self._start_time or now)

        # CPU % for this process only
        cpu = self._process.cpu_percent(interval=None) / psutil.cpu_count()
        # RAM % for this process only
        mem = self._process.memory_info().rss  # in bytes
        ram = (mem / psutil.virtual_memory().total) * 100

        # GPU usage for this process (approximation, overall GPU load)
        gpu_percent = None
        gpu_mem_percent = None
        if _GPU_AVAILABLE and _GPU_HANDLE is not None:
            try:
                util = pynvml.nvmlDeviceGetUtilizationRates(_GPU_HANDLE)
                mem_info = pynvml.nvmlDeviceGetMemoryInfo(_GPU_HANDLE)
                gpu_percent = util.gpu
                gpu_mem_percent = (mem_info.used / mem_info.total) * 100
            except (pynvml.NVMLError, Exception):
                gpu_percent = None
                gpu_mem_percent = None

        return {
            "timestamp": now,
            "elapsed_time": elapsed,
            "cpu_percent": cpu,
            "ram_percent": ram,
            "gpu_percent": gpu_percent,
            "gpu_memory_percent": gpu_mem_percent,
        }

    def get_latest(self) -> Dict[str, Any]:
        with self._lock:
            if self.data:
                return self.data[-1].copy()
        return self._collect_metrics()

    def get_all_data(self) -> list[Dict[str, Any]]:
        with self._lock:
            return self.data.copy()

_global_monitor: Optional[ResourceMonitor] = None
_monitor_lock = threading.Lock()


def get_metrics() -> Dict[str, Any]:
    global _global_monitor
    with _monitor_lock:
        if _global_monitor is None:
            _global_monitor = ResourceMonitor(interval=1.0)
            _global_monitor.start()
        return _global_monitor.get_latest()
