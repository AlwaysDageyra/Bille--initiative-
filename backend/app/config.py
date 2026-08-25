import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret-change-me")

    SQLALCHEMY_DATABASE_URI = os.environ.get(
        "DATABASE_URL", f"sqlite:///{os.path.join(BASE_DIR, 'govflow.db')}"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    OLLAMA_HOST = os.environ.get("OLLAMA_HOST", "http://localhost:11434")
    OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "llama3.2")

    MAX_CONTENT_LENGTH = 10 * 1024 * 1024  # 10 MB upload limit
    UPLOAD_FOLDER = os.environ.get("UPLOAD_FOLDER", os.path.join(BASE_DIR, "instance", "uploads"))

    FRONTEND_ORIGIN = os.environ.get("FRONTEND_ORIGIN", "http://localhost:5173")

    SESSION_COOKIE_SAMESITE = "Lax"
    SESSION_COOKIE_SECURE = False
