import os
import threading
import uuid

from flask import Blueprint, request, jsonify, current_app, send_from_directory
from flask_login import login_required, current_user
from werkzeug.utils import secure_filename

from app.extensions import db
from app.models import (
    Correspondence,
    Department,
    ActionHistory,
    User,
    ROLE_SUBMITTER,
    ROLE_COORDINATOR,
    ROLE_DEPT_MANAGER,
    STATUS_SUBMITTED,
    STATUS_AI_ANALYZED,
    STATUS_PENDING_REVIEW,
    STATUS_ROUTED,
    STATUS_IN_PROGRESS,
    STATUS_CLOSED,
    utcnow,
)
from app.services.ollama_service import call_ollama_json, OllamaError
from app.services.extraction import build_extraction_prompt, normalize_extraction
from app.services.file_extraction import extract_text, ExtractionError
from app.services.email_service import send_email
from app.utils import role_required

bp = Blueprint("correspondence", __name__, url_prefix="/api/correspondence")

# A submission can attach several documents at once, but each one becomes its
# own independent Correspondence record — its own AI extraction, its own
# recommended department, its own routing — since attached files are often
# unrelated letters that belong with different departments, not one bundle.
MAX_FILES_PER_SUBMISSION = 10
MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024

EDITABLE_FIELDS = [
    "document_type",
    "sender",
    "recipient",
    "department_mentioned",
    "reference_number",
    "document_date",
    "subject",
    "main_request",
    "required_action",
    "deadline",
    "urgency",
    "policy_procedure_needed",
]

# A submitter may only edit/delete their own letter before anyone downstream
# (coordinator/dept manager) has acted on it, so the audit trail stays intact
# for everyone once it's routed.
PRE_ROUTING_STATUSES = (STATUS_SUBMITTED, STATUS_AI_ANALYZED, STATUS_PENDING_REVIEW)


def _save_uploaded_file(uploaded_file, file_bytes):
    stored_filename = f"{uuid.uuid4().hex}_{secure_filename(uploaded_file.filename)}"
    with open(os.path.join(current_app.config["UPLOAD_FOLDER"], stored_filename), "wb") as f:
        f.write(file_bytes)
    return stored_filename


def _delete_stored_file(stored_filename):
    if not stored_filename:
        return
    path = os.path.join(current_app.config["UPLOAD_FOLDER"], stored_filename)
    if os.path.exists(path):
        os.remove(path)


_UNSET = object()


def _log(correspondence_id, action, note=None, actor_id=_UNSET):
    # actor_id defaults to the logged-in user (normal request-time actions).
    # Pass actor_id=None explicitly for system/background actions where
    # there's no request context to read current_user from.
    if actor_id is _UNSET:
        actor_id = current_user.id if current_user.is_authenticated else None
    entry = ActionHistory(
        correspondence_id=correspondence_id,
        actor_id=actor_id,
        action=action,
        note=note,
    )
    db.session.add(entry)


def _run_ai_analysis(correspondence: Correspondence):
    # actor_id is explicitly None (attributed to "system") rather than left to
    # _log's current_user default: this runs from a background thread with no
    # request context, where touching current_user raises RuntimeError.
    departments = Department.query.all()
    prompt = build_extraction_prompt(correspondence.raw_text, departments)

    try:
        raw = call_ollama_json(prompt)
        fields = normalize_extraction(raw, departments)
        for key, value in fields.items():
            setattr(correspondence, key, value)
        correspondence.status = STATUS_PENDING_REVIEW
        correspondence.ai_error = None
        dept_id = fields.get("recommended_department_id")
        dept_name = next((d.name for d in departments if d.id == dept_id), None)
        note = f"Recommended department: {dept_name}" if dept_name else "No department could be determined"
        _log(correspondence.id, "ai_analyzed", note=note, actor_id=None)
    except OllamaError as exc:
        correspondence.status = STATUS_AI_ANALYZED
        correspondence.ai_error = str(exc)
        _log(correspondence.id, "ai_analysis_failed", note=str(exc), actor_id=None)


def _run_ai_analysis_in_background(correspondence_id):
    """Runs the extraction off the request thread so a submitter's upload
    returns immediately instead of blocking on the LLM call. Needs its own
    app context + DB session since it's outside the request lifecycle."""
    _run_batch_analysis_in_background([correspondence_id])


