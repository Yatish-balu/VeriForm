"""
VeriForm — FastAPI Application Entry Point
Author: Bhanuprasad (wiring) | Team: Group 7
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.db.supabase_client import close_supabase
from app.routes import forms, doubts, summary, chat


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    try:
        yield
    finally:
        close_supabase()


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description=(
        "AI-powered B-form attendance extraction, human-in-the-loop review, "
        "room/branch summaries, and a Gemini chatbot."
    ),
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# ── CORS ─────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────
app.include_router(forms.router,   prefix="/api/forms",   tags=["Forms"])
app.include_router(doubts.router,  prefix="/api",         tags=["Doubts & Finalize"])
app.include_router(summary.router, prefix="/api/summary", tags=["Summaries"])
app.include_router(chat.router,    prefix="/api",         tags=["Chatbot"])


# ── Health check ─────────────────────────────────────────────
@app.get("/health", tags=["Health"])
async def health_check():
    return {"status": "ok", "version": settings.APP_VERSION}


# ── Run locally ──────────────────────────────────────────────
# uvicorn app.main:app --reload --port 8000
