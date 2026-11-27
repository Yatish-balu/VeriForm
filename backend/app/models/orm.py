"""
VeriForm — SQLAlchemy ORM Models
Maps Python classes to the Supabase/PostgreSQL tables defined in schema.sql.
Author: Bhanuprasad
"""

from __future__ import annotations
import uuid
from datetime import datetime, date
from sqlalchemy import (
    Boolean, Column, Date, DateTime, Float, ForeignKey,
    Integer, String, Text, UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, relationship
from sqlalchemy.sql import func


class Base(DeclarativeBase):
    pass


# ─────────────────────────────────────────────────────────────
# Form
# ─────────────────────────────────────────────────────────────
class Form(Base):
    __tablename__ = "forms"

    id                  = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    room_no             = Column(Text, nullable=False)
    exam_name           = Column(Text, nullable=False)
    semester            = Column(Text, nullable=False)
    department          = Column(Text, nullable=False)
    image_url           = Column(Text, nullable=True)
    footer_present_raw  = Column(Text, nullable=True)
    footer_absent_raw   = Column(Text, nullable=True)
    status              = Column(Text, nullable=False, default="processing")
    uploaded_by         = Column(UUID(as_uuid=True), nullable=True)
    created_at          = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    sessions    = relationship("Session",    back_populates="form", cascade="all, delete-orphan")
    attendance  = relationship("Attendance", back_populates="form", cascade="all, delete-orphan")
    doubts      = relationship("Doubt",      back_populates="form", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Form id={self.id} room={self.room_no} status={self.status}>"


# ─────────────────────────────────────────────────────────────
# Session  (one exam column = one date + subject code)
# ─────────────────────────────────────────────────────────────
class Session(Base):
    __tablename__ = "sessions"

    id              = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    form_id         = Column(UUID(as_uuid=True), ForeignKey("forms.id", ondelete="CASCADE"), nullable=False)
    exam_date       = Column(Date, nullable=False)
    subject_code    = Column(Text, nullable=False)

    form        = relationship("Form",       back_populates="sessions")
    attendance  = relationship("Attendance", back_populates="session", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Session form={self.form_id} date={self.exam_date} subj={self.subject_code}>"


# ─────────────────────────────────────────────────────────────
# Student  (global registry, keyed by USN)
# ─────────────────────────────────────────────────────────────
class Student(Base):
    __tablename__ = "students"

    id      = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    usn     = Column(Text, unique=True, nullable=False, index=True)
    name    = Column(Text, nullable=False)
    branch  = Column(Text, nullable=False)

    attendance = relationship("Attendance", back_populates="student")

    def __repr__(self) -> str:
        return f"<Student usn={self.usn} name={self.name} branch={self.branch}>"


# ─────────────────────────────────────────────────────────────
# Attendance  (one row per student × session × form)
# ─────────────────────────────────────────────────────────────
class Attendance(Base):
    __tablename__ = "attendance"
    __table_args__ = (
        UniqueConstraint("form_id", "session_id", "student_id", name="uq_attendance"),
    )

    id              = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    form_id         = Column(UUID(as_uuid=True), ForeignKey("forms.id",    ondelete="CASCADE"), nullable=False)
    session_id      = Column(UUID(as_uuid=True), ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False)
    student_id      = Column(UUID(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE"), nullable=False)
    sl_no           = Column(Integer, nullable=True)
    status          = Column(Text, nullable=False)         # 'present' | 'absent' | 'unclear'
    confidence      = Column(Float, nullable=True)
    ai_note         = Column(Text, nullable=True)
    resolved_by     = Column(UUID(as_uuid=True), nullable=True)
    resolved_at     = Column(DateTime(timezone=True), nullable=True)

    form    = relationship("Form",    back_populates="attendance")
    session = relationship("Session", back_populates="attendance")
    student = relationship("Student", back_populates="attendance")
    doubts  = relationship("Doubt",   back_populates="attendance")

    def __repr__(self) -> str:
        return f"<Attendance student={self.student_id} session={self.session_id} status={self.status}>"


# ─────────────────────────────────────────────────────────────
# Doubt  (one per suspicious cell or form-level issue)
# ─────────────────────────────────────────────────────────────
class Doubt(Base):
    __tablename__ = "doubts"

    id              = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    form_id         = Column(UUID(as_uuid=True), ForeignKey("forms.id",      ondelete="CASCADE"), nullable=False)
    attendance_id   = Column(UUID(as_uuid=True), ForeignKey("attendance.id", ondelete="CASCADE"), nullable=True)
    type            = Column(Text, nullable=False)   # 'low_confidence','ab_mark','footer_mismatch', etc.
    message         = Column(Text, nullable=False)   # human-readable, shown in Review Queue
    ai_guess        = Column(Text, nullable=True)
    resolution      = Column(Text, nullable=True)
    resolved        = Column(Boolean, nullable=False, default=False)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())

    form        = relationship("Form",       back_populates="doubts")
    attendance  = relationship("Attendance", back_populates="doubts")

    def __repr__(self) -> str:
        return f"<Doubt type={self.type} resolved={self.resolved}>"


# ─────────────────────────────────────────────────────────────
# ChatMessage  (conversation history)
# ─────────────────────────────────────────────────────────────
class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id     = Column(UUID(as_uuid=True), nullable=False)
    role        = Column(Text, nullable=False)     # 'user' | 'assistant'
    content     = Column(Text, nullable=False)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())

    def __repr__(self) -> str:
        return f"<ChatMessage role={self.role} user={self.user_id}>"
