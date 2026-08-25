<<<<<<< HEAD
# GovFlow AI

An AI-assisted correspondence and action-management system for government offices. Staff and NGOs submit letters/memos/notices as documents; a local LLM (Ollama) extracts structured information and recommends the responsible department; a coordinator confirms the routing; the receiving department manager actions it. Every step is logged to an audit trail.

This project intentionally does **not** use RAG — it is an LLM-only correspondence triage tool. There is no retrieval against a policy knowledge base, so the "Policy/Procedure Needed" field is the model's own unverified suggestion, not a grounded fact.

## Architecture

```
React (Vite, Tailwind CSS)  →  Flask (SQLAlchemy, Flask-Login)  →  Ollama (llama3.2, local)
                                        ↓
                                  SQLite (govflow.db)
                                        ↓
                              Uploaded files (instance/uploads/)
```

- **Frontend**: React + React Router + Tailwind CSS v4 + Framer Motion (animation) + Recharts (analytics charts).
- **Backend**: Flask + Flask-SQLAlchemy + Flask-Login (session-based auth). No REST framework, just Blueprints.
- **LLM**: [Ollama](https://ollama.com) running locally, model `llama3.2` by default. The backend calls Ollama's `/api/chat` endpoint with `format: json` to get structured extraction.
- **Document extraction**: `pypdf` for PDF, `python-docx` for DOCX, plain decode for TXT.
- **Database**: SQLite, no migration framework — schema changes in this project were applied via one-off `ALTER TABLE` scripts (see git history / this file's notes below if you're extending the schema yourself).

## Roles & workflow

| Role | Who | What they do |
|---|---|---|
| `submitter` | NGO / external party | Uploads a letter (PDF/DOCX/TXT). The AI analyzes it automatically on upload. |
| `coordinator` | Central registry/triage | Reviews the AI's extraction + recommended department in the **Approval Queue**, confirms or overrides it, and routes it to the correct department. |
| `dept_manager` | One per department (Administration & HR, Finance, Procurement) | Sees correspondence routed to their department, marks it in progress / closed. |

Status flow: `submitted` → `ai_analyzed`/`pending_coordinator_review` → `routed` → `in_progress` → `closed`. Every transition is written to `ActionHistory` and shown as a timeline on the correspondence detail page.

## Setup

### Prerequisites
- Python 3.10+
- Node.js 18+
- [Ollama](https://ollama.com) installed and running, with the model pulled:
  ```bash
  ollama pull llama3.2
  ```

### Backend

```bash
cd backend
python -m venv ../venv          # if not already created
../venv/Scripts/python.exe -m pip install -r requirements.txt
../venv/Scripts/python.exe seed.py    # creates tables + demo accounts
../venv/Scripts/python.exe run.py     # runs on http://localhost:5000
```

### Frontend

```bash
cd frontend
npm install
npm run dev    # runs on http://localhost:5173
```

Both are also registered in `.claude/launch.json` as `backend` and `frontend` if you're using Claude Code's preview tooling.

### Configuration

Backend config lives in `backend/app/config.py`, overridable via a `.env` file in `backend/`:

| Variable | Default | Purpose |
|---|---|---|
| `SECRET_KEY` | `dev-secret-change-me` | Flask session signing key — set a real value outside local dev |
| `DATABASE_URL` | `sqlite:///.../govflow.db` | SQLAlchemy DB URI |
| `OLLAMA_HOST` | `http://localhost:11434` | Ollama server address |
| `OLLAMA_MODEL` | `llama3.2` | Model used for extraction |
| `FRONTEND_ORIGIN` | `http://localhost:5173` | Allowed CORS origin |

## Demo accounts

All use password `password123`.

| Username | Role |
|---|---|
| `ngo1` | Submitter |
| `coordinator1` | Coordinator |
| `hr_manager` | Dept Manager — Administration & HR |
| `finance_manager` | Dept Manager — Finance |
| `procurement_manager` | Dept Manager — Procurement |

## Feature list

**Mandatory (per project brief), minus RAG:**
- Document upload (PDF/DOCX/TXT) with text extraction
- AI-extracted subject, entities (sender, recipient, reference number, dates), main request, required action
- Department classification/recommendation
- Deadline & urgency detection
- Concise action summary
- Human review before any routing decision is final
- Correspondence/action history (audit trail)
- Full web UI

**Beyond the brief:**
- Role-based access (submitter / coordinator / department manager) with per-department queues
- Approval Queue with priority sorting (urgency + deadline) and overdue flags
- Analytics dashboard: volume by department/status/urgency, AI routing agreement rate, average time-to-route
- Search, filter, and pagination on all correspondence tables
- CSV export of correspondence lists
- Print/export-to-PDF for a single correspondence record (browser print dialog)
- Toast notifications and confirmation dialogs for state-changing actions
- View the original uploaded document (not just its extracted text), permission-gated the same as the correspondence record itself

## Project structure

```
backend/
  app/
    routes/          auth, departments, correspondence blueprints
    services/         ollama_service.py, extraction.py (prompt/parsing), file_extraction.py
    models.py          User, Department, Correspondence, ActionHistory
  seed.py             creates tables + demo departments/users
  run.py              dev entrypoint
frontend/
  src/
    pages/            one file per screen (dashboards, queue, analytics, detail)
    components/       Layout (sidebar), Feedback (toasts/confirm), ui.jsx (primitives), TableControls
    utils/            priority.js (sorting/overdue), csv.js (export)
```
=======
# Bille--initiative-
this repository is for the 10 days of the worshop
>>>>>>> 6d4e402ffe39fbffc7ee1119c63b3d2e5ba8de80
