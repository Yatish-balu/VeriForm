"""
Generate backend/sql/seed.sql containing:
- 137 authentic students from Sem 3 and Sem 5 rosters
- Realistic sample form with team members (Bhanu, Mahadev, Sampada, Yatish) for testing
"""

import sys
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from scripts.extract_rosters import get_all_roster_students
from scripts.populate_students import format_student_name

def generate():
    s3, s5 = get_all_roster_students()
    all_students = s3 + s5

    lines = []
    lines.append("-- =============================================================")
    lines.append("-- VeriForm — Seed Script (Authentic Student Rosters)")
    lines.append("-- Author: Bhanuprasad")
    lines.append("-- Run AFTER schema.sql.")
    lines.append("-- Populates real students from Sem-3 and Sem-5 rosters.")
    lines.append("-- =============================================================\n")

    lines.append("-- ─────────────────────────────────────────")
    lines.append("-- REAL STUDENTS (Semester 3 & Semester 5 Cyber Security)")
    lines.append("-- ─────────────────────────────────────────")
    lines.append("INSERT INTO students (usn, name, branch) VALUES")

    val_lines = []
    for st in all_students:
        cleaned_name = format_student_name(st["name"]).replace("'", "''")
        usn = st["usn"].strip().upper()
        val_lines.append(f"    ('{usn}', '{cleaned_name}', 'CY')")

    lines.append(",\n".join(val_lines))
    lines.append("ON CONFLICT (usn) DO UPDATE SET name = EXCLUDED.name, branch = EXCLUDED.branch;\n")

    lines.append("""-- ─────────────────────────────────────────
-- SAMPLE FORM  (Room CDS 105, 5th Semester)
-- ─────────────────────────────────────────
INSERT INTO forms (id, room_no, exam_name, semester, department, image_url,
                   footer_present_raw, footer_absent_raw, status, uploaded_by)
VALUES (
    '11111111-1111-1111-1111-111111111111',
    'CDS 105',
    'Continuous Internal Assessment Test-III - November 2026',
    '5th Semester',
    'CSE - Cyber Security',
    NULL,
    '4',
    '0',
    'needs_review',
    NULL
) ON CONFLICT (id) DO UPDATE SET room_no = EXCLUDED.room_no, status = EXCLUDED.status;

-- ─────────────────────────────────────────
-- SAMPLE SESSIONS (3 Exam Papers)
-- ─────────────────────────────────────────
INSERT INTO sessions (id, form_id, exam_date, subject_code) VALUES
    ('22222222-2222-2222-2222-222222222221', '11111111-1111-1111-1111-111111111111', '2026-11-02', '22CY51'),
    ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', '2026-11-03', '22CY52'),
    ('22222222-2222-2222-2222-222222222223', '11111111-1111-1111-1111-111111111111', '2026-11-04', '22CY53')
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────
-- SAMPLE ATTENDANCE (Featuring VeriForm team members)
-- ─────────────────────────────────────────
-- Bhanu Prasad (1DS24CY015): Present in all 3 sessions
INSERT INTO attendance (form_id, session_id, student_id, sl_no, status, confidence) VALUES
    ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222221', (SELECT id FROM students WHERE usn='1DS24CY015'), 1, 'present', 0.98),
    ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', (SELECT id FROM students WHERE usn='1DS24CY015'), 1, 'present', 0.99),
    ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222223', (SELECT id FROM students WHERE usn='1DS24CY015'), 1, 'present', 0.97)
ON CONFLICT DO NOTHING;

-- Mahadev H (1DS24CY021): Present in all 3 sessions
INSERT INTO attendance (form_id, session_id, student_id, sl_no, status, confidence) VALUES
    ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222221', (SELECT id FROM students WHERE usn='1DS24CY021'), 2, 'present', 0.95),
    ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', (SELECT id FROM students WHERE usn='1DS24CY021'), 2, 'present', 0.96),
    ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222223', (SELECT id FROM students WHERE usn='1DS24CY021'), 2, 'present', 0.94)
ON CONFLICT DO NOTHING;

-- Sampada Ajay Desai (1DS24CY035): Present, absent in session 2 (triggers review queue doubt)
INSERT INTO attendance (form_id, session_id, student_id, sl_no, status, confidence, ai_note) VALUES
    ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222221', (SELECT id FROM students WHERE usn='1DS24CY035'), 3, 'present', 0.97, NULL),
    ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', (SELECT id FROM students WHERE usn='1DS24CY035'), 3, 'absent',  0.92, 'Marked Ab in red'),
    ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222223', (SELECT id FROM students WHERE usn='1DS24CY035'), 3, 'present', 0.95, NULL)
ON CONFLICT DO NOTHING;

-- Yatish Balu (1DS24CY060): Present in session 1 & 2, unclear in session 3 (triggers low confidence doubt)
INSERT INTO attendance (form_id, session_id, student_id, sl_no, status, confidence, ai_note) VALUES
    ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222221', (SELECT id FROM students WHERE usn='1DS24CY060'), 4, 'present', 0.96, NULL),
    ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', (SELECT id FROM students WHERE usn='1DS24CY060'), 4, 'present', 0.94, NULL),
    ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222223', (SELECT id FROM students WHERE usn='1DS24CY060'), 4, 'unclear', 0.58, 'Light signature pencil mark')
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────
-- SAMPLE DOUBTS (For Sampada to test Review Queue UI)
-- ─────────────────────────────────────────
INSERT INTO doubts (form_id, attendance_id, type, message, ai_guess, resolved) VALUES
(
    '11111111-1111-1111-1111-111111111111',
    (SELECT a.id FROM attendance a
       JOIN students s ON s.id = a.student_id
       JOIN sessions ss ON ss.id = a.session_id
      WHERE s.usn = '1DS24CY035' AND ss.subject_code = '22CY52'),
    'ab_mark',
    'Row 3, 03-11-2026 (22CY52): "Ab" written in red — please confirm if student was absent.',
    'absent',
    FALSE
),
(
    '11111111-1111-1111-1111-111111111111',
    (SELECT a.id FROM attendance a
       JOIN students s ON s.id = a.student_id
       JOIN sessions ss ON ss.id = a.session_id
      WHERE s.usn = '1DS24CY060' AND ss.subject_code = '22CY53'),
    'low_confidence',
    'Row 4, 04-11-2026 (22CY53): confidence 0.58 — Is this a signature or a scribble?',
    'unclear',
    FALSE
);
""")

    out_file = backend_dir / "sql" / "seed.sql"
    out_file.write_text("\n".join(lines), encoding="utf-8")
    print(f"Generated {out_file} with {len(all_students)} authentic students!")

if __name__ == "__main__":
    generate()
