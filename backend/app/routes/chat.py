"""Attendance chat and conversation history."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.auth import require_user
from app.db.database import get_db
from app.db import service as svc
from app.models.schemas import ChatIn, ChatOut
from app.services.chat_tools import ChatUnavailable, handle_chat_message

router = APIRouter()


@router.post("/chat", response_model=list[ChatOut])
async def chat(
    body: ChatIn,
    user_id: UUID = Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    """Answer from saved attendance and record the conversation for this user."""
    if body.user_id != user_id:
        raise HTTPException(403, "The chat user must match the signed-in user.")
    history = await svc.get_chat_history(db, user_id=user_id, limit=6)
    await db.commit()
    try:
        reply_text = await handle_chat_message(body.message, history, db)
    except ChatUnavailable as exc:
        raise HTTPException(503, str(exc)) from exc

    await svc.save_chat_message(db, user_id=user_id, role="user", content=body.message)
    reply_msg = await svc.save_chat_message(db, user_id=user_id, role="assistant", content=reply_text)
    return [reply_msg]
