from fastapi import APIRouter
from monitoring import MetricsCollector

router = APIRouter()
collector = MetricsCollector()  # shared instance for the app
collector.start()  # Start monitoring on module load

@router.get("/metrics")
def get_metrics():
    """
    Returns the latest performance, resource, energy, and elapsed time metrics.
    """
    return collector.get_latest()