def _run_batch_analysis_in_background(correspondence_ids):
    """Same as _run_ai_analysis_in_background, but for several records from
    one multi-file submission. These run one at a time in a single thread
    rather than one thread per file — Ollama only runs one generation at a
    time on this hardware anyway, so firing N threads at once just means
    N requests queue up and compete, with later ones waiting long enough to
    risk timing out. Processing them in order is no slower in total and
    doesn't risk that."""
    app = current_app._get_current_object()

    def worker():
        with app.app_context():
            for correspondence_id in correspondence_ids:
                c = Correspondence.query.get(correspondence_id)
                if c is None:
                    continue
                _run_ai_analysis(c)
                db.session.commit()

    threading.Thread(target=worker, daemon=True).start()


def _send_email_in_background(to_address, subject, body):
    """Same reasoning as the AI analysis background helpers above — an SMTP
    server can be slow or unreachable, and a notification email should never
    be able to delay the actual action (a submission, a forward) that
    triggered it."""
    if not to_address:
        return
    app = current_app._get_current_object()

    def worker():
        with app.app_context():
            send_email(to_address, subject, body)

    threading.Thread(target=worker, daemon=True).start()


@bp.post("")
@login_required
@role_required(ROLE_SUBMITTER)
def create_correspondence():
    uploaded_files = [f for f in request.files.getlist("files") if f.filename]
    if not uploaded_files:
        return jsonify({"error": "At least one document file (PDF, DOCX, or TXT) is required"}), 400
    if len(uploaded_files) > MAX_FILES_PER_SUBMISSION:
        return jsonify({"error": f"You can submit up to {MAX_FILES_PER_SUBMISSION} files at once"}), 400

    created = []
    failed = []

    for uploaded_file in uploaded_files:
        file_bytes = uploaded_file.read()

        if len(file_bytes) > MAX_FILE_SIZE_BYTES:
            failed.append({"filename": uploaded_file.filename, "error": "File exceeds the 10 MB limit"})
            continue

        try:
            raw_text = extract_text(uploaded_file.filename, file_bytes)
        except ExtractionError as exc:
            failed.append({"filename": uploaded_file.filename, "error": str(exc)})
            continue

        stored_filename = _save_uploaded_file(uploaded_file, file_bytes)

        correspondence = Correspondence(
            submitter_id=current_user.id,
            raw_text=raw_text,
            source_filename=uploaded_file.filename,
            stored_filename=stored_filename,
            status=STATUS_SUBMITTED,
        )
        db.session.add(correspondence)
        db.session.flush()  # assigns correspondence.id before we log
        _log(correspondence.id, "submitted")
        created.append(correspondence)

    if not created:
        return jsonify({"error": "No files could be processed", "failed": failed}), 400

    db.session.commit()

    _run_batch_analysis_in_background([c.id for c in created])

    if len(created) == 1:
        subject = "Your submission was received"
        body = (
            f"Hello {current_user.username},\n\n"
            f'We\'ve received your submission "{created[0].source_filename}" and it is now being reviewed.\n\n'
            "- GovFlow AI"
        )
    else:
        filenames = "\n".join(f"- {c.source_filename}" for c in created)
        subject = f"Your submission of {len(created)} documents was received"
        body = (
            f"Hello {current_user.username},\n\n"
            f"We've received your submission of {len(created)} documents and they are now being reviewed:\n{filenames}\n\n"
            "- GovFlow AI"
        )
    _send_email_in_background(current_user.email, subject, body)

    return jsonify({
        "created": [c.to_dict() for c in created],
        "failed": failed,
    }), 201


@bp.get("")
@login_required
def list_correspondence():
    query = Correspondence.query

    if current_user.role == ROLE_SUBMITTER:
        query = query.filter_by(submitter_id=current_user.id)
    elif current_user.role == ROLE_COORDINATOR:
        pass  # coordinators see everything, they're the triage point
    elif current_user.role == ROLE_DEPT_MANAGER:
        query = query.filter_by(final_department_id=current_user.department_id).filter(
            Correspondence.status.in_([STATUS_ROUTED, STATUS_IN_PROGRESS, STATUS_CLOSED])
        )

    items = query.order_by(Correspondence.created_at.desc()).all()
    return jsonify([c.to_dict() for c in items])


@bp.get("/<int:correspondence_id>")
@login_required
def get_correspondence(correspondence_id):
    c = Correspondence.query.get_or_404(correspondence_id)

    if current_user.role == ROLE_SUBMITTER and c.submitter_id != current_user.id:
        return jsonify({"error": "Forbidden"}), 403
    if current_user.role == ROLE_DEPT_MANAGER and c.final_department_id != current_user.department_id:
        return jsonify({"error": "Forbidden"}), 403

    history = ActionHistory.query.filter_by(correspondence_id=correspondence_id).order_by(ActionHistory.timestamp).all()
    result = c.to_dict()
    result["history"] = [h.to_dict() for h in history]
    return jsonify(result)


