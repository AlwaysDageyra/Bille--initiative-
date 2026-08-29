"""Builds the extraction prompt sent to Ollama and normalizes its JSON reply
into the fields our Correspondence model expects.
"""
from difflib import SequenceMatcher

EXTRACTION_KEYS = [
    "document_type",
    "sender",
    "recipient",
    "department",
    "reference_number",
    "date",
    "subject",
    "main_request",
    "required_action",
    "deadline",
    "urgency",
    "recommended_department",
    "policy_procedure_needed",
    "ai_confidence",
]


def build_extraction_prompt(raw_text: str, departments: list) -> str:
    # Each department's description doubles as a vocabulary hint — e.g.
    # Finance's "budget, payment, invoices, ..." lets the model infer the
    # right department from word patterns even when the letter never names
    # one explicitly. An explicit "if-then, checked in order" framing was
    # tried here and tested worse (the model became overly strict and
    # started refusing to recommend anything for less clear-cut cases) —
    # this softer phrasing measured better, so it stays.
    dept_lines = "\n".join(
        f"- {d.name}: {d.description}" if d.description else f"- {d.name}"
        for d in departments
    )

    return f"""You are an assistant that helps government office staff triage incoming correspondence.
Read the letter/memo/notice below and extract structured information as JSON.

Return ONLY a JSON object with exactly these keys:
- document_type: pick based on how the document opens, not what it's asking for.
    - Opens with "To:" / "From:" / "Date:" / "Subject:" header lines and has no "Dear ..." greeting -> "Memo" (still a Memo even if it requests something from one named person)
    - Opens with "Dear ..." or ends with a signature line like "Sincerely," -> "Letter"
    - No header lines and no greeting, announcing something to all staff/departments -> "Circular"
    - None of the above fit -> "Notice" or "Request", whichever is closer
- sender: the person/organization who sent it (or null if not stated)
- recipient: who it's addressed to (or null if not stated)
- department: a department name literally written in the document text (an exact quote, e.g. from a letterhead or address line) — null if no department name actually appears in the text, even if you can guess which department this concerns from context
- reference_number: any reference/tracking number (or null)
- date: the date on the document, as written (or null)
- subject: a short subject line for this correspondence
- main_request: 1-3 sentences summarizing the main request or purpose
- required_action: 1-2 sentences on what action is required, if any (or null)
- deadline: an explicit deadline date if one is stated (or null if none is stated - do not guess)
- urgency: one of "Low", "Medium", "High" based only on explicit statements or clear deadline pressure in the text
- recommended_department: your single best pick for who should handle this, copied character-for-character exactly as spelled in the department list below — never abbreviate, expand, or rephrase the name
- policy_procedure_needed: a brief note on what kind of policy or procedure might be relevant (or null). This is only a suggestion, not a verified fact - do not state it as confirmed policy.
- ai_confidence: one of "Low", "Medium", "High" reflecting how confident you are in this extraction overall

Do not invent facts that are not in the text. Use null for anything not clearly stated.

Departments you can recommend, and the kind of correspondence each typically handles — the letter often won't name a department explicitly, so match its subject matter and vocabulary against these instead (e.g. payments/budgets points to a finance-type department, suppliers/tenders points to a procurement-type department, staff/leave points to an HR-type department):
{dept_lines}

Document text:
---
{raw_text}
---

Respond with only the JSON object, no other text."""


def _match_department_id(name_guess, departments):
    """Resolves a department name string from the model to a real Department
    id. The model sometimes paraphrases the name (e.g. "Finance Department"
    for a department literally named "Finance", or "Administration & Human
    Resources" for "Administration & HR"), so this falls back to a substring
    match and then a fuzzy similarity match rather than silently dropping a
    correct-in-spirit recommendation to None.
    """
    if not name_guess:
        return None
    guess = name_guess.strip().lower()

    for d in departments:
        if d.name.strip().lower() == guess:
            return d.id

    for d in departments:
        dept_name = d.name.strip().lower()
        if dept_name in guess or guess in dept_name:
            return d.id

    best_id, best_ratio = None, 0.0
    for d in departments:
        ratio = SequenceMatcher(None, d.name.strip().lower(), guess).ratio()
        if ratio > best_ratio:
            best_id, best_ratio = d.id, ratio
    return best_id if best_ratio >= 0.6 else None


def normalize_extraction(data: dict, departments: list) -> dict:
    """Maps raw Ollama JSON keys onto Correspondence column names and
    resolves `recommended_department` (a name string) to a Department id.
    """

    def clean(key):
        val = data.get(key)
        if isinstance(val, str):
            stripped = val.strip()
            # The model sometimes writes the word "null"/"none"/"n/a" as a
            # JSON string instead of an actual null — treat those as empty too.
            if not stripped or stripped.lower() in ("null", "none", "n/a", "na"):
                return None
            return stripped
        return val

    recommended_id = _match_department_id(clean("recommended_department"), departments)

    return {
        "document_type": clean("document_type"),
        "sender": clean("sender"),
        "recipient": clean("recipient"),
        "department_mentioned": clean("department"),
        "reference_number": clean("reference_number"),
        "document_date": clean("date"),
        "subject": clean("subject"),
        "main_request": clean("main_request"),
        "required_action": clean("required_action"),
        "deadline": clean("deadline"),
        "urgency": clean("urgency"),
        "policy_procedure_needed": clean("policy_procedure_needed"),
        "ai_confidence": clean("ai_confidence"),
        "recommended_department_id": recommended_id,
    }
