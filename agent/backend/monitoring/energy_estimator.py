"""
Energy estimation module.
Estimates energy consumption based on CPU/GPU usage logs.
"""
from typing import List, Dict, Any


def estimate_energy(resource_log: List[Dict[str, Any]], cpu_watt: float = 65.0, gpu_watt: float = 150.0) -> float:
    """
    Estimate total energy (Wh) based on CPU/GPU usage log.
    
    Args:
        resource_log: List of resource usage entries with cpu_percent and gpu_percent
        cpu_watt: CPU power consumption at 100% usage (default 65W)
        gpu_watt: GPU power consumption at 100% usage (default 150W)
    
    Returns:
        Total energy consumption in Watt-hours (Wh)
    """
    if not resource_log:
        return 0.0
    
    total_energy = 0.0

    for entry in resource_log:
        cpu_usage = entry.get("cpu_percent", 0.0) / 100.0
        gpu_usage = (entry.get("gpu_percent") or 0.0) / 100.0

        power = (cpu_usage * cpu_watt) + (gpu_usage * gpu_watt)
        total_energy += power  # approximate per second

    return total_energy / 3600.0  # convert to Wh
