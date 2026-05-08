import os
from pymongo import MongoClient
from dotenv import load_dotenv
load_dotenv()
MONGO_URI  = os.getenv("MONGODB_URI", "mongodb://localhost:27017")

def _col():
    return MongoClient(MONGO_URI)["VisionCore"]["AnalysisHistory"]

def get_history() -> list:
    docs = list(_col().find().sort("analysed_at", -1))
    for doc in docs:
        doc["_id"] = str(doc["_id"])
    return docs

def create_record(record: dict) -> str:
    result = _col().insert_one(record)
    return str(result.inserted_id)

def update_record(job_id: str, fields: dict) -> None:
    _col().update_one({"job_id": job_id}, {"$set": fields})

def get_record_by_job_id(job_id: str) -> dict | None:
    doc = _col().find_one({"job_id": job_id})
    if doc:
        doc["_id"] = str(doc["_id"])
    return doc

def delete_records(job_ids: list[str]) -> int:
    result = _col().delete_many({"job_id": {"$in": job_ids}})
    return result.deleted_count

def get_history_paginated(
    page=1,
    page_size=10,
    status="all",
    sort_by="analysed_at",
    sort_order="desc"
):
    query = {}

    if status != "all":
        query["status"] = status

    sort_direction = -1 if sort_order == "desc" else 1

    cursor = (
        _col()
        .find(query)
        .sort(sort_by, sort_direction)
        .skip((page - 1) * page_size)
        .limit(page_size)
    )

    docs = list(cursor)

    for doc in docs:
        doc["_id"] = str(doc["_id"])

    total = _col().count_documents(query)

    return {
        "data": docs,
        "total": total,
        "page": page,
        "page_size": page_size,
    }

def get_aggregate():
    pipeline = [
        {
            "$group": {
                "_id": None,
                "total_jobs": {"$sum": 1},
                "total_detections": {"$sum": {"$ifNull": ["$total_detections", 0]}},
                "total_unique": {"$sum": {"$ifNull": ["$total_unique", 0]}},
                "total_frames": {"$sum": {"$ifNull": ["$total_frames", 0]}},
                "avg_elapsed": {"$avg": {"$ifNull": ["$elapsed_time", 0]}},
                "max_elapsed": {"$max": {"$ifNull": ["$elapsed_time", 0]}},
                "first_analysed": {"$min": "$analysed_at"},
                "last_analysed": {"$max": "$analysed_at"},
            }
        }
    ]

    result = list(_col().aggregate(pipeline))

    return result[0] if result else {}

def get_job_stats(job_id: str):
    doc = _col().find_one({"job_id": job_id})

    if not doc:
        return None

    return {
        "job_id": job_id,
        "total_detections": doc.get("total_detections", 0),
        "duration": doc.get("duration", 0),
        "status": doc.get("status"),
    }

def get_history_details(job_id: str):
    doc = _col().find_one({"job_id": job_id}, {"_id": 0})
    return doc or {}