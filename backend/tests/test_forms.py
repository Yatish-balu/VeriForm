"""
VeriForm — Backend Tests  (skeleton for Mahadev to fill in)
Run with:  pytest backend/tests/ -v
"""

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from app.main import app


@pytest_asyncio.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac


@pytest.mark.asyncio
async def test_health(client):
    response = await client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


@pytest.mark.asyncio
async def test_list_forms_empty(client):
    """Should return an empty list when no forms exist."""
    response = await client.get("/api/forms/")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


@pytest.mark.asyncio
async def test_get_nonexistent_form(client):
    """Should return 404 for a random UUID."""
    import uuid
    response = await client.get(f"/api/forms/{uuid.uuid4()}")
    assert response.status_code == 404


# TODO (Mahadev): add tests for:
#   - upload a valid form image (mock extract_form)
#   - resolve a doubt
#   - finalize blocked when doubts remain
#   - finalize succeeds after all doubts resolved
#   - room summary
#   - branch summary
#   - chatbot Q&A
