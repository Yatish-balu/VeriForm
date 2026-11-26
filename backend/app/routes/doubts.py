"""
VeriForm — /api/doubts and /api/forms/{id}/finalize routes
Owned by: Bhanuprasad
Endpoints:
  POST /api/doubts/{id}/resolve   – resolve a single doubt (present/absent/edit)
  POST /api/forms/{id}/finalize   – mark form as final (blocked if open doubts exist)
"""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.db import service as svc
from app.models.schemas import DoubtOut, FormDetailOut, ResolveDoubtIn

router = APIRouter()


# ─────────────────────────────────────────────────────────────
# POST /api/doubts/{id}/resolve
# ─────────────────────────────────────────────────────────────
@router.post("/doubts/{doubt_id}/resolve", response_model=DoubtOut)
async def resolve_doubt(
    doubt_id: UUID,
    body: ResolveDoubtIn,
    db: AsyncSession = Depends(get_db),
):
    """
    Resolve a doubt raised by the AI.

    - resolution: 'present', 'absent', or any free-text note.
    - Also updates the linked attendance row's status (if attendance_id is set).
    - After resolving, the frontend should check whether all doubts for the form
      are closed before enabling the Finalize button.
    """
    doubt = await svc.resolve_doubt(db, doubt_id, resolution=body.resolution)
    if not doubt:
        raise HTTPException(status_code=404, detail="Doubt not found.")

    # Update the linked attendance cell if this doubt has one
    if doubt.attendance_id and body.resolution in ("present", "absent", "unclear"):
        await svc.update_attendance_status(
            db,
            attendance_id=doubt.attendance_id,
            status=body.resolution,
            resolved_by=body.resolved_by,
        )

    return doubt


# ─────────────────────────────────────────────────────────────
# POST /api/forms/{id}/finalize
# ─────────────────────────────────────────────────────────────
@router.post("/forms/{form_id}/finalize", response_model=FormDetailOut)
async def finalize_form(form_id: UUID, db: AsyncSession = Depends(get_db)):
    """
    Attempt to mark a form as 'final'.

    - Blocked with HTTP 409 if any doubts are still unresolved.
    - On success, sets form.status = 'final' and returns updated form detail.
    """
    success, message, form = await svc.finalize_form(db, form_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=message,
        )
    return form
