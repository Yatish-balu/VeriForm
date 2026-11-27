-- =============================================================
-- VeriForm — Supabase PostgreSQL Schema
-- Group 7 | Author: Bhanuprasad
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- =============================================================

-- ─────────────────────────────────────────
-- EXTENSIONS
-- ─────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()

-- ─────────────────────────────────────────
-- ENUM-LIKE CHECK DOMAINS  (plain TEXT + CHECK keeps it simple)
-- ─────────────────────────────────────────

-- ─────────────────────────────────────────
-- TABLE: forms
-- One row per uploaded B-form sheet
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS forms (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    room_no             TEXT        NOT NULL,
    exam_name           TEXT        NOT NULL,
    semester            TEXT        NOT NULL,
    department          TEXT        NOT NULL,
    image_url           TEXT,                               -- private Storage object key
    footer_present_raw  TEXT,                               -- exactly as written on sheet
    footer_absent_raw   TEXT,
    status              TEXT        NOT NULL DEFAULT 'processing'
                            CHECK (status IN ('processing', 'needs_review', 'final')),
    uploaded_by         UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- TABLE: sessions
-- One row per exam-session column in a B-form
-- (each column = one date + one subject code)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sessions (
    id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    form_id         UUID    NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
    exam_date       DATE    NOT NULL,
    subject_code    TEXT    NOT NULL
);

-- ─────────────────────────────────────────
-- TABLE: students
-- Global student registry – one row per USN
-- branch is derived from USN but stored for fast queries
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS students (
    id      UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    usn     TEXT    UNIQUE NOT NULL,
    name    TEXT    NOT NULL,
    branch  TEXT    NOT NULL   -- e.g. "CY", "CS", "IS"
);

-- ─────────────────────────────────────────
-- TABLE: attendance
-- One row per (student × session × form)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS attendance (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    form_id         UUID        NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
    session_id      UUID        NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    student_id      UUID        NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    sl_no           INTEGER,                            -- serial number on the sheet
    status          TEXT        NOT NULL
                        CHECK (status IN ('present', 'absent', 'unclear')),
    confidence      FLOAT       CHECK (confidence BETWEEN 0.0 AND 1.0),
    ai_note         TEXT,                              -- why the AI flagged this cell
    resolved_by     UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
    resolved_at     TIMESTAMPTZ,
    UNIQUE (form_id, session_id, student_id)           -- no duplicate rows
);

-- ─────────────────────────────────────────
-- TABLE: doubts
-- One doubt raised per suspicious cell / condition
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS doubts (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    form_id         UUID        NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
    attendance_id   UUID        REFERENCES attendance(id) ON DELETE CASCADE,
    type            TEXT        NOT NULL,   -- e.g. 'low_confidence','footer_mismatch','ab_mark'
    message         TEXT        NOT NULL,   -- human-readable description shown in Review Queue
    ai_guess        TEXT,                  -- AI's initial guess ('present'/'absent'/'unclear')
    resolution      TEXT,                  -- what the reviewer decided
    resolved        BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- TABLE: chat_messages
-- Conversation history for the AI chatbot
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_messages (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role        TEXT        NOT NULL CHECK (role IN ('user', 'assistant')),
    content     TEXT        NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- INDEXES  (speed up common queries)
-- ─────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_forms_status       ON forms(status);
CREATE INDEX IF NOT EXISTS idx_forms_room_no      ON forms(room_no);
CREATE INDEX IF NOT EXISTS idx_forms_uploaded_by  ON forms(uploaded_by);

CREATE INDEX IF NOT EXISTS idx_sessions_form_id   ON sessions(form_id);

CREATE INDEX IF NOT EXISTS idx_students_usn       ON students(usn);
CREATE INDEX IF NOT EXISTS idx_students_branch    ON students(branch);

CREATE INDEX IF NOT EXISTS idx_attendance_form_id    ON attendance(form_id);
CREATE INDEX IF NOT EXISTS idx_attendance_session_id ON attendance(session_id);
CREATE INDEX IF NOT EXISTS idx_attendance_student_id ON attendance(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_status     ON attendance(status);

CREATE INDEX IF NOT EXISTS idx_doubts_form_id    ON doubts(form_id);
CREATE INDEX IF NOT EXISTS idx_doubts_resolved   ON doubts(resolved);

CREATE INDEX IF NOT EXISTS idx_chat_user_id      ON chat_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_created_at   ON chat_messages(created_at);

-- ─────────────────────────────────────────
-- ROW-LEVEL SECURITY (RLS)
-- Enable so that only authenticated users see their own data.
-- The service-role key (used by the FastAPI backend) bypasses RLS.
-- ─────────────────────────────────────────
ALTER TABLE forms           ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE students        ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance      ENABLE ROW LEVEL SECURITY;
ALTER TABLE doubts          ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages   ENABLE ROW LEVEL SECURITY;

-- Allow any authenticated user to read all forms / sessions / students / attendance / doubts
CREATE POLICY "auth_read_forms"      ON forms          FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_insert_forms"    ON forms          FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "auth_update_forms"    ON forms          FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "auth_read_sessions"   ON sessions       FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_insert_sessions" ON sessions       FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "auth_read_students"   ON students       FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_upsert_students" ON students       FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "auth_update_students" ON students       FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "auth_read_attendance"   ON attendance   FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_insert_attendance" ON attendance   FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "auth_update_attendance" ON attendance   FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "auth_read_doubts"     ON doubts         FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_insert_doubts"   ON doubts         FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "auth_update_doubts"   ON doubts         FOR UPDATE USING (auth.role() = 'authenticated');

-- Chat messages: users see only their own history
CREATE POLICY "own_chat_messages"    ON chat_messages  FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ─────────────────────────────────────────
-- STORAGE BUCKET  (run separately or via Supabase dashboard)
-- ─────────────────────────────────────────
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('bforms', 'bforms', false)
-- ON CONFLICT DO NOTHING;
-- (Uncomment if your Supabase plan supports SQL bucket creation)
