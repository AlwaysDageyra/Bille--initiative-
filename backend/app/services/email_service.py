"""Sends email notifications (submission received, forwarded to your
department). Email is a nice-to-have on top of the in-app notifications,
not a step in the actual workflow, so failures here are logged and
swallowed rather than raised — a bad SMTP config should never block a
submission or a forward from going through.
"""
import smtplib
from email.message import EmailMessage

from flask import current_app


def send_email(to_address, subject, body):
    if not to_address:
        return

    host = current_app.config["SMTP_HOST"]
    if not host:
        current_app.logger.info(f"[email not configured] Would send to {to_address}: {subject}\n{body}")
        return

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = current_app.config["SMTP_FROM"] or current_app.config["SMTP_USER"]
    msg["To"] = to_address
    msg.set_content(body)

    try:
        with smtplib.SMTP(host, current_app.config["SMTP_PORT"], timeout=15) as server:
            server.starttls()
            username = current_app.config["SMTP_USER"]
            password = current_app.config["SMTP_PASSWORD"]
            if username and password:
                server.login(username, password)
            server.send_message(msg)
    except Exception as exc:
        current_app.logger.warning(f"Failed to send email to {to_address}: {exc}")
