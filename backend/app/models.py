from datetime import datetime, timezone
from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash

from app.extensions import db

# Role constants
ROLE_SUBMITTER = "submitter"
ROLE_COORDINATOR = "coordinator"
ROLE_DEPT_MANAGER = "dept_manager"
ROLE_ADMIN = "admin"
ROLES = [ROLE_SUBMITTER, ROLE_COORDINATOR, ROLE_DEPT_MANAGER, ROLE_ADMIN]

# Correspondence status constants
STATUS_SUBMITTED = "submitted"
STATUS_AI_ANALYZED = "ai_analyzed"
STATUS_PENDING_REVIEW = "pending_coordinator_review"
STATUS_ROUTED = "routed"
STATUS_IN_PROGRESS = "in_progress"
STATUS_CLOSED = "closed"


def utcnow():
    return datetime.now(timezone.utc)


class Department(db.Model):
    __tablename__ = "departments"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), unique=True, nullable=False)
    description = db.Column(db.String(500))
    # Target turnaround time once a letter is forwarded here — null means no
    # SLA is tracked for this department. Measured from routed_at, separate
    # from a letter's own stated deadline (an external commitment vs. an
    # internal ops target).
    sla_days = db.Column(db.Integer, nullable=True)

    def to_dict(self):
        return {"id": self.id, "name": self.name, "description": self.description, "sla_days": self.sla_days}


class User(db.Model, UserMixin):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), nullable=False)
    email = db.Column(db.String(255), nullable=True)
    department_id = db.Column(db.Integer, db.ForeignKey("departments.id"), nullable=True)
    created_at = db.Column(db.DateTime, default=utcnow)

    department = db.relationship("Department", foreign_keys=[department_id])

    def set_password(self, raw_password):
        self.password_hash = generate_password_hash(raw_password)

    def check_password(self, raw_password):
        return check_password_hash(self.password_hash, raw_password)

    def to_dict(self):
        return {
            "id": self.id,
            "username": self.username,
            "role": self.role,
            "email": self.email,
            "department_id": self.department_id,
            "department_name": self.department.name if self.department else None,
        }


class Correspondence(db.Model):
    __tablename__ = "correspondence"

    id = db.Column(db.Integer, primary_key=True)
    submitter_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)

    raw_text = db.Column(db.Text, nullable=False)
    source_filename = db.Column(db.String(255))
    stored_filename = db.Column(db.String(255))

    # --- AI-extracted fields ---
    document_type = db.Column(db.String(120))
    sender = db.Column(db.String(200))
    recipient = db.Column(db.String(200))
    department_mentioned = db.Column(db.String(200))
    reference_number = db.Column(db.String(120))
    document_date = db.Column(db.String(60))
    subject = db.Column(db.String(300))
    main_request = db.Column(db.Text)
    required_action = db.Column(db.Text)
    deadline = db.Column(db.String(60))
    urgency = db.Column(db.String(20))
    policy_procedure_needed = db.Column(db.Text)
    ai_confidence = db.Column(db.String(20))

    recommended_department_id = db.Column(db.Integer, db.ForeignKey("departments.id"), nullable=True)

    # --- Human workflow fields ---
    status = db.Column(db.String(30), nullable=False, default=STATUS_SUBMITTED)
    final_department_id = db.Column(db.Integer, db.ForeignKey("departments.id"), nullable=True)
    coordinator_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    coordinator_note = db.Column(db.Text)
    routed_at = db.Column(db.DateTime)
    dept_manager_note = db.Column(db.Text)

    ai_error = db.Column(db.Text)

    created_at = db.Column(db.DateTime, default=utcnow)
    updated_at = db.Column(db.DateTime, default=utcnow, onupdate=utcnow)

    submitter = db.relationship("User", foreign_keys=[submitter_id])
    coordinator = db.relationship("User", foreign_keys=[coordinator_id])
    recommended_department = db.relationship("Department", foreign_keys=[recommended_department_id])
    final_department = db.relationship("Department", foreign_keys=[final_department_id])

    def to_dict(self):
        return {
            "id": self.id,
            "submitter_id": self.submitter_id,
            "submitter_username": self.submitter.username if self.submitter else None,
            "raw_text": self.raw_text,
            "source_filename": self.source_filename,
            "has_file": self.stored_filename is not None,
            "document_type": self.document_type,
            "sender": self.sender,
            "recipient": self.recipient,
            "department_mentioned": self.department_mentioned,
            "reference_number": self.reference_number,
            "document_date": self.document_date,
            "subject": self.subject,
            "main_request": self.main_request,
            "required_action": self.required_action,
            "deadline": self.deadline,
            "urgency": self.urgency,
            "policy_procedure_needed": self.policy_procedure_needed,
            "ai_confidence": self.ai_confidence,
            "recommended_department_id": self.recommended_department_id,
            "recommended_department_name": self.recommended_department.name if self.recommended_department else None,
            "status": self.status,
            "final_department_id": self.final_department_id,
            "final_department_name": self.final_department.name if self.final_department else None,
            "coordinator_id": self.coordinator_id,
            "coordinator_note": self.coordinator_note,
            "routed_at": self.routed_at.isoformat() if self.routed_at else None,
            "dept_manager_note": self.dept_manager_note,
            "ai_error": self.ai_error,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class ActionHistory(db.Model):
    __tablename__ = "action_history"

    id = db.Column(db.Integer, primary_key=True)
    correspondence_id = db.Column(db.Integer, db.ForeignKey("correspondence.id"), nullable=False)
    actor_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    action = db.Column(db.String(50), nullable=False)
    note = db.Column(db.Text)
    timestamp = db.Column(db.DateTime, default=utcnow)

    actor = db.relationship("User", foreign_keys=[actor_id])

    def to_dict(self):
        return {
            "id": self.id,
            "correspondence_id": self.correspondence_id,
            "actor_id": self.actor_id,
            "actor_username": self.actor.username if self.actor else "system",
            "action": self.action,
            "note": self.note,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
        }
