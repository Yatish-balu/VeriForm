"""
VeriForm — Chat Tool Functions  (STUB for Mahadev)
These are the only read-only DB functions the Gemini chatbot can call.
No raw SQL ever comes from the model — only these approved functions.
"""

from __future__ import annotations

from typing import List
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.orm import ChatMessage


async def handle_chat_message(
    user_message: str,
    history: List[ChatMessage],
    db: AsyncSession,
) -> str:
    """
    Process a user question using Gemini function calling.

    TODO (Mahadev):
      1. Build conversation history for Gemini.
      2. Define function declarations (get_absentees, room_summary, branch_summary,
         find_student, multi_absent).
      3. Call Gemini with function_calling_config.
      4. If Gemini returns a function call, run the matching DB query via db service.
      5. Send result back to Gemini for a natural-language answer.
      6. Return the final text response.
      7. If no data found, return "I don't have that data yet."

    Available DB service functions to wrap as tools:
      - svc.get_room_summary(db, room_no)
      - svc.get_branch_summary(db, branch)
      - svc.get_attendance(db, form_id, session_id)
      - svc.get_student_by_usn(db, usn)
    """
    # ── Placeholder ──────────────────────────────────────────
    return (
        "🚧 Chatbot not yet implemented. "
        "Mahadev: implement Gemini function-calling logic in services/chat_tools.py."
    )
