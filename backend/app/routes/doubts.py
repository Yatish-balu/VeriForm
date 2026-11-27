"""
VeriForm — /api/doubts and /api/forms/{id}/finalize routes
Owned by: Bhanuprasad
Endpoints:
  POST /api/doubts/{id}/resolve   – save a review decision
  POST /api/forms/{id}/finalize   – mark form as final (blocked if open doubts exist)
"""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.auth import require_user
from app.db.database import get_db
from app.db import service as svc
from app.models.schemas import DoubtOut, DoubtResolutionOut, FinalizeFormOut, FormDetailOut, ResolveDoubtIn
from app.routes.forms import form_detail

router = APIRouter(dependencies=[Depends(require_user)])


# ─────────────────────────────────────────────────────────────
# POST /api/doubts/{id}/resolve
# ─────────────────────────────────────────────────────────────
@router.post("/doubts/{doubt_id}/resolve", response_model=DoubtResolutionOut)
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
        doubt, resolved_ids = await svc.resolve_doubt(
            db,
            doubt_id,
            resolution=body.resolution,
            resolved_by=user_id,
            attendance_status=body.attendance_status,
            resolve_related=body.resolve_related,
        )
    except svc.InvalidResolution as exc:
        raise HTTPException(422, str(exc)) from exc
    except svc.ReviewConflict as exc:
        raise HTTPException(409, str(exc)) from exc
    if doubt is None:
        raise HTTPException(404, "Doubt not found.")

    return DoubtResolutionOut(
        **DoubtOut.model_validate(doubt).model_dump(),
        resolved_doubt_ids=resolved_ids,
    )


# ─────────────────────────────────────────────────────────────
# POST /api/forms/{id}/finalize
# ─────────────────────────────────────────────────────────────
@router.post("/forms/{form_id}/finalize", response_model=FormDetailOut | FinalizeFormOut)
async def finalize_form(
    form_id: UUID,
    include_detail: bool = True,
    db: AsyncSession = Depends(get_db),
) -> FormDetailOut | FinalizeFormOut:
    """Finalize a verified form and return its detail or a status confirmation."""
    success, message, form = await svc.finalize_form(db, form_id)
    if form is None:
        raise HTTPException(404, message)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=message,
        )
    if not include_detail:
        await db.commit()
        return FinalizeFormOut(id=form_id, status="final")

    detail_form = await svc.get_form(db, form_id)
    if detail_form is None:
        raise HTTPException(404, "Form not found.")
    await db.commit()
    return await form_detail(detail_form)
