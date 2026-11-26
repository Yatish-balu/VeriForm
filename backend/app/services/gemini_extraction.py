"""
VeriForm — Gemini Vision Extraction Service  (STUB for Yatish)
Bhanuprasad has defined the ExtractedForm dataclass that the DB layer expects.
Yatish implements the actual Gemini Vision call in this file.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from typing import List, Optional


# ─────────────────────────────────────────────────────────────
# Data contracts  (agreed between Yatish & Bhanuprasad on Day 1)
# ─────────────────────────────────────────────────────────────

@dataclass
class ExtractedCell:
    subject_code: str           # links to a Session
    status: str                 # 'present' | 'absent' | 'unclear'
    confidence: float           # 0.0 – 1.0
    ai_note: Optional[str] = None


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
# Main extraction function  — IMPLEMENT THIS (Yatish)
# ─────────────────────────────────────────────────────────────

async def extract_form(image_bytes: bytes, content_type: str) -> ExtractedForm:
    """
    Call Gemini Vision API with the B-form image and return structured data.

    TODO (Yatish):
      1. Convert image_bytes to base64 / Part for the Gemini SDK.
      2. Build the extraction prompt (see services/prompts/extraction_prompt.txt).
      3. Call client.models.generate_content() with low temperature.
      4. Parse the returned JSON into ExtractedForm.
      5. Handle retries and split-page logic for long sheets.
    """
    # ── Placeholder — replace with real Gemini call ──────────
    raise NotImplementedError(
        "extract_form() not yet implemented. "
        "Yatish: implement Gemini Vision extraction here."
    )
