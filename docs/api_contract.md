# VeriForm — API Contract

> **Base URL** `http://localhost:8000`  
> **Interactive docs** `/docs` (Swagger UI) · `/redoc`  
> All timestamps are **ISO-8601 / UTC**. All IDs are **UUID v4** strings.  
> `status` literals: `"processing"` | `"needs_review"` | `"final"`  
> `attendance` status literals: `"present"` | `"absent"` | `"unclear"`

Send the signed-in user's Supabase access token as `Authorization: Bearer <access_token>` for endpoints 1–9. These endpoints return `401` when the token is missing or invalid.

---

## Table of Contents

| # | Method | Path | Purpose |
|---|--------|------|---------|
| 1 | `POST` | [`/api/forms/upload`](#1-post-apiformsupload) | Upload B-form image, trigger AI extraction |
| 2 | `GET` | [`/api/forms`](#2-get-apiforms) | List all forms with open-doubt count |
| 3 | `GET` | [`/api/forms/{id}`](#3-get-apiformsid) | Full form detail (sessions + attendance + doubts) |
| 4 | `GET` | [`/api/forms/{id}/doubts`](#4-get-apiformsiddoubts) | List unresolved doubts for a form |
| 5 | `POST` | [`/api/doubts/{id}/resolve`](#5-post-apidoubtsidresolve) | Human reviewer resolves one doubt |
| 6 | `POST` | [`/api/forms/{id}/finalize`](#6-post-apiformsidfinalize) | Lock a form (blocks if doubts remain) |
| 7 | `GET` | [`/api/summary/room/{room_no}`](#7-get-apisummaryroomroom_no) | Room-wise attendance summary |
| 8 | `GET` | [`/api/summary/branch/{branch}`](#8-get-apisummarybranchbranch) | Branch-wise attendance summary |
| 9 | `POST` | [`/api/chat`](#9-post-apichat) | Gemini chatbot Q&A |
| 10 | `GET` | [`/api/reports/{id}`](#10-get-apireportsid) | Download PDF or CSV report for a form |

---

## Shared Types

### `FormOut`
> Source: `schemas.FormOut`

```json
{
  "id":                 "uuid",
  "room_no":            "string",
  "exam_name":          "string",
  "semester":           "string",
  "department":         "string",
  "image_url":          "string | null",
  "footer_present_raw": "string | null",
  "footer_absent_raw":  "string | null",
  "status":             "processing | needs_review | final",
  "uploaded_by":        "uuid | null",
  "created_at":         "2025-11-27T00:00:00Z"
}
```

### `SessionOut`
> Source: `schemas.SessionOut`

```json
{
  "id":           "uuid",
  "form_id":      "uuid",
  "exam_date":    "2025-11-10",
  "subject_code": "21CY51"
}
```

### `StudentOut`
> Source: `schemas.StudentOut`

```json
{
  "id":     "uuid",
  "usn":    "1MS21CY042",
  "name":   "Riya Sharma",
  "branch": "CY"
}
```

### `AttendanceOut`
> Source: `schemas.AttendanceOut`

```json
{
  "id":          "uuid",
  "form_id":     "uuid",
  "session_id":  "uuid",
  "student_id":  "uuid",
  "sl_no":       3,
  "status":      "present | absent | unclear",
  "confidence":  0.91,
  "ai_note":     "mark partially inked",
  "resolved_by": "uuid | null",
  "resolved_at": "2025-11-27T10:30:00Z | null",
  "student":     { "...StudentOut..." }
}
```

### `DoubtOut`
> Source: `schemas.DoubtOut`

```json
{
  "id":            "uuid",
  "form_id":       "uuid",
  "attendance_id": "uuid | null",
  "type":          "low_confidence | ab_mark | footer_mismatch | ...",
  "message":       "Human-readable description shown in Review Queue",
  "ai_guess":      "absent | null",
  "resolution":    "string | null",
  "resolved":      false,
  "created_at":    "2025-11-27T09:00:00Z"
}
```

---

## Endpoints

---

### 1 · `POST /api/forms/upload`

Upload a B-form scan. The server runs Gemini Vision extraction, persists all data, and generates doubts for low-confidence cells.

**Request** — `multipart/form-data`

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `file` | binary | ✅ | JPG / PNG / PDF, max 20 MB |
| `uploaded_by` | UUID (form field) | ❌ | Defaults to the signed-in user. If supplied, it must match the token. |

**Response `201 Created`** — `FormDetailOut`

```json
{
  "id":                 "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "room_no":            "101",
  "exam_name":          "5th Sem CIE-1",
  "semester":           "5",
  "department":         "Chemistry",
  "image_url":          "https://xyz.supabase.co/storage/v1/object/sign/bforms/forms/form-uuid.jpg?token=example",
  "footer_present_raw": "42",
  "footer_absent_raw":  "8",
  "status":             "needs_review",
  "uploaded_by":        "user-uuid",
  "created_at":         "2025-11-27T00:00:00Z",
  "sessions": [
    {
      "id":           "sess-uuid",
      "form_id":      "form-uuid",
      "exam_date":    "2025-11-10",
      "subject_code": "21CY51"
    }
  ],
  "attendance": [
    {
      "id":         "att-uuid",
      "form_id":    "form-uuid",
      "session_id": "sess-uuid",
      "student_id": "stu-uuid",
      "sl_no":      1,
      "status":     "present",
      "confidence": 0.97,
      "ai_note":    null,
      "resolved_by": null,
      "resolved_at": null,
      "student": { "id": "stu-uuid", "usn": "1MS21CY001", "name": "Anil Kumar", "branch": "CY" }
    }
  ],
  "doubts": [
    {
      "id":            "doubt-uuid",
      "form_id":       "form-uuid",
      "attendance_id": "att-uuid",
      "type":          "low_confidence",
      "message":       "Confidence 0.42 — mark is ambiguous",
      "ai_guess":      "absent",
      "resolution":    null,
      "resolved":      false,
      "created_at":    "2025-11-27T00:00:01Z"
    }
  ]
}
```

**Errors**

| Status | Condition |
|--------|-----------|
| `400` | Unsupported file type or contents that do not match the MIME type |
| `403` | Uploader UUID differs from the signed-in user |
| `413` | File exceeds 20 MB |
| `422` | Unreadable or inconsistent Form-B data |
| `502` | Extraction service error |
| `503` | Extraction or private storage is unavailable |

---

### 2 · `GET /api/forms`

List all uploaded forms with a count of still-open doubts.

**Query params** — optional `status=processing`, `status=needs_review`, or `status=final`.

**Response `200 OK`** — `List[FormListItem]`

> Source: `schemas.FormListItem`

```json
[
  {
    "id":          "form-uuid",
    "room_no":     "101",
    "exam_name":   "5th Sem CIE-1",
    "status":      "needs_review",
    "created_at":  "2025-11-27T00:00:00Z",
    "open_doubts": 3
  },
  {
    "id":          "form-uuid-2",
    "room_no":     "205",
    "exam_name":   "5th Sem CIE-1",
    "status":      "final",
    "created_at":  "2025-11-26T18:00:00Z",
    "open_doubts": 0
  }
]
```

**Errors** — `500` on DB failure

---

### 3 · `GET /api/forms/{id}`

Full form detail including all sessions, attendance rows (with nested student), and doubts.
The signed `image_url` expires after one hour. Fetch the form detail again for a fresh link.

**Path params**

| Param | Type | Description |
|-------|------|-------------|
| `id` | UUID | Form ID |

**Response `200 OK`** — `FormDetailOut` _(same shape as upload response above)_

**Errors**

| Status | Condition |
|--------|-----------|
| `404` | Form not found |
| `422` | `id` is not a valid UUID |

---

### 4 · `GET /api/forms/{id}/doubts`

Return every doubt belonging to a form (resolved and unresolved).

**Path params**

| Param | Type | Description |
|-------|------|-------------|
| `id` | UUID | Form ID |

**Response `200 OK`** — `List[DoubtOut]`

```json
[
  {
    "id":            "doubt-uuid",
    "form_id":       "form-uuid",
    "attendance_id": "att-uuid",
    "type":          "footer_mismatch",
    "message":       "Footer says 42 present but AI counted 40",
    "ai_guess":      null,
    "resolution":    null,
    "resolved":      false,
    "created_at":    "2025-11-27T00:00:01Z"
  }
]
```

**Errors**

| Status | Condition |
|--------|-----------|
| `404` | Form not found |

---

### 5 · `POST /api/doubts/{id}/resolve`

Human reviewer submits a decision for one doubt. Updates the linked attendance row to the chosen status.

**Path params**

| Param | Type | Description |
|-------|------|-------------|
| `id` | UUID | Doubt ID |

**Request Body** — `application/json` → `ResolveDoubtIn`

> Source: `schemas.ResolveDoubtIn`

```json
{
  "resolution":  "absent",
  "resolved_by": "user-uuid"
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `resolution` | string | ✅ | `"present"`, `"absent"`, or a custom note |
| `resolved_by` | UUID | ❌ | Defaults to the signed-in reviewer. If supplied, it must match the token. |
| `attendance_status` | `"present"` or `"absent"` | ❌ | Apply this attendance correction alongside a review note. Supply a status when resolving an unclear cell. |

**Response `200 OK`** — `DoubtOut`

```json
{
  "id":            "doubt-uuid",
  "form_id":       "form-uuid",
  "attendance_id": "att-uuid",
  "type":          "low_confidence",
  "message":       "Confidence 0.42 — mark is ambiguous",
  "ai_guess":      "absent",
  "resolution":    "absent",
  "resolved":      true,
  "created_at":    "2025-11-27T00:00:01Z"
}
```

**Errors**

| Status | Condition |
|--------|-----------|
| `403` | Reviewer UUID differs from the signed-in user |
| `404` | Doubt not found |
| `409` | The doubt already has a different resolution or its form is closed for review |
| `422` | Invalid review input or an unclear cell still needs a decision |

---

### 6 · `POST /api/forms/{id}/finalize`

Lock the form (`status → "final"`) after every doubt is resolved and each attendance cell is clear. Retrying finalization returns the current final form.

**Path params**

| Param | Type | Description |
|-------|------|-------------|
| `id` | UUID | Form ID |

**Request Body** — none

**Response `200 OK`** — `FormDetailOut`

```json
{
  "id":                 "form-uuid",
  "room_no":            "101",
  "exam_name":          "5th Sem CIE-1",
  "semester":           "5",
  "department":         "Chemistry",
  "image_url":          "https://...",
  "footer_present_raw": "42",
  "footer_absent_raw":  "8",
  "status":             "final",
  "uploaded_by":        "user-uuid",
  "created_at":         "2025-11-27T00:00:00Z",
  "sessions":           [],
  "attendance":        [],
  "doubts":            []
}
```

**Errors**

| Status | Condition |
|--------|-----------|
| `404` | Form not found |
| `409` | The form is processing, has open doubts, or still has unclear attendance |

---

### 7 · `GET /api/summary/room/{room_no}`

Returns one entry per exam date and subject in a room. Each entry uses the latest finalized upload for that paper if available. Otherwise it uses the latest upload awaiting review with `verified: false`. The percentage is present divided by all attendance rows, including unclear rows.

**Path params**

| Param | Type | Example |
|-------|------|---------|
| `room_no` | string | `101` |

**Response `200 OK`** — `RoomSummaryOut`

> Source: `schemas.RoomSummaryOut`, `SessionSummaryOut`

```json
{
  "room_no": "101",
  "sessions": [
    {
      "session_id":   "sess-uuid",
      "form_id":      "form-uuid",
      "exam_date":    "2025-11-10",
      "subject_code": "21CY51",
      "total":        50,
      "present":      42,
      "absent":        8,
      "unclear":       0,
      "verified":      true,
      "percentage":   84.0,
      "present_students": [
        { "id": "stu-uuid", "usn": "1MS21CY001", "name": "Anil Kumar", "branch": "CY" }
      ],
      "absent_students": [
        { "id": "stu-uuid-2", "usn": "1MS21CY015", "name": "Priya Nair", "branch": "CY" }
      ]
    }
  ]
}
```

**Errors**

| Status | Condition |
|--------|-----------|
| `404` | No forms found for `room_no` |

---

### 8 · `GET /api/summary/branch/{branch}`

Returns counts by branch, exam date, and subject across rooms. `session_ids` lists the room sessions included in the aggregate, with `session_id` identifying the first. `verified` is true when every contributing room session is finalized.

**Path params**

| Param | Type | Example |
|-------|------|---------|
| `branch` | string | `CY` (case-insensitive, uppercased internally) |

**Response `200 OK`** — `BranchSummaryOut`

> Source: `schemas.BranchSummaryOut`, `BranchSessionSummary`

```json
{
  "branch": "CY",
  "sessions": [
    {
      "session_id":   "sess-uuid",
      "session_ids":  ["sess-uuid", "other-sess-uuid"],
      "exam_date":    "2025-11-10",
      "subject_code": "21CY51",
      "total":        120,
      "present":      105,
      "absent":        15,
      "unclear":       0,
      "verified":      true,
      "percentage":   87.5
    }
  ]
}
```

**Errors**

| Status | Condition |
|--------|-----------|
| `404` | No attendance data for `branch` |

---

### 9 · `POST /api/chat`

Ask about attendance for a room or branch. Gemini interprets the question, and the server reads the matching attendance records and saves the conversation.

**Request Body** — `application/json` → `ChatIn`

> Source: `schemas.ChatIn`

```json
{
  "user_id": "user-uuid",
  "message": "What is the attendance summary for room 101?"
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `user_id` | UUID | ✅ | Must match the authenticated user. |
| `message` | string | ✅ | Natural-language query up to 2,000 characters. |

**Response `200 OK`** — `List[ChatOut]` _(always a single-item list — the assistant reply)_

> Source: `schemas.ChatOut`

```json
[
  {
    "id":         "msg-uuid",
    "role":       "assistant",
    "content":    "In room 101 on 10 November, 8 out of 50 students were absent for subject 21CY51.",
    "created_at": "2025-11-27T00:10:05Z"
  }
]
```

**Errors**

| Status | Condition |
|--------|-----------|
| `403` | User ID differs from the signed-in user |
| `422` | Invalid user ID or message |
| `503` | Chat service unavailable |

---

### 10 · `GET /api/reports/{id}`

Download an attendance report for a form as PDF or CSV.

> **Status:** stub — not yet implemented (`501` until Mahadev completes `services/reports.py`).

**Path params**

| Param | Type | Description |
|-------|------|-------------|
| `id` | UUID | Form ID |

**Query params**

| Param | Type | Required | Values |
|-------|------|----------|--------|
| `format` | string | ✅ | `pdf` or `csv` |

**Response (PDF) `200 OK`**

```
Content-Type: application/pdf
Content-Disposition: attachment; filename="form-<id>.pdf"

<binary PDF bytes>
```

Report includes: room/exam header, per-session attendance table (USN · Name · Status), present/absent counts, and percentage.

**Response (CSV) `200 OK`**

```
Content-Type: text/csv
Content-Disposition: attachment; filename="form-<id>.csv"

USN,Name,Branch,2025-11-10 (21CY51),2025-11-12 (21CY52)
1MS21CY001,Anil Kumar,CY,present,absent
1MS21CY002,Riya Sharma,CY,present,present
```

**Errors**

| Status | Condition |
|--------|-----------|
| `400` | `format` not `pdf` or `csv` |
| `404` | Form not found |
| `501` | Export not yet implemented |

---

## Error Envelope

All `4xx` / `5xx` responses follow FastAPI's default shape:

```json
{
  "detail": "Human-readable error message or list of validation errors"
}
```

Validation errors (`422`) expand `detail` to a list:

```json
{
  "detail": [
    {
      "loc":  ["body", "resolution"],
      "msg":  "field required",
      "type": "missing"
    }
  ]
}
```

---

## Status Transition Diagram

```
upload
  │
  ▼
processing ──(extraction done)──► needs_review ──(all doubts resolved)──► final
                                       │
                              (resolve doubts one by one via
                               POST /api/doubts/{id}/resolve)
```

---

*Auto-generated from `backend/app/models/schemas.py` and route handlers — keep in sync when adding fields.*
