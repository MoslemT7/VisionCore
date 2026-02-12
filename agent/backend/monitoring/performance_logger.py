"""
Performance logging module.
Provides functions to log, save, and retrieve performance data.
"""
import json
from typing import List, Dict, Any, Union

_performance_log: List[Dict[str, Any]] = []


def log_performance(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Log a single performance entry and store it in memory.
    Returns the logged entry.
    """
    _performance_log.append(data)
    return data


def save_performance_log(data: Union[List[Dict[str, Any]], Dict[str, Any]], output_path: str) -> None:
    """
    Save performance log data to a JSON file.
    Can accept external data (dict or list) or use in-memory log.
    """
    with open(output_path, "w") as f:
        json.dump(data, f, indent=4)


def get_performance_log() -> List[Dict[str, Any]]:
    """
    Return the current in-memory performance log.
    """
    return _performance_log.copy()
