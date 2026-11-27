"""
VeriForm — AI Chatbot Service with DB Tool Grounding
Processes natural-language queries using Gemini to select approved read-only DB tools,
retrieves factual data from PostgreSQL, and produces natural-language responses.
"""

from __future__ import annotations

import json
import logging
from typing import Any, List
from uuid import UUID

from google import genai
from google.genai import types as genai_types
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.db import service as svc
from app.models.orm import Attendance, ChatMessage, Form, Session, Student

logger = logging.getLogger(__name__)

class ChatUnavailable(Exception):
    """Raised when chatbot service cannot answer queries."""
    pass

_MODEL = "gemini-3.5-flash-lite"

_ROUTER_PROMPT = """You are a query router for VeriForm, a university exam attendance verification system.
Available tools:
1. "get_room_summary": Look up attendance summary for a room. Args: {"room_no": string}
2. "get_branch_summary": Look up attendance summary for a branch code (e.g., "CY", "CS", "IS"). Args: {"branch": string}
3. "get_absentees": Find absent students in a room, date, or subject. Args: {"room_no": string|null, "date": string|null, "subject_code": string|null}
4. "find_student": Look up attendance for a specific student. Args: {"usn": string|null, "name": string|null}
5. "multi_paper_absentees": List students absent in more than one exam paper. Args: {}
6. "general_qa": System capability or greetings questions not requiring DB query. Args: {}

Return valid JSON with:
{
  "tool": string,
  "args": dict
}
"""


async def _execute_tool(tool: str, args: dict[str, Any], db: AsyncSession) -> dict[str, Any]:
    """Execute read-only database query safely."""
    try:
        if tool == "get_room_summary":
            room_no = str(args.get("room_no") or args.get("room") or "").strip()
            summary = await svc.get_room_summary(db, room_no)
            return {"room_no": room_no, "sessions": summary}

        if tool == "get_branch_summary":
            branch = str(args.get("branch") or "").strip().upper()
            summary = await svc.get_branch_summary(db, branch)
            return {"branch": branch, "sessions": summary}

        if tool == "get_absentees":
            room_no = args.get("room_no") or args.get("room")
            date_val = args.get("date")
            subject_code = args.get("subject_code") or args.get("subject")
            sources = svc._current_sessions(room_no)
            stmt = (
                select(Attendance)
                .join(sources, sources.c.session_id == Attendance.session_id)
                .join(Session, Attendance.session_id == Session.id)
                .join(Form, Attendance.form_id == Form.id)
                .join(Student, Attendance.student_id == Student.id)
                .where(Attendance.status == "absent")
                .options(selectinload(Attendance.student), selectinload(Attendance.session), selectinload(Attendance.form))
            )
            if room_no:
                stmt = stmt.where(Form.room_no.ilike(f"%{str(room_no).strip()}%"))
            if subject_code:
                stmt = stmt.where(Session.subject_code.ilike(f"%{str(subject_code).strip()}%"))
            if date_val:
                d_str = str(date_val).strip()
                try:
                    from datetime import datetime, date
                    if "-" in d_str:
                        parts = d_str.split("-")
                        if len(parts[0]) == 4:
                            parsed_date = date.fromisoformat(d_str)
                        else:
                            parsed_date = datetime.strptime(d_str, "%d-%m-%Y").date()
                        stmt = stmt.where(Session.exam_date == parsed_date)
                    elif "/" in d_str:
                        parts = d_str.split("/")
                        if len(parts[0]) == 4:
                            parsed_date = datetime.strptime(d_str, "%Y/%m/%d").date()
                        else:
                            parsed_date = datetime.strptime(d_str, "%d/%m/%Y").date()
                        stmt = stmt.where(Session.exam_date == parsed_date)
                except Exception:
                    pass

            result = await db.execute(stmt)
            rows = result.scalars().all()
            return {
                "room_no": room_no,
                "date": date_val,
                "absentees": [
                    {
                        "room_no": r.form.room_no if r.form else room_no,
                        "usn": r.student.usn,
                        "name": r.student.name,
                        "branch": r.student.branch,
                        "subject_code": r.session.subject_code,
                        "exam_date": str(r.session.exam_date),
                    }
                    for r in rows
                ]
            }

        if tool == "find_student":
            usn = args.get("usn")
            name = args.get("name")
            stmt = select(Student).options(selectinload(Student.attendance).selectinload(Attendance.session))
            if usn:
                stmt = stmt.where(Student.usn.ilike(f"%{usn.strip()}%"))
            elif name:
                stmt = stmt.where(Student.name.ilike(f"%{name.strip()}%"))
            res = await db.execute(stmt)
            students = res.scalars().all()
            return {
                "students": [
                    {
                        "usn": s.usn,
                        "name": s.name,
                        "branch": s.branch,
                        "attendance": [
                            {
                                "subject": a.session.subject_code,
                                "date": str(a.session.exam_date),
                                "status": a.status,
                            }
                            for a in s.attendance
                        ],
                    }
                    for s in students
                ]
            }

        if tool == "multi_paper_absentees":
            sources = svc._current_sessions()
            stmt = (
                select(Student.usn, Student.name, Student.branch, func.count(Attendance.id).label("absent_count"))
                .select_from(Attendance)
                .join(sources, sources.c.session_id == Attendance.session_id)
                .join(Student, Student.id == Attendance.student_id)
                .where(Attendance.status == "absent")
                .group_by(Student.id, Student.usn, Student.name, Student.branch)
                .having(func.count(Attendance.id) > 1)
            )
            res = await db.execute(stmt)
            return {
                "multi_absentees": [
                    {"usn": r[0], "name": r[1], "branch": r[2], "absent_count": r[3]}
                    for r in res.all()
                ]
            }

        return {}
    except Exception as exc:
        await db.rollback()
        logger.warning("Tool execution error (%s): %s", tool, exc)
        return {"error": str(exc)}


