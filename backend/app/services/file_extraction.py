"""Extracts raw text from an uploaded government document (PDF/DOCX/TXT)."""
import io

from pypdf import PdfReader
from docx import Document

ALLOWED_EXTENSIONS = {"pdf", "docx", "txt"}


class ExtractionError(Exception):
    pass


def allowed_filename(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def extract_text(filename: str, data: bytes) -> str:
    if not allowed_filename(filename or ""):
        raise ExtractionError("Unsupported file type. Please upload a PDF, DOCX, or TXT file.")

    ext = filename.rsplit(".", 1)[1].lower()

    if ext == "pdf":
        text = _extract_pdf(data)
    elif ext == "docx":
        text = _extract_docx(data)
    else:
        text = _extract_txt(data)

    text = text.strip()
    if not text:
        raise ExtractionError(
            "No text could be extracted from this file. It may be a scanned/image-only document without a text layer."
        )
    return text


def _extract_pdf(data: bytes) -> str:
    try:
        reader = PdfReader(io.BytesIO(data))
        pages = [page.extract_text() or "" for page in reader.pages]
        return "\n\n".join(pages)
    except Exception as exc:
        raise ExtractionError(f"Could not read PDF file: {exc}") from exc


def _extract_docx(data: bytes) -> str:
    try:
        doc = Document(io.BytesIO(data))
        paragraphs = [p.text for p in doc.paragraphs]
        return "\n".join(paragraphs)
    except Exception as exc:
        raise ExtractionError(f"Could not read DOCX file: {exc}") from exc


def _extract_txt(data: bytes) -> str:
    try:
        return data.decode("utf-8")
    except UnicodeDecodeError:
        return data.decode("latin-1")
