# Project
VeriForm — Room-wise Exam Attendance AI Agent.
Users upload a photo or PDF of a signed exam Form-B; Gemini Flash vision extracts room details, exam sessions, and per-student present/absent/unclear statuses; uncertain cells and footer mismatches become "doubts" that staff resolve in a Review Queue before finalizing; a read-only AI chatbot answers queries and exports PDF/CSV reports from Supabase.

# Stack & Folder Ownership
- Backend: Python 3.11+, FastAPI, Pydantic v2, `google-genai` (`gemini-2.5-flash`), `supabase` (`supabase-py`), OpenCV, Pillow, ReportLab (`backend/`).
- Frontend: React + Vite + Tailwind CSS + Axios (`frontend/` — owned exclusively by Sampada; never modify `frontend/` files).
- Database & Storage: Supabase Postgres, Auth, and private `sheets` bucket (`backend/sql/`).
- API Contract: `docs/api_contract.md` (single source of truth for all JSON shapes).

# Coding Rules
- Reply with production-ready code only; no long explanations.
- Touch only the specific files named in the prompt.
- Enforce strict Python type hints and Pydantic models for all request, response, and extraction schemas.
- Never guess cell statuses: low-confidence, crossed-out, or ambiguous cells must be marked `unclear` and routed to the doubt engine.
- Never hardcode API keys or URLs; load all secrets from `.env` via `pydantic-settings`.