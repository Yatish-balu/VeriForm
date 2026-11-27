"""
VeriForm — Unit tests for validation.generate_doubts().
Run with: pytest backend/tests/test_validation.py -v
"""

from __future__ import annotations

import uuid
from datetime import date
from types import SimpleNamespace
from typing import List, Optional

from app.services.gemini_extraction import (
    ExtractedCell,
    ExtractedForm,
    ExtractedSession,
    ExtractedStudent,
)
from app.services.validation import generate_doubts


def _make_attendance(
    *,
    sl_no: int,
    status: str = "present",
    confidence: float = 0.95,
    ai_note: Optional[str] = None,
) -> SimpleNamespace:
    return SimpleNamespace(
        id=uuid.uuid4(),
        sl_no=sl_no,
        status=status,
        confidence=confidence,
        ai_note=ai_note,
    )


def _make_form(
    *,
    sessions: Optional[List[ExtractedSession]] = None,
    students: Optional[List[ExtractedStudent]] = None,
    footer_present_raw: Optional[str] = "1",
    footer_absent_raw: Optional[str] = "0",
) -> ExtractedForm:
    return ExtractedForm(
        room_no="101",
        exam_name="5th Sem CIE-1",
        semester="5",
        department="CS",
        footer_present_raw=footer_present_raw,
        footer_absent_raw=footer_absent_raw,
        sessions=sessions
        if sessions is not None
        else [ExtractedSession(exam_date=date(2026, 1, 10), subject_code="21CS51")],
        students=students if students is not None else [],
    )


def test_clean_form_returns_no_doubts() -> None:
    form = _make_form(
        students=[
            ExtractedStudent(
                sl_no=1,
                usn="1DS21CS001",
                name="Aarav Sharma",
                cells=[ExtractedCell(subject_code="21CS51", status="present", confidence=0.95)],
            ),
            ExtractedStudent(
                sl_no=2,
                usn="1DS21CS002",
                name="Diya Nair",
                cells=[ExtractedCell(subject_code="21CS51", status="absent", confidence=0.90)],
            ),
        ],
        footer_present_raw="1",
        footer_absent_raw="1",
    )
    atts = [
        _make_attendance(sl_no=1, status="present", confidence=0.95),
        _make_attendance(sl_no=2, status="absent", confidence=0.90),
    ]

    assert generate_doubts(form, atts) == []


def test_low_confidence_and_unclear_status_emit_low_confidence() -> None:
    form = _make_form(
        students=[
            ExtractedStudent(
                sl_no=1,
                usn="1DS21CS001",
                name="Aarav Sharma",
                cells=[ExtractedCell(subject_code="21CS51", status="present", confidence=0.60)],
            ),
            ExtractedStudent(
                sl_no=2,
                usn="1DS21CS002",
                name="Diya Nair",
                cells=[ExtractedCell(subject_code="21CS51", status="unclear", confidence=0.90)],
            ),
        ],
        footer_present_raw="1",
        footer_absent_raw="0",
    )
    att_low = _make_attendance(sl_no=1, status="present", confidence=0.60)
    att_unclear = _make_attendance(sl_no=2, status="unclear", confidence=0.90)

    doubts = generate_doubts(form, [att_low, att_unclear])

    assert len(doubts) == 2
    assert doubts[0] == {
        "attendance_id": att_low.id,
        "type": "low_confidence",
        "message": "Is this a signature?",
        "ai_guess": "present",
    }
    assert doubts[1] == {
        "attendance_id": att_unclear.id,
        "type": "low_confidence",
        "message": "Is this a signature?",
        "ai_guess": "unclear",
    }


def test_ai_note_ab_cross_or_scribble_emits_ab_mark() -> None:
    form = _make_form(
        students=[
            ExtractedStudent(
                sl_no=1,
                usn="1DS21CS001",
                name="Aarav Sharma",
                cells=[ExtractedCell(subject_code="21CS51", status="absent", confidence=0.90, ai_note="Ab written")],
            ),
            ExtractedStudent(
                sl_no=2,
                usn="1DS21CS002",
                name="Diya Nair",
                cells=[ExtractedCell(subject_code="21CS51", status="absent", confidence=0.90, ai_note="crossed out")],
            ),
            ExtractedStudent(
                sl_no=3,
                usn="1DS21CS003",
                name="Kabir Rao",
                cells=[ExtractedCell(subject_code="21CS51", status="present", confidence=0.90, ai_note="heavy scribble")],
            ),
        ],
        footer_present_raw="1",
        footer_absent_raw="2",
    )
    atts = [
        _make_attendance(sl_no=1, status="absent", confidence=0.90, ai_note="Ab written"),
        _make_attendance(sl_no=2, status="absent", confidence=0.90, ai_note="crossed out"),
        _make_attendance(sl_no=3, status="present", confidence=0.90, ai_note="heavy scribble"),
    ]

    doubts = generate_doubts(form, atts)

    assert len(doubts) == 3
    for doubt, att in zip(doubts, atts):
        assert doubt["attendance_id"] == att.id
        assert doubt["type"] == "ab_mark"
        assert doubt["message"] == "Marked absent or unclear, please confirm"
        assert doubt["ai_guess"] == att.status


