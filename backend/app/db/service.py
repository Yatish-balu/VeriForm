"""
VeriForm — Database Service Layer
All database operations go through this module.
Routes and services NEVER write raw SQL — they call these functions.
Author: Bhanuprasad
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Dict, List, Optional
from uuid import UUID

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.orm import Attendance, ChatMessage, Doubt, Form, Session, Student


# ══════════════════════════════════════════════════════════════
# FORMS
# ══════════════════════════════════════════════════════════════

async def save_form(
    db: AsyncSession,
    *,
    room_no: str,
    exam_name: str,
    semester: str,
    department: str,
    image_url: Optional[str] = None,
    footer_present_raw: Optional[str] = None,
    footer_absent_raw: Optional[str] = None,
    uploaded_by: Optional[UUID] = None,
) -> Form:
    """Insert a new form row (status=processing)."""
    form = Form(
        room_no=room_no,
        exam_name=exam_name,
        semester=semester,
        department=department,
        image_url=image_url,
        footer_present_raw=footer_present_raw,
        footer_absent_raw=footer_absent_raw,
        uploaded_by=uploaded_by,
        status="processing",
    )
    db.add(form)
    await db.flush()   # get the generated id without committing
    return form


async def get_form(db: AsyncSession, form_id: UUID) -> Optional[Form]:
    """Fetch a form with all related sessions, attendance (+ student), and doubts."""
    stmt = (
        select(Form)
        .where(Form.id == form_id)
        .options(
            selectinload(Form.sessions),
            selectinload(Form.attendance).selectinload(Attendance.student),
            selectinload(Form.doubts),
        )
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def list_forms(
    db: AsyncSession,
    uploaded_by: Optional[UUID] = None,
    status: Optional[str] = None,
) -> List[Dict]:
    """
    Returns a lightweight list of forms with open-doubt counts.
    Optionally filtered by uploader or status.
    """
    stmt = select(
        Form.id,
        Form.room_no,
        Form.exam_name,
        Form.status,
        Form.created_at,
        func.count(Doubt.id).filter(Doubt.resolved == False).label("open_doubts"),  # noqa: E712
    ).outerjoin(Doubt, Doubt.form_id == Form.id).group_by(Form.id)

    if uploaded_by:
        stmt = stmt.where(Form.uploaded_by == uploaded_by)
    if status:
        stmt = stmt.where(Form.status == status)

    stmt = stmt.order_by(Form.created_at.desc())
    result = await db.execute(stmt)
    return [row._asdict() for row in result.all()]


async def set_form_status(db: AsyncSession, form_id: UUID, status: str) -> Optional[Form]:
    """Update a form's status field."""
    await db.execute(
        update(Form).where(Form.id == form_id).values(status=status)
    )
    return await get_form(db, form_id)


async def set_form_image_url(db: AsyncSession, form_id: UUID, image_url: str) -> None:
    """Attach a storage URL to an existing form."""
    await db.execute(
        update(Form).where(Form.id == form_id).values(image_url=image_url)
    )


# ══════════════════════════════════════════════════════════════
# SESSIONS
# ══════════════════════════════════════════════════════════════

async def save_sessions(
    db: AsyncSession,
    form_id: UUID,
    sessions: List[Dict],   # [{"exam_date": date, "subject_code": str}, ...]
) -> List[Session]:
    """Bulk-insert exam session columns for a form."""
    objs = [
        Session(form_id=form_id, exam_date=s["exam_date"], subject_code=s["subject_code"])
        for s in sessions
    ]
    db.add_all(objs)
    await db.flush()
    return objs


async def get_sessions(db: AsyncSession, form_id: UUID) -> List[Session]:
    result = await db.execute(select(Session).where(Session.form_id == form_id))
    return list(result.scalars().all())


# ══════════════════════════════════════════════════════════════
# STUDENTS
# ══════════════════════════════════════════════════════════════

def _extract_branch(usn: str) -> str:
    """
    Derive branch from USN.
    Example: '1DS23CY037' → 'CY', '1DS22CS010' → 'CS'
    Convention: characters at index 5-6 after the batch digits.
    """
    try:
        # Pattern: 1DS<2-digit-year><BRANCH><roll>
        # e.g.    1 D S 2 3 C Y 0 3 7
        #         0 1 2 3 4 5 6 7 8 9
        return usn[5:7].upper()
    except IndexError:
        return "UNKNOWN"


