import os
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from pymongo import MongoClient

_async_client: AsyncIOMotorClient | None = None


def get_client() -> AsyncIOMotorClient:
    global _async_client
    if _async_client is None:
        uri = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
        _async_client = AsyncIOMotorClient(uri)
    return _async_client


def get_db() -> AsyncIOMotorDatabase:
    client = get_client()
    db_name = os.getenv("MONGODB_DB", "video_analysis")
    return client[db_name]


async def close_client() -> None:
    global _async_client
    if _async_client is not None:
        _async_client.close()
        _async_client = None


def get_sync_col(collection: str = "AnalysisHistory"):
    uri     = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
    db_name = os.getenv("MONGODB_DB", "VisionCore")
    return MongoClient(uri)[db_name][collection]


def upsert_record(job_id: str, fields: dict, collection: str = "AnalysisHistory") -> None:
    get_sync_col(collection).update_one(
        {"job_id": job_id},
        {"$set": fields},
        upsert=True,
    )


def get_record(job_id: str, collection: str = "AnalysisHistory") -> dict | None:
    return get_sync_col(collection).find_one({"job_id": job_id})