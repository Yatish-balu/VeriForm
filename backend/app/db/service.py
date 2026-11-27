"""
VeriForm — Database Service Layer
All database operations go through this module.
Routes and services NEVER write raw SQL — they call these functions.
Author: Bhanuprasad
"""

from __future__ import annotations

import re
from datetime import date, datetime, timezone
from typing import Dict, List, Optional
from uuid import UUID

from sqlalchemy import case, func, select, update
from sqlalchemy.dialects.postgresql import insert
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


async def form_exists(db: AsyncSession, form_id: UUID) -> bool:
    return await db.scalar(select(Form.id).where(Form.id == form_id)) is not None


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
        func.count(Doubt.id).filter(Doubt.resolved.is_(False)).label("open_doubts"),
    ).outerjoin(Doubt, Doubt.form_id == Form.id).group_by(Form.id)

    if uploaded_by:
        stmt = stmt.where(Form.uploaded_by == uploaded_by)
    if status:
        stmt = stmt.where(Form.status == status)

    stmt = stmt.order_by(Form.created_at.desc(), Form.id)
    result = await db.execute(stmt)
    return [row._asdict() for row in result.all()]


async def set_form_status(db: AsyncSession, form_id: UUID, status: str) -> Optional[Form]:
    """Update a form's status field."""
    await db.execute(
        update(Form).where(Form.id == form_id).values(status=status)
    )
    return await get_form(db, form_id)


async def set_form_image_url(db: AsyncSession, form_id: UUID, image_url: str) -> None:
    """Store the private object key for a form's image."""
    await db.execute(update(Form).where(Form.id == form_id).values(image_url=image_url))


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
    """Derive the branch from a USN such as '1DS23CY037'."""
    match = re.fullmatch(r"[0-9][A-Z]{2}[0-9]{2}([A-Z]{2})[0-9]{3}", usn.upper())
    return match[1] if match else "UNKNOWN"


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
    stmt = (
        insert(Student)
        .values(usn=usn, name=name, branch=branch or _extract_branch(usn))
        .on_conflict_do_nothing(index_elements=[Student.usn])
        .returning(Student)
    )
    student = (await db.execute(stmt)).scalar_one_or_none()
    if student is not None:
        return student
    return (await db.execute(select(Student).where(Student.usn == usn))).scalar_one()


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
    stmt = stmt.order_by(Doubt.created_at.asc(), Doubt.id)
    result = await db.execute(stmt)
    return list(result.scalars().all())


class ReviewConflict(Exception):
    pass


class InvalidResolution(Exception):
    pass


async def resolve_doubt(
    db: AsyncSession,
    doubt_id: UUID,
    resolution: str,
    *,
    resolved_by: UUID,
    attendance_status: Optional[str] = None,
) -> Optional[Doubt]:
    """Save the review decision and any attendance correction in one transaction."""
    form = await db.scalar(
        select(Form).join(Doubt, Doubt.form_id == Form.id)
        .where(Doubt.id == doubt_id)
        .with_for_update(of=Form)
    )
    if form is None:
        return None

    doubt = await db.get(Doubt, doubt_id)
    if doubt is None:
        return None
    attendance = await db.get(Attendance, doubt.attendance_id) if doubt.attendance_id else None
    if attendance is not None and attendance.form_id != form.id:
        raise InvalidResolution("This doubt references an attendance cell from another form.")
    if attendance_status and attendance is None:
        raise InvalidResolution("This doubt has no attendance cell to update.")
    if attendance is not None and not attendance_status and resolution in ("present", "absent"):
        attendance_status = resolution

    if doubt.resolved:
        if doubt.resolution == resolution and (
            attendance_status is None or attendance.status == attendance_status
        ):
            return doubt
        if attendance is None or attendance.status != "unclear" or attendance_status is None:
            raise ReviewConflict("This doubt has already been resolved.")
    if form.status != "needs_review":
        raise ReviewConflict("Only forms awaiting review can be edited.")
    if attendance is not None and attendance.status == "unclear" and attendance_status is None:
        raise InvalidResolution("Choose present or absent for the unclear attendance cell.")

    if attendance_status:
        await update_attendance_status(db, attendance.id, attendance_status, resolved_by)
    doubt.resolved = True
    doubt.resolution = resolution
    await db.flush()
    return doubt


