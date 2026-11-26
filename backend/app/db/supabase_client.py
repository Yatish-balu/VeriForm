"""
VeriForm — Supabase Client Singleton
Used for Storage (file upload) and Auth token verification.
Author: Bhanuprasad
"""

from __future__ import annotations
from functools import lru_cache
from supabase import create_client, Client
from app.core.config import settings


@lru_cache(maxsize=1)
def get_supabase() -> Client:
    """
    Returns a Supabase client initialised with the SERVICE ROLE KEY.
    The service-role key bypasses RLS — keep it backend-only, never expose to frontend.
    """
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)


# ─────────────────────────────────────────────────────────────
# Storage helpers
# ─────────────────────────────────────────────────────────────
def upload_image(file_bytes: bytes, filename: str, content_type: str = "image/jpeg") -> str:
    """
    Uploads a B-form image to the private 'bforms' storage bucket.
    Returns the public URL (or signed URL for private buckets).
    """
    client = get_supabase()
    bucket = settings.STORAGE_BUCKET
    path = f"forms/{filename}"

    client.storage.from_(bucket).upload(
        path=path,
        file=file_bytes,
        file_options={"content-type": content_type, "upsert": "true"},
    )

    # For a private bucket, generate a signed URL valid for 1 hour
    result = client.storage.from_(bucket).create_signed_url(path, expires_in=3600)
    return result.get("signedURL", "")


def delete_image(filename: str) -> None:
    """Removes a file from storage (used when a form is deleted)."""
    get_supabase().storage.from_(settings.STORAGE_BUCKET).remove([f"forms/{filename}"])
