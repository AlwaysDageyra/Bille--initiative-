from flask import Blueprint, request, jsonify
from flask_login import login_required

from app.extensions import db
from app.models import User, Department, ROLE_ADMIN, ROLE_DEPT_MANAGER, ROLES
from app.utils import role_required

bp = Blueprint("admin", __name__, url_prefix="/api/admin")


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
    if role == ROLE_DEPT_MANAGER and not department_id:
        return jsonify({"error": "Department is required for a department manager"}), 400
    if User.query.filter_by(username=username).first():
        return jsonify({"error": "Username already taken"}), 400

    user = User(
        username=username,
        role=role,
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

    if "role" in data:
        if data["role"] not in ROLES:
            return jsonify({"error": "Invalid role"}), 400
        user.role = data["role"]
    if "department_id" in data:
        user.department_id = data["department_id"] if user.role == ROLE_DEPT_MANAGER else None
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

    dept = Department(name=name, description=description)
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

    db.session.commit()
    return jsonify(dept.to_dict())
