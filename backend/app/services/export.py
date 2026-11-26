"""
VeriForm — PDF Export Service (ReportLab)
Generates a Form-B attendance report PDF for a given Form ORM object.
"""

from __future__ import annotations

from datetime import datetime, timezone
from io import BytesIO
from typing import Dict, List, Optional, Tuple
from uuid import UUID

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    KeepTogether,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from app.models.orm import Attendance, Form, Session


_STATUS_LABELS: Dict[str, str] = {
    "present": "P",
    "absent": "Ab",
    "unclear": "Unclear",
}

_FORM_STATUS_BADGES: Dict[str, Tuple[str, colors.Color, colors.Color]] = {
    "final": ("FINAL", colors.HexColor("#166534"), colors.HexColor("#DCFCE7")),
    "needs_review": ("NEEDS REVIEW", colors.HexColor("#92400E"), colors.HexColor("#FEF3C7")),
    "processing": ("PROCESSING", colors.HexColor("#1E40AF"), colors.HexColor("#DBEAFE")),
}


def _format_timestamp(dt: Optional[datetime]) -> str:
    if dt is None:
        return "—"
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    else:
        dt = dt.astimezone(timezone.utc)
    return dt.strftime("%Y-%m-%d %H:%M UTC")


def _resolve_verification_info(form: Form) -> Tuple[str, str]:
    """Return (verified_by_display, timestamp_display) from attendance or form metadata."""
    resolved_rows = [
        row for row in (form.attendance or [])
        if row.resolved_by is not None or row.resolved_at is not None
    ]
    if resolved_rows:
        latest = max(
            resolved_rows,
            key=lambda r: r.resolved_at or datetime.min.replace(tzinfo=timezone.utc),
        )
        verifier = str(latest.resolved_by) if latest.resolved_by else "Reviewer"
        ts = _format_timestamp(latest.resolved_at or form.created_at)
        return verifier, ts

    if form.uploaded_by:
        return f"Uploaded by {form.uploaded_by}", _format_timestamp(form.created_at)
    return "Pending Review", _format_timestamp(form.created_at)


