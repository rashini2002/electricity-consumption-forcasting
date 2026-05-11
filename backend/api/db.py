from __future__ import annotations

import hashlib
import hmac
import os
import secrets
import uuid
from datetime import datetime, timedelta, timezone

from pymongo import DESCENDING, MongoClient
from pymongo.collection import Collection
from pymongo.database import Database
from pymongo.errors import DuplicateKeyError

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://127.0.0.1:27017")
MONGODB_DB = os.getenv("MONGODB_DB", "gridpulse")

_client: MongoClient | None = None


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _get_client() -> MongoClient:
    global _client
    if _client is None:
        _client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=4000)
    return _client


def _get_db() -> Database:
    return _get_client()[MONGODB_DB]


def _users() -> Collection:
    return _get_db()["users"]


def _sessions() -> Collection:
    return _get_db()["sessions"]


def _history() -> Collection:
    return _get_db()["prediction_history"]


def init_db() -> None:
    client = _get_client()
    client.admin.command("ping")

    _users().create_index("username", unique=True)
    _users().create_index("email", unique=True)

    _sessions().create_index("token", unique=True)
    _sessions().create_index("expires_at", expireAfterSeconds=0)

    _history().create_index([("user_id", DESCENDING), ("created_at", DESCENDING)])


def get_db_info() -> dict:
    return {
        "uri": MONGODB_URI,
        "database": MONGODB_DB,
    }


def _hash_password(password: str, salt_hex: str) -> str:
    derived = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        bytes.fromhex(salt_hex),
        120000,
    )
    return derived.hex()


def create_user(username: str, email: str, password: str) -> dict:
    username = username.strip()
    email = email.strip().lower()

    salt_hex = secrets.token_hex(16)
    password_hash = _hash_password(password, salt_hex)

    try:
        now = _utc_now()
        user_id = uuid.uuid4().hex
        result = _users().insert_one(
            {
                "_id": user_id,
                "username": username,
                "email": email,
                "password_salt": salt_hex,
                "password_hash": password_hash,
                "created_at": now,
            }
        )
    except DuplicateKeyError as exc:
        key_info = str(exc).lower()
        if "username" in key_info:
            raise ValueError("Username already exists") from exc
        if "email" in key_info:
            raise ValueError("Email already exists") from exc
        raise ValueError("User already exists") from exc

    return {
        "id": user_id,
        "username": username,
        "email": email,
        "created_at": now.isoformat(),
    }


def authenticate_user(email: str, password: str) -> dict | None:
    email = email.strip().lower()
    row = _users().find_one({"email": email})

    if row is None:
        return None

    expected_hash = _hash_password(password, row.get("password_salt", ""))
    if not hmac.compare_digest(expected_hash, row.get("password_hash", "")):
        return None

    return {
        "id": str(row["_id"]),
        "username": row.get("username", ""),
        "email": row.get("email", ""),
        "created_at": row.get("created_at", _utc_now()).isoformat(),
    }


def create_session(user_id: str, ttl_hours: int = 72) -> str:
    token = secrets.token_urlsafe(36)
    now = _utc_now()
    expires_at = now + timedelta(hours=ttl_hours)

    _sessions().insert_one(
        {
            "token": token,
            "user_id": str(user_id),
            "expires_at": expires_at,
            "created_at": now,
        }
    )

    return token


def get_user_from_token(token: str) -> dict | None:
    if not token:
        return None

    session = _sessions().find_one({"token": token, "expires_at": {"$gt": _utc_now()}})
    if session is None:
        return None

    user_id = session.get("user_id")
    if not user_id:
        return None

    user = _users().find_one({"_id": user_id})
    if user is None:
        return None

    return {
        "id": str(user["_id"]),
        "username": user.get("username", ""),
        "email": user.get("email", ""),
        "created_at": user.get("created_at", _utc_now()).isoformat(),
    }


def clear_session(token: str) -> None:
    if not token:
        return
    _sessions().delete_one({"token": token})


def save_prediction_history(user_id: str, request_payload: dict, response_payload: dict) -> None:
    forecast = response_payload.get("forecast", {})
    billing = response_payload.get("billing", {})

    _history().insert_one(
        {
            "user_id": str(user_id),
            "month": request_payload.get("month"),
            "district": request_payload.get("district"),
            "prediction_kwh": forecast.get("prediction_kwh"),
            "estimated_bill_lkr": billing.get("estimated_bill_lkr"),
            "request_payload": request_payload,
            "response_payload": response_payload,
            "created_at": _utc_now(),
        }
    )


def list_prediction_history(user_id: str, limit: int = 20) -> list[dict]:
    safe_limit = max(1, min(int(limit), 200))

    rows = list(
        _history()
        .find({"user_id": str(user_id)})
        .sort("created_at", DESCENDING)
        .limit(safe_limit)
    )

    return [
        {
            "id": str(row["_id"]),
            "month": row.get("month"),
            "district": row.get("district"),
            "prediction_kwh": row.get("prediction_kwh"),
            "estimated_bill_lkr": row.get("estimated_bill_lkr"),
            "created_at": row.get("created_at", _utc_now()).isoformat(),
            "request_payload": row.get("request_payload", {}),
            "response_payload": row.get("response_payload", {}),
        }
        for row in rows
    ]
