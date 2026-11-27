"""
VeriForm — /api/summary routes
Owned by: Bhanuprasad
Endpoints:
  GET /api/summary/room/{room_no}       – room-wise summary across sessions
  GET /api/summary/branch/{branch}      – branch-wise summary across all rooms
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.auth import require_user
from app.db.database import get_db
from app.db import service as svc
from app.models.schemas import BranchSummaryOut, RoomSummaryOut

router = APIRouter(dependencies=[Depends(require_user)])


# ─────────────────────────────────────────────────────────────
# GET /api/summary/room/{room_no}
# ─────────────────────────────────────────────────────────────
@router.get("/room/{room_no}", response_model=RoomSummaryOut)
async def room_summary(room_no: str, db: AsyncSession = Depends(get_db)):
    """
    Room-wise attendance summary.

    Returns counts, student lists, and verification status for each paper.
    """
    room_no = room_no.strip().upper()
    sessions = await svc.get_room_summary(db, room_no)
    if not sessions:
        raise HTTPException(
            status_code=404,
            detail=f"No forms found for room '{room_no}'. Upload and finalize a B-form first.",
        )
    return RoomSummaryOut(room_no=room_no, sessions=sessions)


# ─────────────────────────────────────────────────────────────
# GET /api/summary/branch/{branch}
# ─────────────────────────────────────────────────────────────
@router.get("/branch/{branch}", response_model=BranchSummaryOut)
async def branch_summary(branch: str, db: AsyncSession = Depends(get_db)):
    """
    Branch-wise attendance summary.

    Groups student attendance data across all rooms by branch code
    (derived from USN, e.g. 'CY', 'CS', 'IS').
    """
    branch = branch.strip().upper()
    sessions = await svc.get_branch_summary(db, branch)
    if not sessions:
        raise HTTPException(
            status_code=404,
            detail=f"No attendance data found for branch '{branch}'.",
        )
    return BranchSummaryOut(branch=branch, sessions=sessions)
