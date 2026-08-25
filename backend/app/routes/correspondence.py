import os
import uuid

from flask import Blueprint, request, jsonify, current_app, send_from_directory
from flask_login import login_required, current_user
from werkzeug.utils import secure_filename

from app.extensions import db
from app.models import (
    Correspondence,
    Department,
    ActionHistory,
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
from app.utils import role_required

bp = Blueprint("correspondence", __name__, url_prefix="/api/correspondence")


def _log(correspondence_id, action, note=None, actor_id=None):
    entry = ActionHistory(
        correspondence_id=correspondence_id,
        actor_id=actor_id if actor_id is not None else (current_user.id if current_user.is_authenticated else None),
        action=action,
        note=note,
    )
    db.session.add(entry)


def _run_ai_analysis(correspondence: Correspondence):
    departments = Department.query.all()
    prompt = build_extraction_prompt(correspondence.raw_text, [d.name for d in departments])

    try:
        raw = call_ollama_json(prompt)
        fields = normalize_extraction(raw, departments)
        for key, value in fields.items():
            setattr(correspondence, key, value)
        correspondence.status = STATUS_PENDING_REVIEW
        correspondence.ai_error = None
        _log(correspondence.id, "ai_analyzed", note=f"AI recommended: {fields.get('recommended_department_id')}")
    except OllamaError as exc:
        correspondence.status = STATUS_AI_ANALYZED
        correspondence.ai_error = str(exc)
        _log(correspondence.id, "ai_analysis_failed", note=str(exc))


@bp.post("")
@login_required
@role_required(ROLE_SUBMITTER)
def create_correspondence():
    uploaded_file = request.files.get("file")
    if not uploaded_file or not uploaded_file.filename:
        return jsonify({"error": "A document file (PDF, DOCX, or TXT) is required"}), 400

    file_bytes = uploaded_file.read()

    try:
        raw_text = extract_text(uploaded_file.filename, file_bytes)
    except ExtractionError as exc:
        return jsonify({"error": str(exc)}), 400

    stored_filename = f"{uuid.uuid4().hex}_{secure_filename(uploaded_file.filename)}"
    with open(os.path.join(current_app.config["UPLOAD_FOLDER"], stored_filename), "wb") as f:
        f.write(file_bytes)

    correspondence = Correspondence(
        submitter_id=current_user.id,
        raw_text=raw_text,
        source_filename=uploaded_file.filename,
        stored_filename=stored_filename,
        status=STATUS_SUBMITTED,
    )
    db.session.add(correspondence)
    db.session.flush()  # assigns correspondence.id before we log/analyze

    _log(correspondence.id, "submitted")
    _run_ai_analysis(correspondence)

    db.session.commit()
    return jsonify(correspondence.to_dict()), 201


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
    data = request.get_json(silent=True) or {}

    department_id = data.get("department_id")
    note = data.get("note")

    department = Department.query.get(department_id)
    if not department:
        return jsonify({"error": "Invalid department_id"}), 400

    agreed_with_ai = department_id == c.recommended_department_id

    c.final_department_id = department_id
    c.coordinator_id = current_user.id
    c.coordinator_note = note
    c.status = STATUS_ROUTED
    c.routed_at = utcnow()

    action = "routed_confirmed_ai" if agreed_with_ai else "routed_overridden_ai"
    _log(correspondence_id, action, note=f"Sent to {department.name}" + (f" - {note}" if note else ""))

    db.session.commit()
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