def test_absence_mark_and_unknown_mark_are_reviewed_without_ai_note() -> None:
    mark_types = ("absence_mark", "unknown", "blank")
    form = _make_form(
        students=[
            ExtractedStudent(
                sl_no=index,
                usn=f"1DS21CS{index:03}",
                name=f"Sample Student {index}",
                cells=[ExtractedCell("21CS51", "absent", 0.99, mark_type=mark_type)],
            )
            for index, mark_type in enumerate(mark_types, 1)
        ],
        footer_present_raw="0",
        footer_absent_raw="3",
    )
    attendance = [_make_attendance(sl_no=index, status="absent") for index in range(1, 4)]

    doubts = generate_doubts(form, attendance)

    assert [(doubt["attendance_id"], doubt["type"]) for doubt in doubts] == [
        (attendance[0].id, "ab_mark"),
        (attendance[1].id, "unconfirmed_absence"),
    ]


def test_footer_mismatch_emits_footer_mismatch() -> None:
    form = _make_form(
        students=[
            ExtractedStudent(
                sl_no=1,
                usn="1DS21CS001",
                name="Aarav Sharma",
                cells=[ExtractedCell(subject_code="21CS51", status="present", confidence=0.95)],
            ),
        ],
        footer_present_raw="5",
        footer_absent_raw="0",
    )
    atts = [_make_attendance(sl_no=1, status="present", confidence=0.95)]

    doubts = generate_doubts(form, atts)

    assert doubts == [
        {
            "attendance_id": None,
            "type": "footer_mismatch",
            "message": "Footer says 5 but I counted 1",
            "ai_guess": None,
        }
    ]


def test_unusual_footer_emits_unusual_footer() -> None:
    form = _make_form(
        students=[
            ExtractedStudent(
                sl_no=1,
                usn="1DS21CS001",
                name="Aarav Sharma",
                cells=[ExtractedCell(subject_code="21CS51", status="present", confidence=0.95)],
            ),
            ExtractedStudent(
                sl_no=2,
                usn="1DS21CS002",
                name="Diya Nair",
                cells=[ExtractedCell(subject_code="21CS51", status="present", confidence=0.95)],
            ),
        ],
        footer_present_raw="1+1",
        footer_absent_raw="0",
    )
    atts = [
        _make_attendance(sl_no=1, status="present", confidence=0.95),
        _make_attendance(sl_no=2, status="present", confidence=0.95),
    ]

    doubts = generate_doubts(form, atts)

    assert doubts == [
        {
            "attendance_id": None,
            "type": "unusual_footer",
            "message": "Unusual footer, please explain",
            "ai_guess": None,
        }
    ]


def test_invalid_usn_or_unreadable_name_emits_unreadable_usn() -> None:
    form = _make_form(
        students=[
            ExtractedStudent(
                sl_no=1,
                usn="1MS21CS001",
                name="Aarav Sharma",
                cells=[ExtractedCell(subject_code="21CS51", status="present", confidence=0.95)],
            ),
            ExtractedStudent(
                sl_no=2,
                usn="1DS21CS002",
                name="   ",
                cells=[ExtractedCell(subject_code="21CS51", status="present", confidence=0.95)],
            ),
            ExtractedStudent(
                sl_no=3,
                usn="1DS21CS003",
                name="Unreadable",
                cells=[ExtractedCell(subject_code="21CS51", status="present", confidence=0.95)],
            ),
        ],
        footer_present_raw="3",
        footer_absent_raw="0",
    )
    atts = [
        _make_attendance(sl_no=1, status="present", confidence=0.95),
        _make_attendance(sl_no=2, status="present", confidence=0.95),
        _make_attendance(sl_no=3, status="present", confidence=0.95),
    ]

    doubts = generate_doubts(form, atts)

    assert doubts == [
        {
            "attendance_id": None,
            "type": "unreadable_usn",
            "message": "Please confirm USN",
            "ai_guess": None,
        },
        {
            "attendance_id": None,
            "type": "unreadable_usn",
            "message": "Please confirm USN",
            "ai_guess": None,
        },
        {
            "attendance_id": None,
            "type": "unreadable_usn",
            "message": "Please confirm USN",
            "ai_guess": None,
        },
    ]


def test_present_then_absent_across_sessions_emits_present_then_absent() -> None:
    form = _make_form(
        sessions=[
            ExtractedSession(exam_date=date(2026, 1, 10), subject_code="21CS51"),
            ExtractedSession(exam_date=date(2026, 1, 11), subject_code="21CS52"),
        ],
        students=[
            ExtractedStudent(
                sl_no=1,
                usn="1DS21CS001",
                name="Aarav Sharma",
                cells=[
                    ExtractedCell(subject_code="21CS51", status="present", confidence=0.95),
                    ExtractedCell(subject_code="21CS52", status="absent", confidence=0.95),
                ],
            ),
        ],
        footer_present_raw="1",
        footer_absent_raw="1",
    )
    att_present = _make_attendance(sl_no=1, status="present", confidence=0.95)
    att_absent = _make_attendance(sl_no=1, status="absent", confidence=0.95)

    doubts = generate_doubts(form, [att_present, att_absent])

    assert doubts == [
        {
            "attendance_id": att_absent.id,
            "type": "present_then_absent",
            "message": "Check this student",
            "ai_guess": "absent",
        }
    ]
