# VeriForm — Room-wise Exam Attendance & Verification Agent

An AI-powered web application that automates reading physical **Form-B** exam attendance sheets, flags uncertain entries for human verification, generates room-wise and branch-wise summaries, and provides a database-grounded chatbot for instant attendance queries and report exports.

**Course / Project:** AAT — Group 7 (Department of CSE - Cyber Security, DSCE)  
**Team:** Yatish Balu, Gulivindala Bhanuprasad, Mahadev H, Sampada Desai  

---

## Key Features

- **Form-B Upload & Quality Checks:** Drag-and-drop upload for `JPG`, `PNG`, and `PDF` sheets with image preview, rotation/resize preprocessing, and automatic blur/darkness warnings before extraction.
- **Structured AI Extraction (Gemini Vision):** Parses room metadata, exam session headers (`date` + `subject_code`), student serial numbers, USNs, names, per-session attendance statuses (`present`, `absent`, `unclear`), confidence scores, and raw footer totals.
- **Validation & Human-in-the-Loop Review Queue:** Prevents silent AI guesses by raising reviewable doubts whenever:
  - Cell confidence falls below threshold (`< 0.75`)
  - A cell contains `"Ab"`, crosses, or ambiguous scribbles
  - Extracted present count mismatches the written footer count
  - Unusual footer formats appear (e.g., `"30+1"`, `"NIL"`)
  - A USN or name is hard to read, or a student is present in an earlier session and absent in a later one
  - *Forms cannot be marked **Final** until all open doubts are resolved.*
- **Room-wise & Branch-wise Summaries:** Computes total, present, absent, and attendance percentage per room and per branch (parsed directly from student USNs across batches such as `1DS22`, `1DS23`, `1DS24`).
- **Database-Grounded AI Chatbot:** Uses Gemini function calling over approved read-only backend tools (no raw SQL) to answer queries like *"Who was absent in Room CDS 105 on 03-11-2026?"* or *"Which students were absent in more than one paper?"*, citing source forms and avoiding hallucinations.
- **Report Exports & Audit History:** Download verified room-wise and branch-wise reports in **PDF** and **CSV** formats, and browse past uploads by status (`Processing`, `Needs Review`, `Final`).

---

## Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend** | React (Vite), Tailwind CSS, React Router, Axios |
| **Backend** | FastAPI, Pydantic, `google-genai` SDK, `reportlab` / `weasyprint` |
| **AI Models** | Google Gemini (Vision extraction + Function-calling Chatbot) |
| **Database & Storage** | Supabase (PostgreSQL, Storage, Auth) |
| **Deployment** | Vercel (Frontend), Render (Backend) |

---

## Repository Structure

```text
veriform/
├── backend/
│   ├── app/
│   │   ├── main.py             # FastAPI entrypoint, CORS, health check
│   │   ├── core/               # Config loader & environment settings
│   │   ├── models/             # Pydantic schemas
│   │   ├── db/                 # Supabase database service layer
│   │   ├── routes/             # forms.py, doubts.py, summary.py, chat.py
│   │   └── services/           # gemini_*, validation.py, prompts/, chat_tools.py, reports.py
│   ├── tests/                  # Pytest test suite
│   ├── sql/                    # schema.sql & seed scripts
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── api/                # Axios client & mock-data switch
│   │   ├── components/         # Shared UI components
│   │   └── pages/              # Login, Upload, History, Review Queue, Summaries, Chatbot
│   ├── package.json
│   └── .env.example
├── docs/                       # PRD, sample B-forms, testing sheet, report & slides
└── README.md
