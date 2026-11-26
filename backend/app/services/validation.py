"""
VeriForm — Validation & Doubt Generation Service
Called by forms.py route after extraction.
Returns a list of raw doubt dicts ready for svc.save_doubts_bulk().
"""

from __future__ import annotations

import re
from collections import defaultdict
from typing import Dict, List, Optional, Tuple
from uuid import UUID

from app.core.config import settings
from app.models.orm import Attendance
from app.services.gemini_extraction import ExtractedForm

_USN_RE = re.compile(r"^1DS\d{2}[A-Z]{2}\d{3}$")
_AB_NOTE_RE = re.compile(r"\bab\b|cross|scribbl", re.IGNORECASE)
_NUMERIC_RE = re.compile(r"\d+")
_SUM_FOOTER_RE = re.compile(r"\d+(?:\s*\+\s*\d+)*")
_UNREADABLE_NAMES = {"unreadable", "illegible", "unknown", "n/a", "na", "-"}


def _parse_footer_int(raw: Optional[str]) -> Optional[int]:
    """Parse an integer count from a footer string (handles 'NIL' and '30+1')."""
    if raw is None:
        return None
    text = raw.strip()
    if not text:
        return None
    if text.upper() == "NIL":
        return 0
    if _SUM_FOOTER_RE.fullmatch(text):
        return sum(int(part.strip()) for part in text.split("+"))
    return None


def _is_unusual_footer(raw: Optional[str]) -> bool:
    """Return True if a non-empty footer string contains non-numeric characters."""
    if raw is None:
        return False
    text = raw.strip()
    if not text:
        return False
    return not bool(_NUMERIC_RE.fullmatch(text))


def _build_attendance_id_map(
    extracted: ExtractedForm,
    attendance_objs: List[Attendance],
) -> Dict[Tuple[int, int], UUID]:
    """Map (student_index, cell_index) to saved Attendance.id when available."""
    if not attendance_objs:
        return {}

    valid_subjects = {s.subject_code for s in extracted.sessions}
    filtered_pairs: List[Tuple[int, int]] = []
    all_pairs: List[Tuple[int, int]] = []

    for s_idx, student in enumerate(extracted.students):
        for c_idx, cell in enumerate(student.cells):
            all_pairs.append((s_idx, c_idx))
            if not valid_subjects or cell.subject_code in valid_subjects:
                filtered_pairs.append((s_idx, c_idx))

    if len(filtered_pairs) == len(attendance_objs):
        return {
            pair: att.id
            for pair, att in zip(filtered_pairs, attendance_objs)
            if att.id is not None
        }

    if len(all_pairs) == len(attendance_objs):
        return {
            pair: att.id
            for pair, att in zip(all_pairs, attendance_objs)
            if att.id is not None
        }

    by_sl_no: Dict[Optional[int], List[Attendance]] = defaultdict(list)
    for att in attendance_objs:
        by_sl_no[att.sl_no].append(att)

    mapping: Dict[Tuple[int, int], UUID] = {}
    for s_idx, student in enumerate(extracted.students):
        group = by_sl_no.get(student.sl_no, [])
        valid_cells = [
            c_idx
            for c_idx, cell in enumerate(student.cells)
            if not valid_subjects or cell.subject_code in valid_subjects
        ]
        for c_idx, att in zip(valid_cells, group):
            if att.id is not None:
                mapping[(s_idx, c_idx)] = att.id
    return mapping


def generate_doubts(
    extracted: ExtractedForm,
    attendance_objs: List[Attendance],
) -> List[dict]:
    """
    Run all 6 validation rules against the extracted data and saved attendance rows.
    Returns a list of doubt dicts: { attendance_id, type, message, ai_guess }.
    """
    doubts: List[dict] = []
    att_id_map = _build_attendance_id_map(extracted, attendance_objs)

    # ── Rules 1, 2, 5: Per-student and per-cell checks ───────
    for s_idx, student in enumerate(extracted.students):
        usn = (student.usn or "").strip()
        name = (student.name or "").strip()
        if (
            not _USN_RE.match(usn)
            or not name
            or "?" in name
            or name.lower() in _UNREADABLE_NAMES
        ):
            doubts.append({
                "attendance_id": None,
                "type": "unreadable_usn",
                "message": "Please confirm USN",
                "ai_guess": None,
            })

        for c_idx, cell in enumerate(student.cells):
            att_id = att_id_map.get((s_idx, c_idx))

            # 1. Low confidence or unclear status
            if cell.confidence < settings.CONFIDENCE_THRESHOLD or cell.status == "unclear":
                doubts.append({
                    "attendance_id": att_id,
                    "type": "low_confidence",
                    "message": "Is this a signature?",
                    "ai_guess": cell.status,
                })

            # 2. ai_note mentions "Ab", cross, or scribble
            if cell.ai_note and _AB_NOTE_RE.search(cell.ai_note):
                doubts.append({
                    "attendance_id": att_id,
                    "type": "ab_mark",
                    "message": "Marked absent or unclear, please confirm",
                    "ai_guess": cell.status,
                })

    # ── Rule 3: Footer present count mismatch ────────────────
    footer_int = _parse_footer_int(extracted.footer_present_raw)
    if footer_int is not None:
        counted = sum(
            1
            for student in extracted.students
            for cell in student.cells
            if cell.status == "present"
        )
        if counted != footer_int:
            footer_raw = (extracted.footer_present_raw or "").strip()
            doubts.append({
                "attendance_id": None,
                "type": "footer_mismatch",
                "message": f"Footer says {footer_raw} but I counted {counted}",
                "ai_guess": None,
            })

    # ── Rule 4: Unusual non-numeric footer ───────────────────
    if (
        _is_unusual_footer(extracted.footer_present_raw)
        or _is_unusual_footer(extracted.footer_absent_raw)
    ):
        doubts.append({
            "attendance_id": None,
            "type": "unusual_footer",
            "message": "Unusual footer, please explain",
            "ai_guess": None,
        })

    # ── Rule 6: Present in earlier session, absent in later ──
    ordered_sessions = sorted(
        enumerate(extracted.sessions),
        key=lambda item: (item[1].exam_date, item[0]),
    )
    ordered_codes = [session.subject_code for _, session in ordered_sessions]
    if len(ordered_codes) >= 2:
        for s_idx, student in enumerate(extracted.students):
            cell_by_subj = {
                cell.subject_code: (c_idx, cell)
                for c_idx, cell in enumerate(student.cells)
            }
            seen_present = False
            for code in ordered_codes:
                entry = cell_by_subj.get(code)
                if entry is None:
                    continue
                c_idx, cell = entry
                if cell.status == "present":
                    seen_present = True
                elif cell.status == "absent" and seen_present:
                    doubts.append({
                        "attendance_id": att_id_map.get((s_idx, c_idx)),
                        "type": "present_then_absent",
                        "message": "Check this student",
                        "ai_guess": cell.status,
                    })
                    break

    return doubts
