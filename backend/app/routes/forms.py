"""
VeriForm — /api/forms routes
Owned by: Bhanuprasad
Endpoints:
  POST /api/forms/upload   – upload B-form image, trigger extraction, save to DB
  GET  /api/forms          – list all forms (with open-doubt count)
  GET  /api/forms/{id}     – form detail (sessions + attendance + doubts)
  GET  /api/forms/{id}/doubts – list doubts for a form
"""

from __future__ import annotations

import uuid
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, Response, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.db import service as svc
from app.db.supabase_client import upload_image
from app.models.schemas import DoubtOut, FormDetailOut, FormListItem
from app.services.export import generate_form_pdf
from app.services.gemini_extraction import extract_form   # Yatish's service
from app.services.validation import generate_doubts        # Yatish's service

router = APIRouter()


# ─────────────────────────────────────────────────────────────
# POST /api/forms/upload
# ─────────────────────────────────────────────────────────────
@router.post("/upload", response_model=FormDetailOut, status_code=status.HTTP_201_CREATED)
async def upload_form(
    file: UploadFile = File(..., description="JPG, PNG, or PDF of the B-form sheet"),
    uploaded_by: Optional[UUID] = Form(None, description="Auth user UUID"),
    db: AsyncSession = Depends(get_db),
):
    """
    1. Read and validate the uploaded file.
    2. Run Gemini Vision extraction (Yatish's service).
    3. Save form + sessions + students + attendance to DB.
    4. Run validation → generate doubts.
    5. Upload image to Supabase Storage.
    6. Set status to 'needs_review' (or 'processing' if extraction fails).
    7. Return full form detail.
    """
    # ── 1. File validation ───────────────────────────────────
    allowed_types = {"image/jpeg", "image/png", "application/pdf"}
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type: {file.content_type}. Use JPG, PNG, or PDF.",
        )

    max_bytes = 20 * 1024 * 1024  # 20 MB
    file_bytes = await file.read()
    if len(file_bytes) > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File too large. Maximum size is 20 MB.",
        )

    # ── 2. AI Extraction (Yatish) ────────────────────────────
    extracted = await extract_form(file_bytes, file.content_type)
    # extracted: ExtractedForm dataclass defined in services/gemini_extraction.py

    # ── 3. Save to database ──────────────────────────────────
    form = await svc.save_form(
        db,
        room_no=extracted.room_no,
        exam_name=extracted.exam_name,
        semester=extracted.semester,
        department=extracted.department,
        footer_present_raw=extracted.footer_present_raw,
        footer_absent_raw=extracted.footer_absent_raw,
        uploaded_by=uploaded_by,
    )

    # Save sessions
    sessions = await svc.save_sessions(
        db,
        form_id=form.id,
        sessions=[
            {"exam_date": s.exam_date, "subject_code": s.subject_code}
            for s in extracted.sessions
        ],
    )

    # Map subject_code → session ORM object for attendance linking
    session_map = {s.subject_code: s for s in sessions}

    # Upsert students + build attendance records
    attendance_records: list[dict] = []
    for student_data in extracted.students:
        student = await svc.save_or_get_student(
            db,
            usn=student_data.usn,
            name=student_data.name,
        )
        for cell in student_data.cells:
            session_obj = session_map.get(cell.subject_code)
            if not session_obj:
                continue
            attendance_records.append({
                "form_id":    form.id,
                "session_id": session_obj.id,
                "student_id": student.id,
                "sl_no":      student_data.sl_no,
                "status":     cell.status,
                "confidence": cell.confidence,
                "ai_note":    cell.ai_note,
            })

    attendance_objs = await svc.save_attendance_bulk(db, attendance_records)

    # ── 4. Validation → Doubts (Yatish) ─────────────────────
    raw_doubts = generate_doubts(extracted, attendance_objs)
    if raw_doubts:
        await svc.save_doubts_bulk(db, form.id, raw_doubts)
        await svc.set_form_status(db, form.id, "needs_review")
    else:
        await svc.set_form_status(db, form.id, "needs_review")  # always review first

    # ── 5. Upload image to Supabase Storage ──────────────────
    ext = file.filename.rsplit(".", 1)[-1] if file.filename else "jpg"
    filename = f"{form.id}.{ext}"
    try:
        image_url = upload_image(file_bytes, filename, file.content_type)
        await svc.set_form_image_url(db, form.id, image_url)
    except Exception:
        # Non-fatal — form is still usable without the image URL
        pass

    # ── 6. Return full form detail ───────────────────────────
    result = await svc.get_form(db, form.id)
    if not result:
        raise HTTPException(status_code=500, detail="Form saved but could not be retrieved.")
    return result


# ─────────────────────────────────────────────────────────────
# GET /api/forms
# ─────────────────────────────────────────────────────────────
@router.get("/", response_model=List[FormListItem])
async def list_forms(
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """List all uploaded forms with their current status and open-doubt count."""
    rows = await svc.list_forms(db, status=status)
    return rows


# ─────────────────────────────────────────────────────────────
# GET /api/forms/{id}
# ─────────────────────────────────────────────────────────────
@router.get("/{form_id}", response_model=FormDetailOut)
async def get_form(form_id: UUID, db: AsyncSession = Depends(get_db)):
    """Full form detail including sessions, attendance rows, and doubts."""
    form = await svc.get_form(db, form_id)
    if not form:
        raise HTTPException(status_code=404, detail="Form not found.")
    return form


# ─────────────────────────────────────────────────────────────
# GET /api/forms/{id}/doubts
# ─────────────────────────────────────────────────────────────
@router.get("/{form_id}/doubts", response_model=List[DoubtOut])
async def list_form_doubts(
    form_id: UUID,
    resolved: Optional[bool] = None,
    db: AsyncSession = Depends(get_db),
):
    """
    List doubts for a form.
    Pass ?resolved=false to show only open doubts (Review Queue).
    Pass ?resolved=true to show resolved ones.
    Omit to get all.
    """
    form = await svc.get_form(db, form_id)
    if not form:
        raise HTTPException(status_code=404, detail="Form not found.")
    return await svc.get_doubts(db, form_id, resolved=resolved)


# ─────────────────────────────────────────────────────────────
# GET /api/forms/{id}/export
# ─────────────────────────────────────────────────────────────
@router.get("/{form_id}/export")
async def export_form_pdf(form_id: UUID, db: AsyncSession = Depends(get_db)) -> Response:
    """Export a form's attendance sheet as a downloadable PDF."""
    form = await svc.get_form(db, form_id)
    if not form:
        raise HTTPException(status_code=404, detail="Form not found.")

    pdf_bytes = generate_form_pdf(form)
    safe_room = "".join(c if c.isalnum() or c in "-_" else "_" for c in (form.room_no or "unknown"))
    filename = f"form_b_{safe_room}_{form_id}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
