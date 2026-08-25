from functools import wraps
from flask import jsonify
from flask_login import current_user


def role_required(*allowed_roles):
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            if current_user.role not in allowed_roles:
                return jsonify({"error": "Forbidden for this role"}), 403
            return fn(*args, **kwargs)

        return wrapper

    return decorator
