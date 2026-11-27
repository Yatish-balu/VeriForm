"""
VeriForm — Backend Tests  (skeleton for Mahadev to fill in)
Run with:  pytest backend/tests/ -v
"""

from uuid import uuid4

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport

from app.db.auth import require_user
from app.main import app


@pytest_asyncio.fixture
async def client(monkeypatch):
    monkeypatch.setitem(app.dependency_overrides, require_user, uuid4)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac


@pytest.mark.asyncio
async def test_health(client):
    response = await client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


@pytest.mark.asyncio
async def test_form_history_requires_authentication():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/forms")
    assert response.status_code == 401
    assert response.headers["WWW-Authenticate"] == "Bearer"


@pytest.mark.asyncio
async def test_list_forms_empty(client):
    """Should return an empty list when no forms exist."""
    response = await client.get("/api/forms/")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


@pytest.mark.asyncio
async def test_get_nonexistent_form(client):
    """Should return 404 for a random UUID."""
    response = await client.get(f"/api/forms/{uuid4()}")
    assert response.status_code == 404


# TODO (Mahadev): add tests for:
#   - upload a valid form image (mock extract_form)
#   - resolve a doubt
#   - finalize blocked when doubts remain
#   - finalize succeeds after all doubts resolved
#   - room summary
#   - branch summary
#   - chatbot Q&A
