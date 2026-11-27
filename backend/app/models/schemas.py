"""
VeriForm — Pydantic Request / Response Schemas
Used by FastAPI routes for validation and serialisation.
Author: Bhanuprasad
"""

from __future__ import annotations
from datetime import date, datetime
from typing import Annotated, List, Literal, Optional
from uuid import UUID
from pydantic import BaseModel, Field, StringConstraints, model_validator


# ─────────────────────────────────────────────────────────────
# Shared / Base
# ─────────────────────────────────────────────────────────────
AttendanceStatus = Literal["present", "absent", "unclear"]
FormStatus       = Literal["processing", "needs_review", "final"]
MessageRole      = Literal["user", "assistant"]


# ─────────────────────────────────────────────────────────────
# Session
# ─────────────────────────────────────────────────────────────
class SessionOut(BaseModel):
    id:           UUID
    form_id:      UUID
    exam_date:    date
    subject_code: str

    model_config = {"from_attributes": True}


# ─────────────────────────────────────────────────────────────
# Student
# ─────────────────────────────────────────────────────────────
class StudentOut(BaseModel):
    id:     UUID
    usn:    str
    name:   str
    branch: str

    model_config = {"from_attributes": True}


# ─────────────────────────────────────────────────────────────
# Attendance
# ─────────────────────────────────────────────────────────────
class AttendanceOut(BaseModel):
    id:           UUID
    form_id:      UUID
    session_id:   UUID
    student_id:   UUID
    sl_no:        Optional[int]
    status:       AttendanceStatus
    confidence:   Optional[float]
    ai_note:      Optional[str]
    resolved_by:  Optional[UUID]
    resolved_at:  Optional[datetime]
    student:      Optional[StudentOut] = None

    model_config = {"from_attributes": True}


class AttendanceUpdateIn(BaseModel):
    status:      AttendanceStatus
    resolved_by: UUID


# ─────────────────────────────────────────────────────────────
# Doubt
# ─────────────────────────────────────────────────────────────
class DoubtOut(BaseModel):
    id:             UUID
    form_id:        UUID
    attendance_id:  Optional[UUID]
    type:           str
    message:        str
    ai_guess:       Optional[str]
    resolution:     Optional[str]
    resolved:       bool
    created_at:     datetime

    model_config = {"from_attributes": True}


class ResolveDoubtIn(BaseModel):
    resolution: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)] = Field(
        description="'present', 'absent', or a review note."
    )
    resolved_by: Optional[UUID] = Field(default=None, description="Defaults to the signed-in reviewer.")
    attendance_status: Optional[Literal["present", "absent"]] = Field(
        default=None, description="Attendance correction to apply alongside a review note."
    )

    @model_validator(mode="after")
    def check_attendance_decision(self):
        if self.attendance_status and self.resolution in ("present", "absent"):
            if self.attendance_status != self.resolution:
                raise ValueError("The attendance status and resolution must agree.")
        return self


# ─────────────────────────────────────────────────────────────
# Form  (list / detail / upload)
# ─────────────────────────────────────────────────────────────
class FormOut(BaseModel):
    id:                 UUID
    room_no:            str
    exam_name:          str
    semester:           str
    department:         str
    image_url:          Optional[str]
    footer_present_raw: Optional[str]
    footer_absent_raw:  Optional[str]
    status:             FormStatus
    uploaded_by:        Optional[UUID]
    created_at:         datetime

    model_config = {"from_attributes": True}


class FormDetailOut(FormOut):
    sessions:   List[SessionOut]  = []
    attendance: List[AttendanceOut] = []
    doubts:     List[DoubtOut]    = []


class FormListItem(BaseModel):
    id:         UUID
    room_no:    str
    exam_name:  str
    status:     FormStatus
    created_at: datetime
    open_doubts: int = 0

    model_config = {"from_attributes": True}


# ─────────────────────────────────────────────────────────────
# Summary
# ─────────────────────────────────────────────────────────────
class SessionSummaryOut(BaseModel):
    session_id:   UUID
    form_id:      UUID
    exam_date:    date
    subject_code: str
    total:        int
    present:      int
    absent:       int
    unclear:      int
    verified:     bool
    percentage:   float
    present_students: List[StudentOut] = []
    absent_students:  List[StudentOut] = []


class RoomSummaryOut(BaseModel):
    room_no:   str
    sessions:  List[SessionSummaryOut] = []


class BranchSessionSummary(BaseModel):
    session_id:   UUID
    session_ids:  List[UUID]
    exam_date:    date
    subject_code: str
    total:        int
    present:      int
    absent:       int
    unclear:      int
    verified:     bool
    percentage:   float


class BranchSummaryOut(BaseModel):
    branch:   str
    sessions: List[BranchSessionSummary] = []


# ─────────────────────────────────────────────────────────────
# Chat
# ─────────────────────────────────────────────────────────────
class ChatIn(BaseModel):
    user_id: UUID
    message: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=2000)]


class ChatOut(BaseModel):
    id:         UUID
    role:       MessageRole
    content:    str
    created_at: datetime

    model_config = {"from_attributes": True}


# ─────────────────────────────────────────────────────────────
# Health
# ─────────────────────────────────────────────────────────────
class HealthOut(BaseModel):
    status:  str
    version: str
