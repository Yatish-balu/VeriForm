-- =============================================================
-- VeriForm — Seed Script (sample data for Room CDS 105)
-- Author: Bhanuprasad
-- Run AFTER schema.sql.
-- Uses a placeholder user UUID — replace with a real Supabase auth.users id.
-- =============================================================

-- ─────────────────────────────────────────
-- SAMPLE STUDENTS  (Room CDS 105, CIA Test-III Nov 2026)
-- USN pattern: 1DS22CY / 1DS23CY / 1DS24CY
-- ─────────────────────────────────────────
INSERT INTO students (usn, name, branch) VALUES
    ('1DS23CY001', 'Aarav Sharma',         'CY'),
    ('1DS23CY002', 'Bhavya Reddy',         'CY'),
    ('1DS23CY003', 'Chetan Kulkarni',      'CY'),
    ('1DS23CY004', 'Deepika Nair',         'CY'),
    ('1DS23CY005', 'Eshan Mehta',          'CY'),
    ('1DS22CY010', 'Farhan Khan',          'CY'),
    ('1DS22CY011', 'Gowri Venkatesh',      'CY'),
    ('1DS24CY020', 'Harini Subramaniam',   'CY'),
    ('1DS24CY021', 'Ishaan Bose',          'CY'),
    ('1DS23CS050', 'Jaya Krishnamurthy',   'CS')
ON CONFLICT (usn) DO NOTHING;

-- ─────────────────────────────────────────
-- SAMPLE FORM  (Room CDS 105)
-- uploaded_by: replace '00000000-0000-0000-0000-000000000001' with real user UUID
-- ─────────────────────────────────────────
INSERT INTO forms (id, room_no, exam_name, semester, department, image_url,
                   footer_present_raw, footer_absent_raw, status, uploaded_by)
VALUES (
    '11111111-1111-1111-1111-111111111111',
    'CDS 105',
    'CIA Test-III, November 2026',
    '5th Semester',
    'CSE - Cyber Security',
    NULL,            -- image not uploaded in seed
    '32',
    '0',
    'needs_review',
    NULL             -- replace with a valid auth.users UUID after creating a user
);

-- ─────────────────────────────────────────
-- SAMPLE SESSIONS  (3 exam columns)
-- ─────────────────────────────────────────
INSERT INTO sessions (id, form_id, exam_date, subject_code) VALUES
    ('22222222-2222-2222-2222-222222222221', '11111111-1111-1111-1111-111111111111', '2026-11-02', '22CY72'),
    ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', '2026-11-03', '22CY741'),
    ('22222222-2222-2222-2222-222222222223', '11111111-1111-1111-1111-111111111111', '2026-11-04', '22CY742');

-- ─────────────────────────────────────────
-- SAMPLE ATTENDANCE  (a mix of present / absent / unclear)
-- ─────────────────────────────────────────
-- Student 1: present in all 3 sessions
INSERT INTO attendance (form_id, session_id, student_id, sl_no, status, confidence) VALUES
    ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222221', (SELECT id FROM students WHERE usn='1DS23CY001'), 1, 'present', 0.97),
    ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', (SELECT id FROM students WHERE usn='1DS23CY001'), 1, 'present', 0.96),
    ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222223', (SELECT id FROM students WHERE usn='1DS23CY001'), 1, 'present', 0.95);

-- Student 2: absent in session 2 (triggers "Ab" mark doubt)
INSERT INTO attendance (form_id, session_id, student_id, sl_no, status, confidence, ai_note) VALUES
    ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222221', (SELECT id FROM students WHERE usn='1DS23CY002'), 2, 'present',  0.92, NULL),
    ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', (SELECT id FROM students WHERE usn='1DS23CY002'), 2, 'absent',   0.88, 'Ab written in red ink'),
    ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222223', (SELECT id FROM students WHERE usn='1DS23CY002'), 2, 'present',  0.91, NULL);

-- Student 3: unclear in session 1 (low confidence)
INSERT INTO attendance (form_id, session_id, student_id, sl_no, status, confidence, ai_note) VALUES
    ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222221', (SELECT id FROM students WHERE usn='1DS23CY003'), 3, 'unclear',  0.55, 'Scribble in cell, cannot determine signature'),
    ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', (SELECT id FROM students WHERE usn='1DS23CY003'), 3, 'present',  0.90, NULL),
    ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222223', (SELECT id FROM students WHERE usn='1DS23CY003'), 3, 'absent',   0.85, NULL);

-- ─────────────────────────────────────────
-- SAMPLE DOUBTS
-- ─────────────────────────────────────────
INSERT INTO doubts (form_id, attendance_id, type, message, ai_guess, resolved) VALUES
(
    '11111111-1111-1111-1111-111111111111',
    (SELECT a.id FROM attendance a
       JOIN students s ON s.id = a.student_id
       JOIN sessions ss ON ss.id = a.session_id
      WHERE s.usn = '1DS23CY002' AND ss.subject_code = '22CY741'),
    'ab_mark',
    'Row 2, 03-11-2026 (22CY741): "Ab" written in red — marked absent or unclear, please confirm.',
    'absent',
    FALSE
),
(
    '11111111-1111-1111-1111-111111111111',
    (SELECT a.id FROM attendance a
       JOIN students s ON s.id = a.student_id
       JOIN sessions ss ON ss.id = a.session_id
      WHERE s.usn = '1DS23CY003' AND ss.subject_code = '22CY72'),
    'low_confidence',
    'Row 3, 02-11-2026 (22CY72): confidence 0.55 — Is this a signature or a scribble?',
    'unclear',
    FALSE
),
(
    '11111111-1111-1111-1111-111111111111',
    NULL,
    'footer_mismatch',
    'Footer says "32" present but AI counted 31 definite signatures. Please verify.',
    NULL,
    FALSE
);
