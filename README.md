# GovFlow AI

An AI-assisted correspondence and action-management system for government offices. NGOs and external parties submit letters/memos/notices as documents; a local LLM (Ollama) extracts structured information and recommends the responsible department; a coordinator confirms the routing; the receiving department manager actions it. Every step is logged to an audit trail.

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
- **Database**: SQLite, no migration framework — schema changes in this project were applied via one-off `ALTER TABLE` scripts (see git history if you're extending the schema yourself).

## Roles & workflow

| Role | Who | What they do |
|---|---|---|
| `submitter` | NGO / external party | Uploads a letter (PDF/DOCX/TXT); the AI analyzes it automatically. Can replace the document or delete the submission (and add follow-up notes any time) as long as it hasn't been routed yet. |
| `coordinator` | Central registry/triage | Reviews the AI's extraction in the **Approval Queue**, can correct any extracted field, confirms or overrides the recommended department, and routes it. Can also re-route (before the department starts work) if a mistake was made. |
| `dept_manager` | One per department (Administration & HR, Finance, Procurement) | Sees correspondence routed to their department, marks it in progress/closed, or bounces it back to the coordinator if it was misrouted. |
| `admin` | System administrator | Creates/edits departments and staff accounts (Users & Departments pages) — no correspondence access. |

Every account can change their own password from **Account Settings**.

**Status flow:** `submitted` → `pending_coordinator_review` → `routed` → `in_progress` → `closed`, with a `bounced_back` action returning a routed item to `pending_coordinator_review` for re-review. Every transition is written to `ActionHistory` and shown as a timeline on the correspondence detail page.

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
| `UPLOAD_FOLDER` | `backend/instance/uploads` | Where original uploaded documents are stored |

## Demo accounts

All use password `password123`.

| Username | Role |
|---|---|
| `ngo1` | Submitter |
| `coordinator1` | Coordinator |
| `hr_manager` | Dept Manager — Administration & HR |
| `finance_manager` | Dept Manager — Finance |
| `procurement_manager` | Dept Manager — Procurement |
| `admin1` | Admin |

## Feature list

**Mandatory (per project brief), minus RAG:**
- Document upload (PDF/DOCX/TXT) with text extraction
- AI-extracted subject, entities (sender, recipient, reference number, dates), main request, required action
- Department classification/recommendation
- Deadline & urgency detection
- Concise action summary
- Human review before any routing decision is final, including editing the AI's extracted fields
- Correspondence/action history (audit trail)
- Full web UI

**Beyond the brief:**
- Role-based access (submitter / coordinator / department manager / admin) with per-department queues
- Full NGO CRUD on their own letters — upload, replace document (re-analyzed), delete, and follow-up notes — locked once a letter is routed, to keep the audit trail intact for everyone downstream
- Coordinator can correct AI-extracted fields before routing, and re-route a letter if it was sent to the wrong department by mistake
- Department managers can bounce a misrouted letter back to the coordinator's queue with a required reason
- Admin role with in-app management of departments and staff accounts (no more editing the database by hand)
- Account self-service password change for every role
- Approval Queue and department queues sorted by priority (urgency + deadline) with overdue flags
- Analytics dashboard: volume by department/status/urgency, AI routing agreement rate, average time-to-route
- Search, filter, and pagination on all correspondence lists
- CSV export of correspondence lists
- Print/export-to-PDF for a single correspondence record (browser print dialog)
- Toast notifications and confirmation dialogs for every state-changing action
- Sidebar notification badges (coordinator's pending queue, manager's newly-routed items)
- View the original uploaded document (not just its extracted text), permission-gated the same as the correspondence record itself
- A cohesive visual design system: sidebar navigation, sender avatars, color-coded urgency/confidence/status chips, and animated transitions used consistently across every screen

## Screens

| Route | Role | Purpose |
|---|---|---|
| `/dashboard` | submitter | Welcome overview, recent submissions, "how it works" |
| `/submissions` | submitter | Upload new correspondence + full list with search/filter/delete |
| `/dashboard` | coordinator | Overview stats + all-correspondence list |
| `/queue` | coordinator | Approval Queue — items awaiting review, priority-sorted |
| `/analytics` | coordinator | Charts and routing-accuracy metrics |
| `/dashboard` | dept_manager | Department queue, priority-sorted |
| `/admin/users` | admin | Create/edit staff accounts |
| `/admin/departments` | admin | Create/edit departments |
| `/account` | any | Change password |
| `/correspondence/:id` | any (permission-gated) | Full detail view, role-specific actions, action history |

## Project structure

```
backend/
  app/
    routes/           auth, departments, correspondence, admin blueprints
    services/         ollama_service.py, extraction.py (prompt/parsing), file_extraction.py
    models.py         User, Department, Correspondence, ActionHistory
  seed.py             creates tables + demo departments/users
  run.py              dev entrypoint
frontend/
  src/
    pages/            one file per screen (dashboards, submissions, queue, analytics, admin, account, detail)
    components/       Layout (sidebar), Feedback (toasts/confirm), ui.jsx (primitives), TableControls (avatars/chips/pagination)
    utils/            priority.js (sorting/overdue), status.js (pre-routing gate), csv.js (export)
```
