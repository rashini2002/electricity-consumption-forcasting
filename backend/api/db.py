from __future__ import annotations

import hashlib
import hmac
import json
import secrets
import sqlite3
from datetime import datetime, timedelta, timezone
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]
DB_PATH = BASE_DIR / "data" / "gridpulse.sqlite3"


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _db_connect() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db() -> None:
    with _db_connect() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL UNIQUE,
                email TEXT NOT NULL UNIQUE,
                password_salt TEXT NOT NULL,
                password_hash TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS sessions (
                token TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL,
                expires_at TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS prediction_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                month INTEGER,
                district TEXT,
                prediction_kwh REAL,
                estimated_bill_lkr REAL,
                request_payload TEXT NOT NULL,
                response_payload TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_history_user_created
                ON prediction_history(user_id, created_at DESC);
            """
        )


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
        with _db_connect() as conn:
            cur = conn.execute(
                """
                INSERT INTO users(username, email, password_salt, password_hash, created_at)
                VALUES(?, ?, ?, ?, ?)
                """,
                (username, email, salt_hex, password_hash, _utc_now_iso()),
            )
            user_id = cur.lastrowid
            row = conn.execute(
                "SELECT id, username, email, created_at FROM users WHERE id = ?",
                (user_id,),
            ).fetchone()
    except sqlite3.IntegrityError as exc:
        message = str(exc).lower()
        if "username" in message:
            raise ValueError("Username already exists") from exc
        if "email" in message:
            raise ValueError("Email already exists") from exc
        raise ValueError("User already exists") from exc

    return dict(row)


def authenticate_user(email: str, password: str) -> dict | None:
    email = email.strip().lower()
    with _db_connect() as conn:
        row = conn.execute(
            "SELECT id, username, email, password_salt, password_hash, created_at FROM users WHERE email = ?",
            (email,),
        ).fetchone()

    if row is None:
        return None

    expected_hash = _hash_password(password, row["password_salt"])
    if not hmac.compare_digest(expected_hash, row["password_hash"]):
        return None

    return {
        "id": row["id"],
        "username": row["username"],
        "email": row["email"],
        "created_at": row["created_at"],
    }


def create_session(user_id: int, ttl_hours: int = 72) -> str:
    token = secrets.token_urlsafe(36)
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(hours=ttl_hours)

    with _db_connect() as conn:
        conn.execute(
            """
            INSERT INTO sessions(token, user_id, expires_at, created_at)
            VALUES(?, ?, ?, ?)
            """,
            (token, user_id, expires_at.isoformat(), now.isoformat()),
        )

    return token


def get_user_from_token(token: str) -> dict | None:
    if not token:
        return None

    with _db_connect() as conn:
        conn.execute(
            "DELETE FROM sessions WHERE expires_at <= ?",
            (_utc_now_iso(),),
        )
        row = conn.execute(
            """
            SELECT u.id, u.username, u.email, u.created_at
            FROM sessions s
            JOIN users u ON u.id = s.user_id
            WHERE s.token = ? AND s.expires_at > ?
            """,
            (token, _utc_now_iso()),
        ).fetchone()

    return dict(row) if row else None


def clear_session(token: str) -> None:
    if not token:
        return
    with _db_connect() as conn:
        conn.execute("DELETE FROM sessions WHERE token = ?", (token,))


def save_prediction_history(user_id: int, request_payload: dict, response_payload: dict) -> None:
    forecast = response_payload.get("forecast", {})
    billing = response_payload.get("billing", {})

    with _db_connect() as conn:
        conn.execute(
            """
            INSERT INTO prediction_history(
                user_id,
                month,
                district,
                prediction_kwh,
                estimated_bill_lkr,
                request_payload,
                response_payload,
                created_at
            ) VALUES(?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                user_id,
                request_payload.get("month"),
                request_payload.get("district"),
                forecast.get("prediction_kwh"),
                billing.get("estimated_bill_lkr"),
                json.dumps(request_payload),
                json.dumps(response_payload),
                _utc_now_iso(),
            ),
        )


def list_prediction_history(user_id: int, limit: int = 20) -> list[dict]:
    safe_limit = max(1, min(int(limit), 200))

    with _db_connect() as conn:
        rows = conn.execute(
            """
            SELECT id, month, district, prediction_kwh, estimated_bill_lkr, created_at,
                   request_payload, response_payload
            FROM prediction_history
            WHERE user_id = ?
            ORDER BY created_at DESC
            LIMIT ?
            """,
            (user_id, safe_limit),
        ).fetchall()

    history = []
    for row in rows:
        history.append(
            {
                "id": row["id"],
                "month": row["month"],
                "district": row["district"],
                "prediction_kwh": row["prediction_kwh"],
                "estimated_bill_lkr": row["estimated_bill_lkr"],
                "created_at": row["created_at"],
                "request_payload": json.loads(row["request_payload"]),
                "response_payload": json.loads(row["response_payload"]),
            }
        )

    return history