async def count_open_doubts(db: AsyncSession, form_id: UUID) -> int:
    result = await db.execute(
        select(func.count(Doubt.id))
        .where(Doubt.form_id == form_id, Doubt.resolved.is_(False))
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
    form = await db.get(Form, form_id, with_for_update=True)
    if form is None:
        return False, "Form not found.", None
    if form.status == "final":
        return True, "Form already finalized.", await get_form(db, form_id)
    if form.status == "processing":
        return False, "Cannot finalize a form that is still processing.", form

    open_count = await count_open_doubts(db, form_id)
    if open_count > 0:
        return False, f"Cannot finalize: {open_count} open doubt(s) must be resolved first.", form

    unclear = await db.scalar(
        select(Attendance.id)
        .where(Attendance.form_id == form_id, Attendance.status == "unclear")
        .limit(1)
    )
    if unclear is not None:
        return False, "Cannot finalize while an attendance cell is still unclear.", form

    form = await set_form_status(db, form_id, "final")
    return True, "Form finalized successfully.", form


# ══════════════════════════════════════════════════════════════
# SUMMARIES
# ══════════════════════════════════════════════════════════════

def _current_sessions(room_no: Optional[str] = None):
    """Pick one source per room and paper, preferring a verified upload."""
    room = func.upper(func.trim(Form.room_no))
    ranked = (
        select(
            Session.id.label("session_id"),
            Form.status.label("form_status"),
            func.row_number().over(
                partition_by=(room, Session.exam_date, func.upper(func.trim(Session.subject_code))),
                order_by=(
                    case((Form.status == "final", 0), else_=1),
                    Form.created_at.desc(),
                    Form.id,
                    Session.id,
                ),
            ).label("source_rank"),
        )
        .join(Form, Form.id == Session.form_id)
        .where(Form.status.in_(("final", "needs_review")))
    )
    if room_no is not None:
        ranked = ranked.where(room == room_no.strip().upper())
    sources = ranked.subquery()
    return (
        select(sources.c.session_id, sources.c.form_status)
        .where(sources.c.source_rank == 1)
        .subquery()
    )


def _percentage(present: int, total: int) -> float:
    return round(present / total * 100, 2) if total else 0.0


async def get_room_summary(db: AsyncSession, room_no: str) -> List[Dict]:
    """Return attendance and verification status for each paper in a room."""
    sources = _current_sessions(room_no)
    result = await db.execute(
        select(Session, sources.c.form_status)
        .join(sources, sources.c.session_id == Session.id)
        .options(selectinload(Session.attendance).selectinload(Attendance.student))
        .order_by(Session.exam_date, Session.subject_code, Session.id)
    )

    summary = []
    for session, form_status in result:
        rows = sorted(session.attendance, key=lambda row: (row.sl_no is None, row.sl_no, row.student.usn))
        present = [r.student for r in rows if r.status == "present"]
        absent = [r.student for r in rows if r.status == "absent"]
        summary.append({
            "session_id": session.id,
            "form_id": session.form_id,
            "exam_date": session.exam_date,
            "subject_code": session.subject_code,
            "total": len(rows),
            "present": len(present),
            "absent": len(absent),
            "unclear": len(rows) - len(present) - len(absent),
            "verified": form_status == "final",
            "percentage": _percentage(len(present), len(rows)),
            "present_students": present,
            "absent_students": absent,
        })
    return summary


async def get_branch_summary(db: AsyncSession, branch: str) -> List[Dict]:
    """Aggregate a branch's attendance by paper across rooms."""
    sources = _current_sessions()
    subject_code = func.upper(func.trim(Session.subject_code))
    result = await db.execute(
        select(
            Session.id,
            Session.exam_date,
            subject_code,
            sources.c.form_status,
            func.count(Attendance.id),
            func.count(Attendance.id).filter(Attendance.status == "present"),
            func.count(Attendance.id).filter(Attendance.status == "absent"),
        )
        .join(sources, sources.c.session_id == Session.id)
        .join(Attendance, Attendance.session_id == Session.id)
        .join(Student, Student.id == Attendance.student_id)
        .where(Student.branch == branch.strip().upper())
        .group_by(Session.id, Session.exam_date, subject_code, sources.c.form_status)
        .order_by(Session.exam_date, subject_code, Session.id)
    )

    papers: Dict[tuple[date, str], Dict] = {}
    for session_id, exam_date, code, form_status, total, present, absent in result:
        paper = papers.setdefault((exam_date, code), {
            "session_id": session_id,
            "session_ids": [],
            "exam_date": exam_date,
            "subject_code": code,
            "total": 0,
            "present": 0,
            "absent": 0,
            "unclear": 0,
            "verified": True,
        })
        paper["session_ids"].append(session_id)
        paper["total"] += total
        paper["present"] += present
        paper["absent"] += absent
        paper["unclear"] += total - present - absent
        paper["verified"] = paper["verified"] and form_status == "final"

    for paper in papers.values():
        paper["percentage"] = _percentage(paper["present"], paper["total"])
    return list(papers.values())


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