async def save_or_get_student(
    db: AsyncSession,
    usn: str,
    name: str,
    branch: Optional[str] = None,
) -> Student:
    """
    Upsert a student by USN.
    If the student already exists, return the existing row.
    Branch is auto-derived from the USN if not provided.
    """
    result = await db.execute(select(Student).where(Student.usn == usn))
    existing = result.scalar_one_or_none()
    if existing:
        return existing

    student = Student(
        usn=usn,
        name=name,
        branch=branch or _extract_branch(usn),
    )
    db.add(student)
    await db.flush()
    return student


async def get_student_by_usn(db: AsyncSession, usn: str) -> Optional[Student]:
    result = await db.execute(select(Student).where(Student.usn == usn))
    return result.scalar_one_or_none()


# ══════════════════════════════════════════════════════════════
# ATTENDANCE
# ══════════════════════════════════════════════════════════════

async def save_attendance_bulk(
    db: AsyncSession,
    records: List[Dict],
) -> List[Attendance]:
    """
    Bulk-insert attendance rows.
    Each dict must contain: form_id, session_id, student_id, sl_no,
                             status, confidence, ai_note
    """
    objs = [
        Attendance(
            form_id=r["form_id"],
            session_id=r["session_id"],
            student_id=r["student_id"],
            sl_no=r.get("sl_no"),
            status=r["status"],
            confidence=r.get("confidence"),
            ai_note=r.get("ai_note"),
        )
        for r in records
    ]
    db.add_all(objs)
    await db.flush()
    return objs


async def get_attendance(
    db: AsyncSession,
    form_id: UUID,
    session_id: Optional[UUID] = None,
) -> List[Attendance]:
    """Fetch attendance rows for a form, optionally filtered by session."""
    stmt = (
        select(Attendance)
        .where(Attendance.form_id == form_id)
        .options(selectinload(Attendance.student))
    )
    if session_id:
        stmt = stmt.where(Attendance.session_id == session_id)
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def update_attendance_status(
    db: AsyncSession,
    attendance_id: UUID,
    status: str,
    resolved_by: UUID,
) -> Optional[Attendance]:
    """
    Mark an attendance cell as present/absent/unclear after human review.
    Records who resolved it and when.
    """
    await db.execute(
        update(Attendance)
        .where(Attendance.id == attendance_id)
        .values(
            status=status,
            resolved_by=resolved_by,
            resolved_at=datetime.now(timezone.utc),
        )
    )
    result = await db.execute(select(Attendance).where(Attendance.id == attendance_id))
    return result.scalar_one_or_none()


# ══════════════════════════════════════════════════════════════
# DOUBTS
# ══════════════════════════════════════════════════════════════

async def save_doubts_bulk(
    db: AsyncSession,
    form_id: UUID,
    doubts: List[Dict],
) -> List[Doubt]:
    """
    Bulk-insert doubt rows generated by the validation engine.
    Each dict: attendance_id (opt), type, message, ai_guess
    """
    objs = [
        Doubt(
            form_id=form_id,
            attendance_id=d.get("attendance_id"),
            type=d["type"],
            message=d["message"],
            ai_guess=d.get("ai_guess"),
            resolved=False,
        )
        for d in doubts
    ]
    db.add_all(objs)
    await db.flush()
    return objs


async def get_doubts(
    db: AsyncSession,
    form_id: UUID,
    resolved: Optional[bool] = None,
) -> List[Doubt]:
    """List doubts for a form. Pass resolved=False to get only open doubts."""
    stmt = select(Doubt).where(Doubt.form_id == form_id)
    if resolved is not None:
        stmt = stmt.where(Doubt.resolved == resolved)
    stmt = stmt.order_by(Doubt.created_at.asc())
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def resolve_doubt(
    db: AsyncSession,
    doubt_id: UUID,
    resolution: str,
) -> Optional[Doubt]:
    """Mark a doubt as resolved with the reviewer's decision."""
    await db.execute(
        update(Doubt)
        .where(Doubt.id == doubt_id)
        .values(resolved=True, resolution=resolution)
    )
    result = await db.execute(select(Doubt).where(Doubt.id == doubt_id))
    return result.scalar_one_or_none()


async def count_open_doubts(db: AsyncSession, form_id: UUID) -> int:
    result = await db.execute(
        select(func.count(Doubt.id))
        .where(Doubt.form_id == form_id, Doubt.resolved == False)  # noqa: E712
    )
    return result.scalar_one()


# ══════════════════════════════════════════════════════════════
# FINALIZE
# ══════════════════════════════════════════════════════════════

