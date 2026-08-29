import os

from flask import Flask, jsonify
from flask_cors import CORS

from app.config import Config
from app.extensions import db, login_manager


def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)
    os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)

    db.init_app(app)
    login_manager.init_app(app)

    CORS(app, supports_credentials=True, origins=[app.config["FRONTEND_ORIGIN"]])

    @login_manager.user_loader
    def load_user(user_id):
        from app.models import User
        return User.query.get(int(user_id))

    @login_manager.unauthorized_handler
    def unauthorized():
        return jsonify({"error": "Authentication required"}), 401

    from app.routes.auth import bp as auth_bp
    from app.routes.departments import bp as departments_bp
    from app.routes.correspondence import bp as correspondence_bp
    from app.routes.admin import bp as admin_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(departments_bp)
    app.register_blueprint(correspondence_bp)
    app.register_blueprint(admin_bp)

    @app.get("/api/health")
    def health():
        return jsonify({"status": "ok"})

    @app.errorhandler(413)
    def file_too_large(_exc):
        return jsonify({"error": "Upload is too large. Each file has a 10 MB limit, and a submission holds up to 10 files."}), 413

    return app
