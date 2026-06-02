import os
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from pymongo import MongoClient
import bcrypt
import jwt
from datetime import datetime, timedelta

MONGO_URI  = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
DB_NAME    = "VisionCore"
COLLECTION = "Users"
JWT_SECRET = os.getenv("JWT_SECRET", "supersecretkey")

client = MongoClient(MONGO_URI)
users  = client[DB_NAME][COLLECTION]

router = APIRouter(prefix="/auth", tags=["auth"])

class AuthPayload(BaseModel):
    username: str
    password: str
    email: str | None = None

@router.post("/register")
def register(body: AuthPayload):
    if not body.email:
        raise HTTPException(400, "Email is required")
    if users.find_one({"username": body.username}):
        raise HTTPException(409, "User already exists")
    if users.find_one({"email": body.email}):
        raise HTTPException(409, "Email already in use")
    hashed = bcrypt.hashpw(body.password.encode(), bcrypt.gensalt())
    users.insert_one({"username": body.username, "email": body.email, "password": hashed})
    return {"message": "User created"}

router.post("/login")
def login(body: AuthPayload):
    user = users.find_one({"username": body.username})
    if not user or not bcrypt.checkpw(body.password.encode(), user["password"]):
        raise HTTPException(401, "Invalid credentials")
    token = jwt.encode(
        {"sub": body.username, "id": str(user["_id"]), "exp": datetime.utcnow() + timedelta(days=1)},
        JWT_SECRET, algorithm="HS256"
    )
    return {"token": token}

