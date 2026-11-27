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

from app.db.auth import require_user
from app.db.database import get_db
from app.db import service as svc
from app.models.schemas import DoubtOut, FormDetailOut, ResolveDoubtIn
from app.routes.forms import form_detail

router = APIRouter(dependencies=[Depends(require_user)])


# ─────────────────────────────────────────────────────────────
# POST /api/doubts/{id}/resolve
# ─────────────────────────────────────────────────────────────
@router.post("/doubts/{doubt_id}/resolve", response_model=DoubtOut)
async def resolve_doubt(
    doubt_id: UUID,
    body: ResolveDoubtIn,
    user_id: UUID = Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    """Record a reviewer's decision and apply any associated attendance change."""
    if body.resolved_by is not None and body.resolved_by != user_id:
        raise HTTPException(403, "The reviewer must match the authenticated user.")
    try:
        doubt = await svc.resolve_doubt(
            db,
            doubt_id,
            resolution=body.resolution,
            resolved_by=user_id,
            attendance_status=body.attendance_status,
        )
    except svc.InvalidResolution as exc:
        raise HTTPException(422, str(exc)) from exc
    except svc.ReviewConflict as exc:
        raise HTTPException(409, str(exc)) from exc
    if doubt is None:
        raise HTTPException(404, "Doubt not found.")

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
    if form is None:
        raise HTTPException(404, message)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=message,
        )
    await db.commit()
    return await form_detail(form)
