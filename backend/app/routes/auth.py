from flask import Blueprint, request, jsonify
from flask_login import login_user, logout_user, login_required, current_user

from app.models import User

bp = Blueprint("auth", __name__, url_prefix="/api/auth")


@bp.post("/login")
def login():
    data = request.get_json(silent=True) or {}
    username = data.get("username", "").strip()
    password = data.get("password", "")

    user = User.query.filter_by(username=username).first()
    if not user or not user.check_password(password):
        return jsonify({"error": "Invalid username or password"}), 401

    login_user(user)
    return jsonify(user.to_dict())


@bp.post("/logout")
@login_required
def logout():
    logout_user()
    return jsonify({"ok": True})


@bp.get("/me")
@login_required
def me():
    return jsonify(current_user.to_dict())
