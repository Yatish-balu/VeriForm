"""Upload and retrieve Form-B sheets and their review queues."""

from __future__ import annotations

import logging
import re
from collections import defaultdict
from dataclasses import replace
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.concurrency import run_in_threadpool

from app.core.config import settings
from app.db import service as svc
from app.db.auth import require_user
from app.db.database import get_db
from app.db.supabase_client import delete_image, sign_form_image, upload_image
from app.models.orm import Form as StoredForm
from app.models.schemas import DoubtOut, FormDetailOut, FormListItem, FormStatus
from app.services.gemini_extraction import ExtractedCell, ExtractedForm, extract_form
from app.services.validation import generate_doubts

router = APIRouter(dependencies=[Depends(require_user)])
logger = logging.getLogger(__name__)

MAX_UPLOAD_BYTES = 20 * 1024 * 1024
AMBIGUOUS_MARK = re.compile(r"\b(?:cross(?:ed)?|scribbl\w*|ambiguous|unclear|illegible)\b", re.IGNORECASE)
FILE_FORMATS = {
    "image/jpeg": ("jpg", bytes.fromhex("ffd8ff")),
    "image/png": ("png", bytes.fromhex("89504e470d0a1a0a")),
    "application/pdf": ("pdf", b"%PDF-"),
}


def _align_extraction(extracted: ExtractedForm) -> tuple[list[dict], ExtractedForm]:
    """Align each student row with the paper columns before saving and validating."""
    sessions = [
        {"exam_date": session.exam_date, "subject_code": session.subject_code.strip().upper()}
        for session in extracted.sessions
    ]
    if not extracted.room_no.strip() or not sessions or not extracted.students:
        raise HTTPException(422, "No room, exam sessions, or students were found on this Form-B.")
    if any(not session["subject_code"] for session in sessions):
        raise HTTPException(422, "A Form-B exam column has no subject code.")
    if len({(s["exam_date"], s["subject_code"]) for s in sessions}) != len(sessions):
        raise HTTPException(422, "Two Form-B exam columns have the same date and subject code.")

    columns: dict[str, list[int]] = defaultdict(list)
    for index, session in enumerate(sessions):
        columns[session["subject_code"]].append(index)

    # Validation keys cells by subject; include the date to distinguish repeated codes.
    validation_codes = [f"{s['exam_date']} {s['subject_code']}" for s in sessions]
    validation_sessions = [
        replace(session, subject_code=code)
        for session, code in zip(extracted.sessions, validation_codes)
    ]
    students = []
    usns = set()
    for student in extracted.students:
        usn = student.usn.strip().upper()
        if not usn or usn in usns:
            raise HTTPException(422, "The sheet contains missing or duplicate student USNs.")
        usns.add(usn)
        row: list[ExtractedCell | None] = [None] * len(sessions)
        cells_by_code: dict[str, list[ExtractedCell]] = defaultdict(list)
        for cell in student.cells:
            cells_by_code[cell.subject_code.strip().upper()].append(cell)
            if cell.status not in ("present", "absent", "unclear") or not 0 <= cell.confidence <= 1:
                raise HTTPException(422, f"Invalid attendance reading on row {student.sl_no}.")

        for code, cells in cells_by_code.items():
            positions = columns.get(code, [])
            # The extraction contract returns repeated subject codes in sheet-column order.
            if len(cells) != len(positions):
                raise HTTPException(422, f"Cannot match the {code} attendance cells on row {student.sl_no}.")
            for index, cell in zip(positions, cells):
                row[index] = cell

        cells = [
            replace(cell, subject_code=code) if cell else ExtractedCell(
                code, "unclear", 0.0, "No attendance reading was returned for this cell."
            )
            for code, cell in zip(validation_codes, row)
        ]
        students.append(replace(student, usn=usn, cells=cells))

    return sessions, replace(extracted, sessions=validation_sessions, students=students)


async def form_detail(form: StoredForm) -> FormDetailOut:
    """Serialize a form and supply a fresh private preview link when available."""
    detail = FormDetailOut.model_validate(form)
    if form.image_url:
        try:
            detail.image_url = await run_in_threadpool(sign_form_image, form.image_url, form.id)
        except Exception:
            logger.warning("Cannot sign the preview for form %s", form.id)
            detail.image_url = None
    return detail