def generate_form_pdf(form: Form) -> bytes:
    """
    Build a Form-B attendance PDF using ReportLab and return raw PDF bytes.
    """
    sessions: List[Session] = sorted(
        list(form.sessions or []),
        key=lambda s: (s.exam_date, s.subject_code),
    )
    use_landscape = len(sessions) > 4
    page_size = landscape(A4) if use_landscape else A4

    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=page_size,
        leftMargin=14 * mm,
        rightMargin=14 * mm,
        topMargin=14 * mm,
        bottomMargin=14 * mm,
        title=f"Form B - Room {form.room_no}",
    )
    avail_width = page_size[0] - doc.leftMargin - doc.rightMargin

    base_styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "VeriFormTitle",
        parent=base_styles["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=15,
        leading=18,
        textColor=colors.HexColor("#0F172A"),
        spaceAfter=2,
    )
    subtitle_style = ParagraphStyle(
        "VeriFormSubtitle",
        parent=base_styles["Normal"],
        fontName="Helvetica",
        fontSize=9,
        leading=12,
        textColor=colors.HexColor("#475569"),
    )
    section_style = ParagraphStyle(
        "VeriFormSection",
        parent=base_styles["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=10.5,
        leading=14,
        textColor=colors.HexColor("#1E293B"),
        spaceBefore=6,
        spaceAfter=4,
    )
    cell_style = ParagraphStyle(
        "VeriFormCell",
        parent=base_styles["Normal"],
        fontName="Helvetica",
        fontSize=8.5,
        leading=10.5,
        textColor=colors.HexColor("#0F172A"),
    )
    cell_bold = ParagraphStyle(
        "VeriFormCellBold",
        parent=cell_style,
        fontName="Helvetica-Bold",
    )
    header_cell_style = ParagraphStyle(
        "VeriFormHeaderCell",
        parent=base_styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8,
        leading=10,
        alignment=TA_CENTER,
        textColor=colors.white,
    )

    elements: list = []

    # ── 1. Header Block ───────────────────────────────────────
    badge_text, badge_fg, badge_bg = _FORM_STATUS_BADGES.get(
        form.status,
        (form.status.upper(), colors.HexColor("#334155"), colors.HexColor("#E2E8F0")),
    )
    badge_style = ParagraphStyle(
        "StatusBadge",
        parent=base_styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8.5,
        leading=11,
        alignment=TA_CENTER,
        textColor=badge_fg,
    )

    title_table = Table(
        [[
            Paragraph("VeriForm — Exam Attendance Report (Form B)", title_style),
            Paragraph(badge_text, badge_style),
        ]],
        colWidths=[avail_width - 34 * mm, 34 * mm],
    )
    title_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("BACKGROUND", (1, 0), (1, 0), badge_bg),
        ("BOX", (1, 0), (1, 0), 0.75, badge_fg),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (0, 0), 0),
        ("RIGHTPADDING", (1, 0), (1, 0), 6),
    ]))
    elements.append(title_table)
    elements.append(Paragraph(f"Form ID: {form.id}", subtitle_style))
    elements.append(Spacer(1, 5 * mm))

    verified_by, timestamp_str = _resolve_verification_info(form)
    meta_rows = [
        [
            Paragraph("Room No", cell_bold),
            Paragraph(str(form.room_no or "—"), cell_style),
            Paragraph("Exam Name", cell_bold),
            Paragraph(str(form.exam_name or "—"), cell_style),
        ],
        [
            Paragraph("Semester", cell_bold),
            Paragraph(str(form.semester or "—"), cell_style),
            Paragraph("Department", cell_bold),
            Paragraph(str(form.department or "—"), cell_style),
        ],
        [
            Paragraph("Verified By", cell_bold),
            Paragraph(verified_by, cell_style),
            Paragraph("Timestamp", cell_bold),
            Paragraph(timestamp_str, cell_style),
        ],
    ]
    meta_widths = [26 * mm, avail_width * 0.34 - 26 * mm, 26 * mm, avail_width * 0.66 - 26 * mm]
    meta_table = Table(meta_rows, colWidths=meta_widths)
    meta_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#F1F5F9")),
        ("BACKGROUND", (2, 0), (2, -1), colors.HexColor("#F1F5F9")),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
    ]))
    elements.append(meta_table)
    elements.append(Spacer(1, 5 * mm))

    # ── 2. Attendance Grid Table ──────────────────────────────
    elements.append(Paragraph("Attendance Grid", section_style))

    # Group attendance rows by student
    student_rows: Dict[UUID, Dict] = {}
    for att in (form.attendance or []):
        entry = student_rows.setdefault(
            att.student_id,
            {
                "sl_no": att.sl_no,
                "usn": att.student.usn if att.student else "—",
                "name": att.student.name if att.student else "—",
                "cells": {},
            },
        )
        if entry["sl_no"] is None and att.sl_no is not None:
            entry["sl_no"] = att.sl_no
        entry["cells"][att.session_id] = att.status

    sorted_students = sorted(
        student_rows.values(),
        key=lambda r: (r["sl_no"] is None, r["sl_no"] or 0, r["usn"]),
    )

    grid_header = [
        Paragraph("Sl. No.", header_cell_style),
        Paragraph("USN", header_cell_style),
        Paragraph("Student Name", header_cell_style),
    ] + [
        Paragraph(f"{s.subject_code}<br/>{s.exam_date.isoformat()}", header_cell_style)
        for s in sessions
    ]

    grid_data: list = [grid_header]
    cell_status_styles: list = []

    for row_idx, stu in enumerate(sorted_students, start=1):
        sl_display = str(stu["sl_no"]) if stu["sl_no"] is not None else str(row_idx)
        row = [
            sl_display,
            stu["usn"],
            Paragraph(stu["name"], cell_style),
        ]
        for col_offset, sess in enumerate(sessions, start=3):
            raw_status = stu["cells"].get(sess.id)
            label = _STATUS_LABELS.get(raw_status or "", "—")
            row.append(label)
            if raw_status == "present":
                cell_status_styles.append(("TEXTCOLOR", (col_offset, row_idx), (col_offset, row_idx), colors.HexColor("#166534")))
            elif raw_status == "absent":
                cell_status_styles.extend([
                    ("TEXTCOLOR", (col_offset, row_idx), (col_offset, row_idx), colors.HexColor("#991B1B")),
                    ("FONTNAME", (col_offset, row_idx), (col_offset, row_idx), "Helvetica-Bold"),
                ])
            elif raw_status == "unclear":
                cell_status_styles.extend([
                    ("TEXTCOLOR", (col_offset, row_idx), (col_offset, row_idx), colors.HexColor("#92400E")),
                    ("BACKGROUND", (col_offset, row_idx), (col_offset, row_idx), colors.HexColor("#FEF3C7")),
                    ("FONTNAME", (col_offset, row_idx), (col_offset, row_idx), "Helvetica-Bold"),
                ])
        grid_data.append(row)

    if len(grid_data) == 1:
        grid_data.append(["—", "No attendance records", "—"] + ["—"] * len(sessions))

    sl_width = 14 * mm
    usn_width = 30 * mm
    sess_count = max(len(sessions), 1)
    sess_col_width = min(26 * mm, (avail_width - sl_width - usn_width - 44 * mm) / sess_count)
    name_width = avail_width - sl_width - usn_width - sess_col_width * len(sessions)
    grid_widths = [sl_width, usn_width, name_width] + [sess_col_width] * len(sessions)

    grid_table = Table(grid_data, colWidths=grid_widths, repeatRows=1)
    grid_style = [
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0F172A")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
        ("FONTSIZE", (0, 1), (-1, -1), 8.5),
        ("ALIGN", (0, 1), (0, -1), "CENTER"),
        ("ALIGN", (1, 1), (1, -1), "LEFT"),
        ("ALIGN", (3, 1), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]),
        ("GRID", (0, 0), (-1, -1), 0.45, colors.HexColor("#CBD5E1")),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
    ]
    grid_style.extend(cell_status_styles)
    grid_table.setStyle(TableStyle(grid_style))
    elements.append(grid_table)
    elements.append(Spacer(1, 5 * mm))

    # ── 3. Footer Summary Table ───────────────────────────────
    elements.append(Paragraph("Session Summary & Extracted Footer Counts", section_style))

    footer_present = form.footer_present_raw if form.footer_present_raw is not None else "—"
    footer_absent = form.footer_absent_raw if form.footer_absent_raw is not None else "—"
    extracted_footer_str = f"P: {footer_present}  |  Ab: {footer_absent}"

    summary_rows: list = [[
        Paragraph("Session (Subject / Date)", header_cell_style),
        Paragraph("Present", header_cell_style),
        Paragraph("Absent", header_cell_style),
        Paragraph("Unclear", header_cell_style),
        Paragraph("Total", header_cell_style),
        Paragraph("Extracted Footer", header_cell_style),
    ]]

    att_by_session: Dict[UUID, List[Attendance]] = {}
    for att in (form.attendance or []):
        att_by_session.setdefault(att.session_id, []).append(att)

    for sess in sessions:
        rows = att_by_session.get(sess.id, [])
        p_count = sum(1 for r in rows if r.status == "present")
        a_count = sum(1 for r in rows if r.status == "absent")
        u_count = sum(1 for r in rows if r.status == "unclear")
        total = len(rows)
        summary_rows.append([
            Paragraph(f"{sess.subject_code} ({sess.exam_date.isoformat()})", cell_style),
            str(p_count),
            str(a_count),
            str(u_count),
            str(total),
            extracted_footer_str,
        ])

    if len(summary_rows) == 1:
        summary_rows.append(["—", "0", "0", "0", "0", extracted_footer_str])

    summary_widths = [
        avail_width * 0.34,
        avail_width * 0.11,
        avail_width * 0.11,
        avail_width * 0.11,
        avail_width * 0.11,
        avail_width * 0.22,
    ]
    summary_table = Table(summary_rows, colWidths=summary_widths, repeatRows=1)
    summary_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1E293B")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
        ("FONTSIZE", (0, 1), (-1, -1), 8.5),
        ("ALIGN", (1, 1), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]),
        ("GRID", (0, 0), (-1, -1), 0.45, colors.HexColor("#CBD5E1")),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
    ]))
    elements.append(summary_table)
    elements.append(Spacer(1, 8 * mm))

    # ── 4. Invigilator Sign-off Block ─────────────────────────
    signoff_style_right = ParagraphStyle(
        "SignOffRight",
        parent=cell_style,
        alignment=TA_RIGHT,
    )
    signoff_table = Table(
        [
            [
                Paragraph("Invigilator Name & Signature:", cell_bold),
                "",
                Paragraph("Room Superintendent / Verifier:", cell_bold),
                "",
            ],
            [
                Paragraph("_________________________", cell_style),
                "",
                Paragraph("_________________________", cell_style),
                Paragraph("Date: ______________", signoff_style_right),
            ],
        ],
        colWidths=[avail_width * 0.36, avail_width * 0.10, avail_width * 0.34, avail_width * 0.20],
    )
    signoff_table.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.6, colors.HexColor("#94A3B8")),
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F8FAFC")),
        ("VALIGN", (0, 0), (-1, -1), "BOTTOM"),
        ("TOPPADDING", (0, 0), (-1, 0), 8),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 14),
        ("TOPPADDING", (0, 1), (-1, 1), 6),
        ("BOTTOMPADDING", (0, 1), (-1, 1), 8),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
    ]))
    elements.append(KeepTogether([Paragraph("Invigilator Sign-Off", section_style), signoff_table]))

    doc.build(elements)
    return buffer.getvalue()
