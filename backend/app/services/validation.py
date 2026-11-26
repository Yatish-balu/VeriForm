"""
VeriForm — Validation & Doubt Generation Service  (STUB for Yatish)
Called by forms.py route after extraction.
Returns a list of raw doubt dicts ready for svc.save_doubts_bulk().
"""

from __future__ import annotations

from typing import List, Optional
from app.core.config import settings
from app.services.gemini_extraction import ExtractedForm
from app.models.orm import Attendance


def generate_doubts(
    extracted: ExtractedForm,
    attendance_objs: List[Attendance],
) -> List[dict]:
    """
    Run all validation rules against the extracted data and saved attendance rows.
    Returns a list of doubt dicts: { attendance_id, type, message, ai_guess }

    TODO (Yatish): implement each rule below.

    Rules to implement:
      1. LOW_CONFIDENCE  — cell confidence < settings.CONFIDENCE_THRESHOLD (0.75)
      2. AB_MARK         — cell status is 'absent' and ai_note contains 'Ab' or 'cross'
      3. FOOTER_MISMATCH — counted present != footer_present_raw (handle '30+1', 'NIL')
      4. UNUSUAL_FOOTER  — footer_present_raw contains non-numeric characters
      5. UNREADABLE_USN  — student.usn contains '?' or is suspiciously short
      6. PRESENT_THEN_ABSENT — student present in an earlier session, absent in a later one
    """
    doubts: List[dict] = []

    # ── Rule 1: Low confidence ───────────────────────────────
    for att in attendance_objs:
        if att.confidence is not None and att.confidence < settings.CONFIDENCE_THRESHOLD:
            doubts.append({
                "attendance_id": att.id,
                "type": "low_confidence",
                "message": (
                    f"Confidence {att.confidence:.0%} is below threshold — "
                    f"is this a signature? ({att.ai_note or 'no note'})"
                ),
                "ai_guess": att.status,
            })

    # ── Rule 2: Ab / cross mark ──────────────────────────────
    for att in attendance_objs:
        note = (att.ai_note or "").lower()
        if att.status == "absent" and any(kw in note for kw in ("ab", "cross", "scribble", "red")):
            doubts.append({
                "attendance_id": att.id,
                "type": "ab_mark",
                "message": f"Marked absent or unclear — please confirm. Note: {att.ai_note}",
                "ai_guess": att.status,
            })

    # ── Rules 3–6: TODO (Yatish) ─────────────────────────────
    # Implement footer mismatch, unusual footer, unreadable USN,
    # and present-then-absent pattern here.

    return doubts
