import json
import requests
from flask import current_app


class OllamaError(Exception):
    pass


def call_ollama_json(prompt: str) -> dict:
    """Send a prompt to the local Ollama server and parse the JSON reply.

    Raises OllamaError if the server is unreachable or the model's
    output isn't valid JSON, so callers can decide how to handle it
    (e.g. save the raw error against the correspondence record).
    """
    host = current_app.config["OLLAMA_HOST"]
    model = current_app.config["OLLAMA_MODEL"]

    payload = {
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "stream": False,
        "format": "json",
        "options": {"temperature": 0, "seed": 42},
        
        "keep_alive": "-1",
    }

    try:
        # Measured generation alone taking 20-60s+ on this CPU-only setup, and
        # multiple submissions can queue on Ollama's single inference slot at
        # once (e.g. a multi-file batch upload) — 120s wasn't enough headroom
        # and caused a real, observed spurious timeout failure.
        resp = requests.post(f"{host}/api/chat", json=payload, timeout=300)
        resp.raise_for_status()
    except requests.RequestException as exc:
        raise OllamaError(f"Could not reach Ollama at {host}: {exc}") from exc

    data = resp.json()
    content = data.get("message", {}).get("content", "")

    try:
        return json.loads(content)
    except json.JSONDecodeError as exc:
        raise OllamaError(f"Ollama did not return valid JSON: {content!r}") from exc
