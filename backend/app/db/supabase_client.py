"""
VeriForm — Supabase Client Singleton
Used for Storage (file upload) and Auth token verification.
Author: Bhanuprasad
"""

from __future__ import annotations

from functools import lru_cache
from urllib.parse import unquote, urlsplit
from uuid import UUID

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
def upload_image(file_bytes: bytes, filename: str, content_type: str = "image/jpeg") -> None:
    """Upload a sheet to the private storage bucket."""
    get_supabase().storage.from_(settings.STORAGE_BUCKET).upload(
        path=f"forms/{filename}",
        file=file_bytes,
        file_options={"content-type": content_type},
    )


def sign_form_image(stored_value: str, form_id: UUID) -> str:
    """Sign the object key, including keys stored as legacy signed URLs."""
    prefix = f"/storage/v1/object/sign/{settings.STORAGE_BUCKET}/"
    parsed = urlsplit(stored_value)
    path = stored_value
    if parsed.netloc:
        if parsed.netloc != urlsplit(settings.SUPABASE_URL).netloc or not parsed.path.startswith(prefix):
            raise ValueError("Unexpected form image URL.")
        path = unquote(parsed.path.removeprefix(prefix))
    if not path.startswith(f"forms/{form_id}.") or "/" in path.removeprefix("forms/"):
        raise ValueError("Unexpected form image path.")

    result = get_supabase().storage.from_(settings.STORAGE_BUCKET).create_signed_url(
        path, expires_in=3600
    )
    signed_url = result.get("signedURL")
    if not signed_url:
        raise ValueError("Storage did not return a signed preview URL.")
    return signed_url


def delete_image(filename: str) -> None:
    """Removes a file from storage (used when a form is deleted)."""
    get_supabase().storage.from_(settings.STORAGE_BUCKET).remove([f"forms/{filename}"])
