"""
VeriForm — Application Configuration
Loads settings from the .env file via pydantic-settings.
Author: Bhanuprasad
"""

from __future__ import annotations
from functools import lru_cache
from typing import List
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # ── Supabase ─────────────────────────────────────────────
    SUPABASE_URL: str
    SUPABASE_ANON_KEY: str
    SUPABASE_SERVICE_ROLE_KEY: str

    # ── PostgreSQL (direct connection for SQLAlchemy) ─────────
    # Format: postgresql+asyncpg://postgres:<password>@<host>:5432/postgres
    DATABASE_URL: str

    @field_validator("SUPABASE_URL", mode="before")
    @classmethod
    def normalize_supabase_url(cls, v: str) -> str:
        """Strip trailing /rest/v1 or / if pasted from API docs."""
        if isinstance(v, str):
            v = v.strip().rstrip("/")
            if v.endswith("/rest/v1"):
                v = v[: -len("/rest/v1")]
        return v

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def ensure_asyncpg_scheme(cls, v: str) -> str:
        """Normalize standard postgres:// or postgresql:// URIs for SQLAlchemy async."""
        if isinstance(v, str):
            if v.startswith("postgres://"):
                return "postgresql+asyncpg://" + v[len("postgres://"):]
            if v.startswith("postgresql://"):
                return "postgresql+asyncpg://" + v[len("postgresql://"):]
        return v

    # ── Gemini API ────────────────────────────────────────────
    GEMINI_API_KEY: str

    # ── Storage ───────────────────────────────────────────────
    STORAGE_BUCKET: str = "bforms"

    # ── AI thresholds ─────────────────────────────────────────
    CONFIDENCE_THRESHOLD: float = 0.75   # cells below this become doubts

    # ── CORS ──────────────────────────────────────────────────
    ALLOWED_ORIGINS: List[str] = ["http://localhost:5173", "http://localhost:3000"]

    # ── App ───────────────────────────────────────────────────
    APP_NAME: str = "VeriForm API"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()


# Singleton — import this everywhere
settings: Settings = get_settings()