async def finalize_form(db: AsyncSession, form_id: UUID) -> tuple[bool, str, Optional[Form]]:
    """
    Mark form as 'final'.
    Blocked if there are any unresolved doubts.
    Returns (success, message, updated_form).
    """
    open_count = await count_open_doubts(db, form_id)
    if open_count > 0:
        return False, f"Cannot finalize: {open_count} open doubt(s) must be resolved first.", None

    form = await set_form_status(db, form_id, "final")
    return True, "Form finalized successfully.", form


# ══════════════════════════════════════════════════════════════
# SUMMARIES
# ══════════════════════════════════════════════════════════════

async def get_room_summary(db: AsyncSession, room_no: str) -> List[Dict]:
    """
    Returns per-session attendance stats for a room.
    Result: [ { session_id, exam_date, subject_code, total, present, absent, unclear,
                percentage, present_students: [...], absent_students: [...] } ]
    """
    # Fetch all final forms for this room
    forms_result = await db.execute(
        select(Form.id).where(Form.room_no == room_no, Form.status == "final")
    )
    form_ids = [row[0] for row in forms_result.all()]
    if not form_ids:
        # Also include needs_review forms so the user can at least see partial data
        forms_result = await db.execute(
            select(Form.id).where(Form.room_no == room_no)
        )
        form_ids = [row[0] for row in forms_result.all()]

    if not form_ids:
        return []

    sessions_result = await db.execute(
        select(Session).where(Session.form_id.in_(form_ids))
    )
    sessions = sessions_result.scalars().all()

    summary = []
    for session in sessions:
        att_result = await db.execute(
            select(Attendance)
            .where(Attendance.session_id == session.id)
            .options(selectinload(Attendance.student))
        )
        rows = att_result.scalars().all()

        total   = len(rows)
        present = [r for r in rows if r.status == "present"]
        absent  = [r for r in rows if r.status == "absent"]
        unclear = [r for r in rows if r.status == "unclear"]
        pct     = round(len(present) / total * 100, 2) if total else 0.0

        summary.append({
            "session_id":   session.id,
            "exam_date":    session.exam_date,
            "subject_code": session.subject_code,
            "total":        total,
            "present":      len(present),
            "absent":       len(absent),
            "unclear":      len(unclear),
            "percentage":   pct,
            "present_students": [r.student for r in present],
            "absent_students":  [r.student for r in absent],
        })
    return summary


async def get_branch_summary(db: AsyncSession, branch: str) -> List[Dict]:
    """
    Returns per-session attendance stats for a branch across all rooms.
    Branch is matched against the students.branch column.
    """
    student_ids_result = await db.execute(
        select(Student.id).where(Student.branch == branch.upper())
    )
    student_ids = [row[0] for row in student_ids_result.all()]
    if not student_ids:
        return []

    att_result = await db.execute(
        select(Attendance)
        .where(Attendance.student_id.in_(student_ids))
        .options(selectinload(Attendance.session))
    )
    rows = att_result.scalars().all()

    # Group by session
    grouped: Dict[UUID, List[Attendance]] = {}
    for r in rows:
        grouped.setdefault(r.session_id, []).append(r)

    summary = []
    for session_id, att_rows in grouped.items():
        session = att_rows[0].session
        total   = len(att_rows)
        present = sum(1 for r in att_rows if r.status == "present")
        absent  = sum(1 for r in att_rows if r.status == "absent")
        pct     = round(present / total * 100, 2) if total else 0.0

        summary.append({
            "session_id":   session_id,
            "exam_date":    session.exam_date,
            "subject_code": session.subject_code,
            "total":        total,
            "present":      present,
            "absent":       absent,
            "percentage":   pct,
        })

    summary.sort(key=lambda x: x["exam_date"])
    return summary


# ══════════════════════════════════════════════════════════════
# CHAT HISTORY  (called by Mahadev's chat endpoint)
# ══════════════════════════════════════════════════════════════

async def save_chat_message(
    db: AsyncSession,
    user_id: UUID,
    role: str,
    content: str,
) -> ChatMessage:
    msg = ChatMessage(user_id=user_id, role=role, content=content)
    db.add(msg)
    await db.flush()
    return msg


async def get_chat_history(
    db: AsyncSession,
    user_id: UUID,
    limit: int = 50,
) -> List[ChatMessage]:
    result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.user_id == user_id)
        .order_by(ChatMessage.created_at.asc())
        .limit(limit)
    )
    return list(result.scalars().all())
