import time
from typing import Dict, Any, Optional

from .resource_monitor import ResourceMonitor
from .performance_logger import log_performance
from .energy_estimator import estimate_energy


class MetricsCollector:
    """
    Integrated metrics collector for the current Python process.
    Combines resource monitoring, performance logging, and energy estimation.
    """

    def __init__(self, interval: float = 1.0):
        self.monitor = ResourceMonitor(interval=interval)  # process-specific
        self.start_time = time.time()
        self.metrics_history: list[Dict[str, Any]] = []
        self._monitor_started = False

    def start(self) -> None:
        """Start the resource monitor."""
        if not self._monitor_started:
            self.monitor.start()
            self._monitor_started = True

    def stop(self) -> None:
        """Stop the resource monitor."""
        if self._monitor_started:
            self.monitor.stop()
            self._monitor_started = False

    def update(self, frame: Optional[int] = None) -> Dict[str, Any]:
        """
        Update metrics for current frame or timestamp.
        Returns the updated metrics dictionary.
        """
        resource_metrics = self.monitor.get_latest()

        # Log performance (optional, depends on implementation)
        log_performance(resource_metrics)

        # Compute energy using all collected process-specific data
        all_data = self.monitor.get_all_data()
        energy_wh = estimate_energy(all_data) if all_data else 0.0

        elapsed = time.time() - self.start_time

        metrics = {
            "timestamp": time.time(),
            "elapsed_time": elapsed,
            "frame": frame,
            "cpu_percent": resource_metrics.get("cpu_percent"),
            "ram_percent": resource_metrics.get("ram_percent"),
            "gpu_percent": resource_metrics.get("gpu_percent"),
            "gpu_memory_percent": resource_metrics.get("gpu_memory_percent"),
            "energy_wh": energy_wh,
        }

        self.metrics_history.append(metrics)
        return metrics

    def get_latest(self) -> Dict[str, Any]:
        """
        Return the latest metrics snapshot.
        Starts monitor if not already running.
        """
        if not self._monitor_started:
            self.start()

        if self.metrics_history:
            return self.metrics_history[-1].copy()
        return self.update()

    def get_history(self) -> list[Dict[str, Any]]:
        """Return full metrics history."""
        return self.metrics_history.copy()

    def get_resource_log(self) -> list[Dict[str, Any]]:
        """Return raw process-specific resource monitor data."""
        return self.monitor.get_all_data()