async def handle_chat_message(
    user_message: str,
    history: List[ChatMessage],
    db: AsyncSession,
) -> str:
    """Process a user question using Gemini routing and grounded response generation."""
    client = genai.Client(api_key=settings.GEMINI_API_KEY)

    # 1. Route user message to a safe read tool
    try:
        routing_resp = await client.aio.models.generate_content(
            model=_MODEL,
            contents=[_ROUTER_PROMPT, f"User message: {user_message}"],
            config=genai_types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.0,
            ),
        )
        plan = json.loads(routing_resp.text or "{}")
        tool_name = plan.get("tool", "general_qa")
        tool_args = plan.get("args", {})
    except Exception as exc:
        logger.warning("Failed to route query: %s", exc)
        tool_name = "general_qa"
        tool_args = {}

    # 2. Run DB query if tool is data-fetching
    tool_data = {}
    if tool_name != "general_qa":
        tool_data = await _execute_tool(tool_name, tool_args, db)

    # 3. Grounded natural-language synthesizer
    synthesis_prompt = f"""You are VeriForm AI, a helpful and precise exam attendance assistant.
Answer the user's question accurately using ONLY the verified database information below.
Rules:
- If the requested room or student is completely unknown or not in the database, state "I don't have that data in the system."
- If the data shows an empty list of absentees (e.g. "absentees": [] or "multi_absentees": []), clearly state that no students were absent matching that query (e.g. "No students were absent in more than one paper" or "There are no absentees recorded for this session").
- Never hallucinate or guess students, USNs, or counts.
- Mention student names, USNs, subject codes, and room/exam dates when available in the database query result.
- Keep the response clear, professional, and concise.

Database query result:
{json.dumps(tool_data, default=str)}

User Question: {user_message}
"""

    try:
        ans_resp = await client.aio.models.generate_content(
            model=_MODEL,
            contents=synthesis_prompt,
            config=genai_types.GenerateContentConfig(
                temperature=0.1,
            ),
        )
        return ans_resp.text.strip() if ans_resp.text else "I don't have that data in the system."
    except Exception as exc:
        logger.error("Chat generation failed: %s", exc)
        return f"Unable to retrieve answer: {exc}"
