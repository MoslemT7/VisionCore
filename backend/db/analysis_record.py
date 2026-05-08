from typing import Optional
from typing_extensions import TypedDict


class AnalysisRecord(TypedDict, total=False):
    job_id:            str
    filename:          str
    status:            str
    progress:          int
    created_at:        float
    elapsed_time:      float
    total_frames:      int
    total_detections:  int
    total_unique:      int
    top_classes:       list
    energy_wh:         float
    video_file:        Optional[str]
    summary_file:      Optional[str]
    captions_file:     Optional[str]
    detections_file:   Optional[str]
    performance_log:   list
    summary:           str
    error:             Optional[str]
    rich_stats:        dict
    summary_json:      dict
    captions:          dict


def build_record(job_id: str, filename: str, created_at: float) -> AnalysisRecord:
    return AnalysisRecord(
        job_id          = job_id,
        filename        = filename,
        status          = "pending",
        progress        = 0,
        created_at      = created_at,
        elapsed_time    = 0.0,
        total_frames    = 0,
        total_detections= 0,
        total_unique    = 0,
        top_classes     = [],
        energy_wh       = 0.0,
        video_file      = None,
        summary_file    = None,
        captions_file   = None,
        detections_file = None,
        performance_log = [],
        summary         = "",
        error           = None,
        rich_stats      = {},
        summary_json    = {},
        captions        = {},
    )


INDEXES = [
    {"key": {"job_id": 1},      "unique": True, "name": "job_id_unique"},
    {"key": {"created_at": -1},                 "name": "created_at_desc"},
    {"key": {"status": 1},                      "name": "status"},
    {"key": {"filename": "text"},               "name": "filename_text"},
]


async def ensure_indexes(db) -> None:
    collection = db["analysis_records"]
    for idx in INDEXES:
        key = idx.pop("key")
        await collection.create_index(list(key.items()), **idx)