"""
VeriForm — Async SQLAlchemy Engine & Session Factory
Author: Bhanuprasad
"""

from __future__ import annotations
import sys
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool
from app.core.config import settings

# Create async engine using the DATABASE_URL from .env
# Expected format: postgresql+asyncpg://postgres:<password>@<host>:5432/postgres
_engine_kwargs: dict = {
    "echo": settings.DEBUG,
}
if "pytest" in sys.modules:
    # Avoid cross-loop connection reuse errors under pytest-asyncio
    _engine_kwargs["poolclass"] = NullPool
else:
    _engine_kwargs.update(pool_size=5, max_overflow=10, pool_pre_ping=True)

engine = create_async_engine(settings.DATABASE_URL, **_engine_kwargs)

# Session factory — use this in route dependencies
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_db() -> AsyncSession:  # type: ignore[return]
    """FastAPI dependency — yields an async DB session."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