@bp.patch("/<int:correspondence_id>")
@login_required
@role_required(ROLE_COORDINATOR)
def update_fields(correspondence_id):
    c = Correspondence.query.get_or_404(correspondence_id)

    if c.status != STATUS_PENDING_REVIEW:
        return jsonify({"error": "Fields can only be edited while pending review"}), 400

    data = request.get_json(silent=True) or {}
    changed = []
    for key in EDITABLE_FIELDS:
        if key in data:
            new_value = data[key] or None
            if getattr(c, key) != new_value:
                setattr(c, key, new_value)
                changed.append(key)

    if changed:
        _log(correspondence_id, "fields_edited", note=f"Updated: {', '.join(changed)}")
        db.session.commit()

    return jsonify(c.to_dict())


@bp.put("/<int:correspondence_id>")
@login_required
@role_required(ROLE_SUBMITTER)
def replace_correspondence(correspondence_id):
    c = Correspondence.query.get_or_404(correspondence_id)

    if c.submitter_id != current_user.id:
        return jsonify({"error": "Forbidden"}), 403
    if c.status not in PRE_ROUTING_STATUSES:
        return jsonify({"error": "This can only be edited before it's routed to a department"}), 400

    uploaded_file = request.files.get("file")
    if not uploaded_file or not uploaded_file.filename:
        return jsonify({"error": "A document file (PDF, DOCX, or TXT) is required"}), 400

    file_bytes = uploaded_file.read()
    try:
        raw_text = extract_text(uploaded_file.filename, file_bytes)
    except ExtractionError as exc:
        return jsonify({"error": str(exc)}), 400

    _delete_stored_file(c.stored_filename)
    c.stored_filename = _save_uploaded_file(uploaded_file, file_bytes)
    c.source_filename = uploaded_file.filename
    c.raw_text = raw_text
    c.status = STATUS_SUBMITTED

    # Clear the previous document's AI results so stale data can't linger
    # if re-analysis of the new document fails.
    for key in EDITABLE_FIELDS:
        setattr(c, key, None)
    c.ai_confidence = None
    c.recommended_department_id = None

    _log(correspondence_id, "resubmitted", note=f"Replaced document with {uploaded_file.filename}")
    db.session.commit()

    _run_ai_analysis_in_background(c.id)
    return jsonify(c.to_dict())


@bp.delete("/<int:correspondence_id>")
@login_required
@role_required(ROLE_SUBMITTER)
def delete_correspondence(correspondence_id):
    c = Correspondence.query.get_or_404(correspondence_id)

    if c.submitter_id != current_user.id:
        return jsonify({"error": "Forbidden"}), 403
    if c.status not in PRE_ROUTING_STATUSES:
        return jsonify({"error": "This can only be deleted before it's routed to a department"}), 400

    _delete_stored_file(c.stored_filename)
    ActionHistory.query.filter_by(correspondence_id=correspondence_id).delete()
    db.session.delete(c)
    db.session.commit()
    return jsonify({"ok": True})


@bp.get("/<int:correspondence_id>/file")
@login_required
def get_correspondence_file(correspondence_id):
    c = Correspondence.query.get_or_404(correspondence_id)

    if current_user.role == ROLE_SUBMITTER and c.submitter_id != current_user.id:
        return jsonify({"error": "Forbidden"}), 403
    if current_user.role == ROLE_DEPT_MANAGER and c.final_department_id != current_user.department_id:
        return jsonify({"error": "Forbidden"}), 403

    if not c.stored_filename:
        return jsonify({"error": "No original file is available for this submission"}), 404

    return send_from_directory(
        current_app.config["UPLOAD_FOLDER"],
        c.stored_filename,
        download_name=c.source_filename,
    )


@bp.post("/<int:correspondence_id>/reanalyze")
@login_required
@role_required(ROLE_COORDINATOR)
def reanalyze(correspondence_id):
    c = Correspondence.query.get_or_404(correspondence_id)
    _run_ai_analysis(c)
    db.session.commit()
    return jsonify(c.to_dict())


