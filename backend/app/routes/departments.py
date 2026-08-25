from flask import Blueprint, jsonify
from flask_login import login_required

from app.models import Department

bp = Blueprint("departments", __name__, url_prefix="/api/departments")


@bp.get("")
@login_required
def list_departments():
    departments = Department.query.order_by(Department.name).all()
    return jsonify([d.to_dict() for d in departments])
