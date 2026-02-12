"""
Metrics collector that integrates resource monitoring, performance logging, and energy estimation.
Provides MetricsCollector class with get_latest() method for /metrics endpoint.
"""
import time
from typing import Dict, Any, Optional

from .resource_monitor import ResourceMonitor, get_metrics
from .performance_logger import log_performance, save_performance_log, get_performance_log
from .energy_estimator import estimate_energy


class MetricsCollector:
    """
    Integrated metrics collector that combines resource monitoring,
    performance logging, and energy estimation.
    """
    
    def __init__(self, interval: float = 1.0):
        self.monitor = ResourceMonitor(interval=interval)
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
        Update metrics and energy usage at current frame or timestamp.
        Returns the updated metrics dictionary.
        """
        resource_metrics = self.monitor.get_latest()
        
        # Log performance data
        perf_data = log_performance(resource_metrics)
        
        # Estimate energy from all collected data
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
        If no history exists, collect current metrics.
        """
        if self.metrics_history:
            return self.metrics_history[-1].copy()
        
        # If no history, get current metrics
        if not self._monitor_started:
            self.start()
        
        return self.update()

    def get_history(self) -> list[Dict[str, Any]]:
        """
        Return full metrics history.
        """
        return self.metrics_history.copy()

    def get_resource_log(self) -> list[Dict[str, Any]]:
        """
        Return the raw resource monitor data.
        """
        return self.monitor.get_all_data()
