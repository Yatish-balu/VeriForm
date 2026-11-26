"""
VeriForm — /api/chat route  (stub)
Owned by: Mahadev H
Bhanuprasad has wired the router and DB history calls.
Mahadev implements the Gemini function-calling logic in services/chat_tools.py.
"""

from __future__ import annotations

from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.db import service as svc
from app.models.schemas import ChatIn, ChatOut
from app.services.chat_tools import handle_chat_message   # Mahadev's service

router = APIRouter()


@router.post("/chat", response_model=List[ChatOut])
async def chat(body: ChatIn, db: AsyncSession = Depends(get_db)):
    """
    AI Chatbot endpoint.
    - Saves the user's message to chat history.
    - Passes the message + history to Mahadev's Gemini function-calling handler.
    - Saves the assistant reply and returns it.
    """
    # Save user message
    await svc.save_chat_message(db, user_id=body.user_id, role="user", content=body.message)

    # Fetch recent history for context
    history = await svc.get_chat_history(db, user_id=body.user_id, limit=20)

    # Call Mahadev's chat handler
    reply_text = await handle_chat_message(body.message, history, db)

    # Save assistant reply
    reply_msg = await svc.save_chat_message(db, user_id=body.user_id, role="assistant", content=reply_text)

    return [reply_msg]
