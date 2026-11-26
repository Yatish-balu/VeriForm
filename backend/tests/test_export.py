"""
VeriForm — PDF Export Tests
Run with:  pytest tests/test_export.py -v
"""

from __future__ import annotations

from datetime import date, datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch
import uuid

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.db.database import get_db
from app.main import app
from app.services.export import generate_form_pdf


def _make_sample_form(form_id: uuid.UUID | None = None) -> SimpleNamespace:
    fid = form_id or uuid.uuid4()
    sess_1 = SimpleNamespace(
        id=uuid.uuid4(),
        form_id=fid,
        exam_date=date(2025, 11, 10),
        subject_code="21CY51",
    )
    sess_2 = SimpleNamespace(
        id=uuid.uuid4(),
        form_id=fid,
        exam_date=date(2025, 11, 12),
        subject_code="21CY52",
    )
    stu_1 = SimpleNamespace(id=uuid.uuid4(), usn="1MS21CY001", name="Anil Kumar", branch="CY")
    stu_2 = SimpleNamespace(id=uuid.uuid4(), usn="1MS21CY002", name="Riya Sharma", branch="CY")
    reviewer_id = uuid.uuid4()
    now = datetime(2025, 11, 27, 10, 30, tzinfo=timezone.utc)

    attendance = [
        SimpleNamespace(
            id=uuid.uuid4(),
            form_id=fid,
            session_id=sess_1.id,
            student_id=stu_1.id,
            sl_no=1,
            status="present",
            resolved_by=reviewer_id,
            resolved_at=now,
            student=stu_1,
        ),
        SimpleNamespace(
            id=uuid.uuid4(),
            form_id=fid,
            session_id=sess_2.id,
            student_id=stu_1.id,
            sl_no=1,
            status="absent",
            resolved_by=reviewer_id,
            resolved_at=now,
            student=stu_1,
        ),
        SimpleNamespace(
            id=uuid.uuid4(),
            form_id=fid,
            session_id=sess_1.id,
            student_id=stu_2.id,
            sl_no=2,
            status="unclear",
            resolved_by=None,
            resolved_at=None,
            student=stu_2,
        ),
        SimpleNamespace(
            id=uuid.uuid4(),
            form_id=fid,
            session_id=sess_2.id,
            student_id=stu_2.id,
            sl_no=2,
            status="present",
            resolved_by=None,
            resolved_at=None,
            student=stu_2,
        ),
    ]

    return SimpleNamespace(
        id=fid,
        room_no="101",
        exam_name="5th Sem CIE-1",
        semester="5",
        department="Chemistry",
        status="final",
        uploaded_by=uuid.uuid4(),
        created_at=now,
        footer_present_raw="1",
        footer_absent_raw="1",
        sessions=[sess_1, sess_2],
        attendance=attendance,
        doubts=[],
    )


async def _override_get_db():
    yield object()


@pytest_asyncio.fixture
async def client():
    app.dependency_overrides[get_db] = _override_get_db
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            yield ac
    finally:
        app.dependency_overrides.pop(get_db, None)


def test_generate_form_pdf_returns_valid_pdf_bytes():
    form = _make_sample_form()
    pdf_bytes = generate_form_pdf(form)  # type: ignore[arg-type]

    assert isinstance(pdf_bytes, bytes)
    assert len(pdf_bytes) > 0
    assert pdf_bytes.startswith(b"%PDF-")


@pytest.mark.asyncio
async def test_export_nonexistent_form_returns_404(client: AsyncClient):
    missing_id = uuid.uuid4()
    with patch("app.routes.forms.svc.get_form", new=AsyncMock(return_value=None)):
        response = await client.get(f"/api/forms/{missing_id}/export")

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_export_populated_form_returns_pdf_response(client: AsyncClient):
    form_id = uuid.uuid4()
    sample_form = _make_sample_form(form_id=form_id)

    with patch("app.routes.forms.svc.get_form", new=AsyncMock(return_value=sample_form)):
        response = await client.get(f"/api/forms/{form_id}/export")

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/pdf")
    assert (
        response.headers["content-disposition"]
        == f'attachment; filename="form_b_{sample_form.room_no}_{form_id}.pdf"'
    )
    assert response.content.startswith(b"%PDF-")