@router.post("/upload", response_model=FormDetailOut, status_code=status.HTTP_201_CREATED)
async def upload_form(
    file: UploadFile = File(..., description="JPG, PNG, or PDF of the B-form sheet"),
    uploaded_by: UUID | None = Form(None, description="Optional authenticated user UUID"),
    user_id: UUID = Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    if uploaded_by is not None and uploaded_by != user_id:
        raise HTTPException(403, "The uploader must match the authenticated user.")

    content_type = file.content_type
    file_format = FILE_FORMATS.get(content_type)
    if file_format is None:
        raise HTTPException(400, "Unsupported file type. Use JPG, PNG, or PDF.")

    extension, signature = file_format
    file_bytes = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(file_bytes) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, "File too large. Maximum size is 20 MB.")
    if not file_bytes.startswith(signature):
        raise HTTPException(400, "The file contents do not match the selected JPG, PNG, or PDF type.")

    try:
        extracted = await extract_form(file_bytes, content_type)
    except ValueError as exc:
        raise HTTPException(422, "Unable to read this Form-B. Check that the whole sheet is legible.") from exc
    except NotImplementedError as exc:
        raise HTTPException(503, "Form-B extraction is not available.") from exc
    except Exception as exc:
        logger.warning("Form-B extraction failed (%s)", type(exc).__name__)
        raise HTTPException(502, "Form-B extraction failed. Try uploading again.") from exc

    sessions_data, extracted = _align_extraction(extracted)

    form = await svc.save_form(
        db,
        room_no=extracted.room_no.strip(),
        exam_name=extracted.exam_name,
        semester=extracted.semester,
        department=extracted.department,
        footer_present_raw=extracted.footer_present_raw,
        footer_absent_raw=extracted.footer_absent_raw,
        uploaded_by=user_id,
    )
    sessions = await svc.save_sessions(db, form.id, sessions_data)
    students = {}
    # Acquire any new USN index entries in the same order across concurrent uploads.
    for student in sorted(extracted.students, key=lambda student: student.usn):
        students[student.usn] = await svc.save_or_get_student(db, student.usn, student.name)

    records = []
    for student in extracted.students:
        for session, cell in zip(sessions, student.cells):
            needs_confirmation = (
                cell.confidence < settings.CONFIDENCE_THRESHOLD
                or AMBIGUOUS_MARK.search(cell.ai_note or "") is not None
            )
            records.append({
                "form_id": form.id,
                "session_id": session.id,
                "student_id": students[student.usn].id,
                "sl_no": student.sl_no,
                "status": "unclear" if needs_confirmation else cell.status,
                "confidence": cell.confidence,
                "ai_note": cell.ai_note,
            })

    attendance = await svc.save_attendance_bulk(db, records)
    doubts = list(generate_doubts(extracted, attendance))
    flagged = {doubt.get("attendance_id") for doubt in doubts}
    doubts.extend(
        {
            "attendance_id": cell.id,
            "type": "unclear_attendance",
            "message": f"Confirm the attendance status for row {cell.sl_no}.",
            "ai_guess": "unclear",
        }
        for cell in attendance
        if cell.status == "unclear" and cell.id not in flagged
    )
    await svc.save_doubts_bulk(db, form.id, doubts)

    filename = f"{form.id}.{extension}"
    image_path = f"forms/{filename}"
    await svc.set_form_image_url(db, form.id, image_path)
    detail = FormDetailOut.model_validate(await svc.set_form_status(db, form.id, "needs_review"))

    try:
        await run_in_threadpool(upload_image, file_bytes, filename, content_type)
    except Exception as exc:
        logger.warning("Cannot upload the preview for form %s", form.id)
        raise HTTPException(503, "Form-B storage is unavailable. Try uploading again.") from exc

    try:
        try:
            detail.image_url = await run_in_threadpool(sign_form_image, image_path, form.id)
        except Exception as exc:
            raise HTTPException(503, "Cannot create a preview link. Try uploading again.") from exc
        await db.commit()
    except Exception:
        try:
            await run_in_threadpool(delete_image, filename)
        except Exception:
            logger.warning("Cannot remove the unused preview for form %s", form.id)
        raise
    return detail


@router.get("/", response_model=list[FormListItem], include_in_schema=False)
@router.get("", response_model=list[FormListItem])
async def list_forms(status: FormStatus | None = None, db: AsyncSession = Depends(get_db)):
    """List uploads with their current status and open doubt count."""
    return await svc.list_forms(db, status=status)


@router.get("/{form_id}", response_model=FormDetailOut)
async def get_form(form_id: UUID, db: AsyncSession = Depends(get_db)):
    """Retrieve the sheet, exam sessions, attendance, and review history."""
    form = await svc.get_form(db, form_id)
    if form is None:
        raise HTTPException(404, "Form not found.")
    return await form_detail(form)


@router.get("/{form_id}/doubts", response_model=list[DoubtOut])
async def list_form_doubts(
    form_id: UUID,
    resolved: bool | None = None,
    db: AsyncSession = Depends(get_db),
):
    """List all doubts or filter by whether they have been resolved."""
    if not await svc.form_exists(db, form_id):
        raise HTTPException(404, "Form not found.")
    return await svc.get_doubts(db, form_id, resolved=resolved)
