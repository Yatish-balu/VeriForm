"""
VeriForm — Gemini Vision Extraction Service
Implements Gemini 2.5 Flash vision extraction for B-form attendance sheets.

PDF uploads are passed directly to Gemini as application/pdf.
Raster images (JPEG/PNG) are EXIF-corrected, resized to ≤2000 px, and
blur-scored before being forwarded.
"""

from __future__ import annotations

import asyncio
import json
import logging
import re
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path
from typing import List, Literal, Optional

from google import genai
from google.genai import types as genai_types

from app.core.config import settings
from app.services.preprocess import preprocess_image

logger = logging.getLogger(__name__)

_MODELS            = ("gemini-3.5-flash-lite", "gemini-3.8-flash")
_RETRIES_PER_MODEL = 2   # 1 initial attempt + 1 retry on 503/timeout
_PROMPT_PATH  = Path(__file__).parent / "prompts" / "extraction_prompt.txt"
_PDF_MIME     = "application/pdf"
_RASTER_MIMES = {"image/jpeg", "image/png", "image/webp", "image/gif"}


# ─────────────────────────────────────────────────────────────
# Data contracts  (agreed between Yatish & Bhanuprasad on Day 1)
# ─────────────────────────────────────────────────────────────

@dataclass
class ExtractedCell:
    subject_code: str           # links to a Session
    status: str                 # 'present' | 'absent' | 'unclear'
    confidence: float           # 0.0 – 1.0
    ai_note: Optional[str] = None
    mark_type: Optional[Literal["signature", "absence_mark", "blank", "ambiguous", "unknown"]] = None


@dataclass
class ExtractedStudent:
    sl_no: int
    usn: str
    name: str
    cells: List[ExtractedCell] = field(default_factory=list)


@dataclass
class ExtractedSession:
    exam_date: date
    subject_code: str


@dataclass
class ExtractedForm:
    room_no: str
    exam_name: str
    semester: str
    department: str
    footer_present_raw: Optional[str]
    footer_absent_raw: Optional[str]
    sessions: List[ExtractedSession] = field(default_factory=list)
    students: List[ExtractedStudent] = field(default_factory=list)


# ─────────────────────────────────────────────────────────────
# Internal helpers
# ─────────────────────────────────────────────────────────────

def _build_image_part(image_bytes: bytes, content_type: str) -> genai_types.Part:
    """
    For PDFs → pass raw bytes directly as application/pdf.
    For raster images → run EXIF correction + resize + blur check first,
    then wrap the resulting JPEG bytes as a Part.
    """
    if content_type == _PDF_MIME:
        return genai_types.Part.from_bytes(data=image_bytes, mime_type=_PDF_MIME)

    # Raster path — preprocess before sending
    prep = preprocess_image(image_bytes)
    if prep.blur_score < 100:
        logger.warning(
            "Blurry image detected (Laplacian=%.1f) — extraction accuracy may be reduced.",
            prep.blur_score,
        )
    return genai_types.Part.from_bytes(data=prep.image_bytes, mime_type="image/jpeg")


def _parse_response(raw: str) -> ExtractedForm:
    """
    Strip accidental markdown fences, parse JSON, and build
    the ExtractedForm dataclass hierarchy.
    Raises json.JSONDecodeError / KeyError on malformed output.
    """
    # Defensively strip ```json ... ``` fences
    cleaned = re.sub(r"^```[a-zA-Z]*\s*", "", raw.strip())
    cleaned = re.sub(r"\s*```$", "", cleaned.strip())

    data = json.loads(cleaned)

    sessions = [
        ExtractedSession(
            exam_date=date.fromisoformat(s["exam_date"]),
            subject_code=s["subject_code"],
        )
        for s in data.get("sessions", [])
    ]

    students: List[ExtractedStudent] = []
    for st in data.get("students", []):
        cells = [
            ExtractedCell(
                subject_code=c["subject_code"],
                status=c["status"],           # 'present' | 'absent' | 'unclear'
                confidence=float(c["confidence"]),
                ai_note=c.get("ai_note"),
                mark_type=c.get("mark_type") or "unknown",
            )
            for c in st.get("cells", [])
        ]
        students.append(
            ExtractedStudent(
                sl_no=int(st["sl_no"]),
                usn=st["usn"],
                name=st["name"],
                cells=cells,
            )
        )

    return ExtractedForm(
        room_no=data["room_no"],
        exam_name=data["exam_name"],
        semester=data.get("semester", ""),
        department=data.get("department", ""),
        footer_present_raw=data.get("footer_present_raw"),
        footer_absent_raw=data.get("footer_absent_raw"),
        sessions=sessions,
        students=students,
    )


# ─────────────────────────────────────────────────────────────
# Main extraction function
# ─────────────────────────────────────────────────────────────

def _is_retryable(exc: Exception) -> bool:
    """Return True for 503 / unavailable or timeout errors."""
    if isinstance(exc, (TimeoutError, asyncio.TimeoutError)):
        return True
    msg = str(exc).lower()
    return any(tok in msg for tok in ("503", "unavailable", "timeout", "timed out"))


async def extract_form(image_bytes: bytes, content_type: str) -> ExtractedForm:
    """
    1. Pre-process image (EXIF, resize, blur score) for raster uploads.
       PDFs are forwarded as-is.
    2. Build Gemini Vision request with the B-form extraction prompt.
    3. Call Gemini asynchronously (temperature=0, JSON mode, 30s HTTP timeout),
       iterating through _MODELS with 1 retry per model on 503/timeout.
    4. Parse the returned JSON into an ExtractedForm dataclass.
    """
    image_part  = _build_image_part(image_bytes, content_type)
    prompt_text = _PROMPT_PATH.read_text(encoding="utf-8")

    raw_json: str | None = None
    last_exc: Exception | None = None

    client = genai.Client(
        api_key=settings.GEMINI_API_KEY,
        http_options=genai_types.HttpOptions(timeout=30_000),
    )

    for model in _MODELS:
        for attempt in range(1, _RETRIES_PER_MODEL + 1):
            try:
                response = await client.aio.models.generate_content(
                    model=model,
                    contents=[image_part, prompt_text],
                    config=genai_types.GenerateContentConfig(
                        temperature=0.0,
                        response_mime_type="application/json",
                    ),
                )
                raw_json = response.text
                break
            except Exception as exc:
                last_exc = exc
                logger.warning(
                    "Gemini extraction failed (%s, attempt %d/%d): %s",
                    model, attempt, _RETRIES_PER_MODEL, type(exc).__name__,
                )
                if attempt == _RETRIES_PER_MODEL or not _is_retryable(exc):
                    break
                await asyncio.sleep(1)
        if raw_json:
            break

    if not raw_json:
        raise RuntimeError("Gemini returned no Form-B extraction.") from last_exc

    try:
        return _parse_response(raw_json)
    except (json.JSONDecodeError, KeyError, ValueError) as exc:
        raise RuntimeError("Failed to parse Gemini's Form-B extraction.") from exc
