"""
VeriForm — PDF / CSV Report Export  (STUB for Mahadev)
Called by GET /api/reports/{id}?format=pdf|csv
"""

from __future__ import annotations


async def generate_pdf_report(form_id: str, summary_data: dict) -> bytes:
    """
    Generate a PDF report for a room-wise or branch-wise summary.

    TODO (Mahadev):
      - Use reportlab or weasyprint.
      - Include header (room/branch, exam name, date), counts table, present/absent lists.
      - Numbers must match what the Summary page shows.
    """
    raise NotImplementedError("PDF export not yet implemented — Mahadev.")


async def generate_csv_report(form_id: str, summary_data: dict) -> str:
    """
    Generate a CSV string for download.

    TODO (Mahadev):
      - Use Python's csv module or pandas.
      - Columns: USN, Name, Branch, <session1_date>, <session2_date>, ...
    """
    raise NotImplementedError("CSV export not yet implemented — Mahadev.")
