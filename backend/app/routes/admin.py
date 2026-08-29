import re

from flask import Blueprint, request, jsonify
from flask_login import login_required

from app.extensions import db
from app.models import User, Department, ROLE_ADMIN, ROLE_DEPT_MANAGER, ROLES
from app.utils import role_required

bp = Blueprint("admin", __name__, url_prefix="/api/admin")

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _clean_sla_days(raw):
    """SLA target is optional — empty/None means this department has no
    tracked turnaround target. If given, it must be a positive whole number
    of days."""
    if raw is None or raw == "":
        return None, None
    try:
        days = int(raw)
    except (TypeError, ValueError):
        return None, "SLA must be a whole number of days"
    if days <= 0:
        return None, "SLA must be a positive number of days"
    return days, None


def _clean_email(raw):
    """Email is optional (not every seeded/demo account has one), but if one
    is given it must look like a real address — this is what email
    notifications (submission received, forwarded to your department) get
    sent to, so a typo here silently breaks that."""
    email = (raw or "").strip()
    if not email:
        return None, None
    if not EMAIL_RE.match(email):
        return None, "That doesn't look like a valid email address"
    return email, None


@bp.get("/users")
@login_required
@role_required(ROLE_ADMIN)
def list_users():
    users = User.query.order_by(User.username).all()
    return jsonify([u.to_dict() for u in users])


@bp.post("/users")
@login_required
@role_required(ROLE_ADMIN)
def create_user():
    data = request.get_json(silent=True) or {}
    username = (data.get("username") or "").strip()
    password = data.get("password") or ""
    role = data.get("role")
    department_id = data.get("department_id")

    if not username or len(password) < 6:
        return jsonify({"error": "Username is required and password must be at least 6 characters"}), 400
    if role not in ROLES:
        return jsonify({"error": "Invalid role"}), 400
    if role == ROLE_DEPT_MANAGER and not (department_id and Department.query.get(department_id)):
        return jsonify({"error": "A valid department is required for a department manager"}), 400
    if User.query.filter_by(username=username).first():
        return jsonify({"error": "Username already taken"}), 400

    email, email_error = _clean_email(data.get("email"))
    if email_error:
        return jsonify({"error": email_error}), 400

    user = User(
        username=username,
        role=role,
        email=email,
        department_id=department_id if role == ROLE_DEPT_MANAGER else None,
    )
    user.set_password(password)
    db.session.add(user)
    db.session.commit()
    return jsonify(user.to_dict()), 201


@bp.patch("/users/<int:user_id>")
@login_required
@role_required(ROLE_ADMIN)
def update_user(user_id):
    user = User.query.get_or_404(user_id)
    data = request.get_json(silent=True) or {}

    if "role" in data or "department_id" in data:
        new_role = data.get("role", user.role)
        if new_role not in ROLES:
            return jsonify({"error": "Invalid role"}), 400

        if new_role == ROLE_DEPT_MANAGER:
            department_id = data.get("department_id", user.department_id)
            if not (department_id and Department.query.get(department_id)):
                return jsonify({"error": "A valid department is required for a department manager"}), 400
            user.department_id = department_id
        else:
            user.department_id = None

        user.role = new_role
    if "email" in data:
        email, email_error = _clean_email(data.get("email"))
        if email_error:
            return jsonify({"error": email_error}), 400
        user.email = email
    if data.get("password"):
        if len(data["password"]) < 6:
            return jsonify({"error": "Password must be at least 6 characters"}), 400
        user.set_password(data["password"])

    db.session.commit()
    return jsonify(user.to_dict())


@bp.post("/departments")
@login_required
@role_required(ROLE_ADMIN)
def create_department():
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    description = data.get("description")

    if not name:
        return jsonify({"error": "Department name is required"}), 400
    if Department.query.filter_by(name=name).first():
        return jsonify({"error": "A department with that name already exists"}), 400

    sla_days, sla_error = _clean_sla_days(data.get("sla_days"))
    if sla_error:
        return jsonify({"error": sla_error}), 400

    dept = Department(name=name, description=description, sla_days=sla_days)
    db.session.add(dept)
    db.session.commit()
    return jsonify(dept.to_dict()), 201


@bp.patch("/departments/<int:department_id>")
@login_required
@role_required(ROLE_ADMIN)
def update_department(department_id):
    dept = Department.query.get_or_404(department_id)
    data = request.get_json(silent=True) or {}

    if "name" in data:
        name = (data["name"] or "").strip()
        if not name:
            return jsonify({"error": "Department name is required"}), 400
        dept.name = name
    if "description" in data:
        dept.description = data["description"]
    if "sla_days" in data:
        sla_days, sla_error = _clean_sla_days(data.get("sla_days"))
        if sla_error:
            return jsonify({"error": sla_error}), 400
        dept.sla_days = sla_days

    db.session.commit()
    return jsonify(dept.to_dict())
