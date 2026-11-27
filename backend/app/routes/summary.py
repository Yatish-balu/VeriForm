"""
VeriForm — /api/summary routes
Owned by: Bhanuprasad
Endpoints:
  GET /api/summary/room/{room_no}       – room-wise summary across sessions
  GET /api/summary/branch/{branch}      – branch-wise summary across all rooms
"""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.auth import require_user
from app.db.database import get_db
from app.db import service as svc
from app.models.schemas import BranchSummaryOut, RoomSummaryOut, SummaryOptionsOut

router = APIRouter(dependencies=[Depends(require_user)])
ExamYear = Annotated[int | None, Query(ge=1, le=9999)]


@router.get("/options", response_model=SummaryOptionsOut)
async def summary_options(
    form_id: UUID | None = None,
    exam_year: ExamYear = None,
    db: AsyncSession = Depends(get_db),
) -> SummaryOptionsOut:
    options = await svc.get_summary_options(db, form_id=form_id, exam_year=exam_year)
    return SummaryOptionsOut(**options)


# ─────────────────────────────────────────────────────────────
# GET /api/summary/room/{room_no}
# ─────────────────────────────────────────────────────────────
@router.get("/room/{room_no}", response_model=RoomSummaryOut)
async def room_summary(
    room_no: str,
    form_id: UUID | None = None,
    exam_year: ExamYear = None,
    db: AsyncSession = Depends(get_db),
) -> RoomSummaryOut:
    """
    Room-wise attendance summary.

    Returns counts, student lists, and verification status for each paper.
    """
    room_no = room_no.strip().upper()
    sessions = await svc.get_room_summary(db, room_no, form_id=form_id, exam_year=exam_year)
    if not sessions:
        raise HTTPException(
            status_code=404,
            detail=f"No saved attendance sessions match room '{room_no}' and the selected filters.",
        )
    return RoomSummaryOut(room_no=room_no, sessions=sessions)


# ─────────────────────────────────────────────────────────────
# GET /api/summary/branch/{branch}
# ─────────────────────────────────────────────────────────────
@router.get("/branch/{branch}", response_model=BranchSummaryOut)
async def branch_summary(
    branch: str,
    form_id: UUID | None = None,
    exam_year: ExamYear = None,
    db: AsyncSession = Depends(get_db),
) -> BranchSummaryOut:
    """
    Branch-wise attendance summary.

    Groups student attendance data across all rooms by branch code
    (derived from USN, e.g. 'CY', 'CS', 'IS').
    """
    branch = branch.strip().upper()
    sessions = await svc.get_branch_summary(db, branch, form_id=form_id, exam_year=exam_year)
    if not sessions:
        raise HTTPException(
            status_code=404,
            detail=f"No attendance data found for branch '{branch}'.",
        )
    return BranchSummaryOut(branch=branch, sessions=sessions)