@bp.post("/<int:correspondence_id>/route")
@login_required
@role_required(ROLE_COORDINATOR)
def route_correspondence(correspondence_id):
    c = Correspondence.query.get_or_404(correspondence_id)

    if c.status not in (STATUS_PENDING_REVIEW, STATUS_ROUTED):
        return jsonify({"error": "Cannot route/re-route once the department has started work on this"}), 400

    data = request.get_json(silent=True) or {}

    department_id = data.get("department_id")
    note = data.get("note")

    department = Department.query.get(department_id)
    if not department:
        return jsonify({"error": "Invalid department_id"}), 400
    if not User.query.filter_by(role=ROLE_DEPT_MANAGER, department_id=department_id).first():
        return jsonify({"error": f"{department.name} has no manager assigned yet. Ask an admin to assign one before forwarding correspondence to it."}), 400

    was_reroute = c.status == STATUS_ROUTED
    agreed_with_ai = department_id == c.recommended_department_id

    c.final_department_id = department_id
    c.coordinator_id = current_user.id
    c.coordinator_note = note
    c.status = STATUS_ROUTED
    c.routed_at = utcnow()

    if was_reroute:
        action = "rerouted"
    else:
        action = "routed_confirmed_ai" if agreed_with_ai else "routed_overridden_ai"
    _log(correspondence_id, action, note=f"Sent to {department.name}" + (f" - {note}" if note else ""))

    db.session.commit()

    managers = User.query.filter_by(role=ROLE_DEPT_MANAGER, department_id=department_id).all()
    subject = f"New correspondence forwarded to {department.name}"
    body = (
        f"Hello,\n\n"
        f'A letter titled "{c.subject or c.source_filename}" has been forwarded to {department.name} for action.\n\n'
        "- GovFlow AI"
    )
    for manager in managers:
        _send_email_in_background(manager.email, subject, body)

    return jsonify(c.to_dict())


@bp.post("/<int:correspondence_id>/status")
@login_required
@role_required(ROLE_DEPT_MANAGER)
def update_status(correspondence_id):
    c = Correspondence.query.get_or_404(correspondence_id)

    if c.final_department_id != current_user.department_id:
        return jsonify({"error": "Forbidden"}), 403

    data = request.get_json(silent=True) or {}
    new_status = data.get("status")
    note = data.get("note")

    if new_status not in (STATUS_IN_PROGRESS, STATUS_CLOSED):
        return jsonify({"error": "status must be 'in_progress' or 'closed'"}), 400

    c.status = new_status
    if note:
        c.dept_manager_note = note

    _log(correspondence_id, f"status_{new_status}", note=note)

    db.session.commit()
    return jsonify(c.to_dict())


@bp.post("/<int:correspondence_id>/bounce")
@login_required
@role_required(ROLE_DEPT_MANAGER)
def bounce_back(correspondence_id):
    c = Correspondence.query.get_or_404(correspondence_id)

    if c.final_department_id != current_user.department_id:
        return jsonify({"error": "Forbidden"}), 403
    if c.status not in (STATUS_ROUTED, STATUS_IN_PROGRESS):
        return jsonify({"error": "This can only be bounced back while routed or in progress"}), 400

    data = request.get_json(silent=True) or {}
    note = (data.get("note") or "").strip()
    if not note:
        return jsonify({"error": "Please explain why this is being sent back"}), 400

    c.status = STATUS_PENDING_REVIEW
    c.final_department_id = None

    _log(correspondence_id, "bounced_back", note=note)

    db.session.commit()
    return jsonify(c.to_dict())


@bp.post("/<int:correspondence_id>/followup")
@login_required
@role_required(ROLE_SUBMITTER)
def add_followup(correspondence_id):
    c = Correspondence.query.get_or_404(correspondence_id)

    if c.submitter_id != current_user.id:
        return jsonify({"error": "Forbidden"}), 403

    data = request.get_json(silent=True) or {}
    note = (data.get("note") or "").strip()
    if not note:
        return jsonify({"error": "Follow-up note cannot be empty"}), 400

    _log(correspondence_id, "submitter_followup", note=note)

    db.session.commit()
    return jsonify(c.to_dict())


@bp.post("/<int:correspondence_id>/feedback")
@login_required
@role_required(ROLE_COORDINATOR)
def send_feedback(correspondence_id):
    c = Correspondence.query.get_or_404(correspondence_id)

    data = request.get_json(silent=True) or {}
    note = (data.get("note") or "").strip()
    if not note:
        return jsonify({"error": "Feedback message cannot be empty"}), 400

    _log(correspondence_id, "coordinator_feedback", note=note)

    db.session.commit()
    return jsonify(c.to_dict())


@bp.post("/<int:correspondence_id>/internal-note")
@login_required
@role_required(ROLE_COORDINATOR, ROLE_DEPT_MANAGER)
def add_internal_note(correspondence_id):
    c = Correspondence.query.get_or_404(correspondence_id)

    if current_user.role == ROLE_DEPT_MANAGER and c.final_department_id != current_user.department_id:
        return jsonify({"error": "Forbidden"}), 403

    data = request.get_json(silent=True) or {}
    note = (data.get("note") or "").strip()
    if not note:
        return jsonify({"error": "Note cannot be empty"}), 400

    _log(correspondence_id, "internal_note", note=note)

    db.session.commit()
    return jsonify(c.to_dict())
