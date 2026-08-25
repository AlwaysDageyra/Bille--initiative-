"""Creates tables (if needed) and seeds departments + one demo user per role.
Run once with: python seed.py
"""
from dotenv import load_dotenv

load_dotenv()

from app import create_app
from app.extensions import db
from app.models import User, Department, ROLE_SUBMITTER, ROLE_COORDINATOR, ROLE_DEPT_MANAGER

DEPARTMENTS = [
    ("Administration & HR", "Staff requests, leave applications, internal memos, official letters, circulars"),
    ("Finance", "Payment requests, budget requests, financial correspondence, supplier payment letters"),
    ("Procurement", "Supplier letters, tender-related requests, clarification requests, bid correspondence"),
]

DEMO_PASSWORD = "password123"

app = create_app()

with app.app_context():
    db.create_all()

    dept_objs = {}
    for name, description in DEPARTMENTS:
        dept = Department.query.filter_by(name=name).first()
        if not dept:
            dept = Department(name=name, description=description)
            db.session.add(dept)
            db.session.flush()
        dept_objs[name] = dept

    def ensure_user(username, role, department=None):
        user = User.query.filter_by(username=username).first()
        if user:
            return user
        user = User(username=username, role=role, department_id=department.id if department else None)
        user.set_password(DEMO_PASSWORD)
        db.session.add(user)
        return user

    ensure_user("ngo1", ROLE_SUBMITTER)
    ensure_user("coordinator1", ROLE_COORDINATOR)
    ensure_user("hr_manager", ROLE_DEPT_MANAGER, dept_objs["Administration & HR"])
    ensure_user("finance_manager", ROLE_DEPT_MANAGER, dept_objs["Finance"])
    ensure_user("procurement_manager", ROLE_DEPT_MANAGER, dept_objs["Procurement"])

    db.session.commit()

    print("Seed complete. Demo accounts (all use password: {}):".format(DEMO_PASSWORD))
    print("  ngo1                 -> submitter")
    print("  coordinator1         -> coordinator")
    print("  hr_manager           -> dept_manager (Administration & HR)")
    print("  finance_manager      -> dept_manager (Finance)")
    print("  procurement_manager  -> dept_manager (Procurement)")
