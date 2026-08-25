"""Builds the extraction prompt sent to Ollama and normalizes its JSON reply
into the fields our Correspondence model expects.
"""

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


def build_extraction_prompt(raw_text: str, department_names: list[str]) -> str:
    dept_list = ", ".join(department_names)

    return f"""You are an assistant that helps government office staff triage incoming correspondence.
Read the letter/memo/notice below and extract structured information as JSON.

Available departments to route this to: {dept_list}

Return ONLY a JSON object with exactly these keys:
- document_type: e.g. "Letter", "Memo", "Circular", "Notice", "Request"
- sender: the person/organization who sent it (or null if not stated)
- recipient: who it's addressed to (or null if not stated)
- department: a department mentioned inside the document text itself, if any (or null)
- reference_number: any reference/tracking number (or null)
- date: the date on the document, as written (or null)
- subject: a short subject line for this correspondence
- main_request: 1-3 sentences summarizing the main request or purpose
- required_action: 1-2 sentences on what action is required, if any (or null)
- deadline: an explicit deadline date if one is stated (or null if none is stated - do not guess)
- urgency: one of "Low", "Medium", "High" based only on explicit statements or clear deadline pressure in the text
- recommended_department: your single best pick from the department list above for who should handle this
- policy_procedure_needed: a brief note on what kind of policy or procedure might be relevant (or null). This is only a suggestion, not a verified fact - do not state it as confirmed policy.
- ai_confidence: one of "Low", "Medium", "High" reflecting how confident you are in this extraction overall

Do not invent facts that are not in the text. Use null for anything not clearly stated.

Document text:
---
{raw_text}
---

Respond with only the JSON object, no other text."""


def normalize_extraction(data: dict, departments: list) -> dict:
    """Maps raw Ollama JSON keys onto Correspondence column names and
    resolves `recommended_department` (a name string) to a Department id
    by case-insensitive match against the real department list.
    """
    name_to_id = {d.name.strip().lower(): d.id for d in departments}

    def clean(key):
        val = data.get(key)
        if isinstance(val, str) and not val.strip():
            return None
        return val

    recommended_name = clean("recommended_department")
    recommended_id = None
    if isinstance(recommended_name, str):
        recommended_id = name_to_id.get(recommended_name.strip().lower())

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
