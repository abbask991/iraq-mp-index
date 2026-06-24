"""Alert delivery — email (Resend) + Telegram bot. Both gated by env keys; if a
key is missing that channel is silently skipped, so the system degrades safely."""
import os

import httpx

RESEND_API_KEY = os.getenv("RESEND_API_KEY", "")
RESEND_FROM = os.getenv("RESEND_FROM", "مركز الرصد <onboarding@resend.dev>")
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")


async def send_email(to: str, subject: str, html: str) -> bool:
    if not RESEND_API_KEY or not to:
        return False
    try:
        async with httpx.AsyncClient() as c:
            r = await c.post("https://api.resend.com/emails",
                             headers={"Authorization": f"Bearer {RESEND_API_KEY}", "Content-Type": "application/json"},
                             json={"from": RESEND_FROM, "to": [to], "subject": subject, "html": html}, timeout=15)
            return r.status_code < 300
    except Exception:
        return False


async def send_telegram(chat_id: str, text: str) -> bool:
    if not TELEGRAM_BOT_TOKEN or not chat_id:
        return False
    try:
        async with httpx.AsyncClient() as c:
            r = await c.post(f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage",
                             json={"chat_id": chat_id, "text": text, "parse_mode": "HTML"}, timeout=15)
            return r.status_code < 300
    except Exception:
        return False


async def deliver_alert(sub: dict, message: str, severity: str):
    """sub = subscription row (email, notify_email, telegram_chat_id)."""
    sent = []
    sev = {"red": "🔴", "orange": "🟠", "yellow": "🟡", "watch": "🔵", "info": "⚪",
           "high": "🔴", "medium": "🟠", "low": "🟢"}.get(severity, "🔔")
    if sub.get("notify_email", True) and sub.get("email"):
        html = (f"<div style='font-family:sans-serif;direction:rtl'>"
                f"<h3>{sev} تنبيه — مركز الرصد</h3><p style='font-size:15px'>{message}</p>"
                f"<p style='color:#888;font-size:12px'>تحليل آلي — يُنصح بالمراجعة البشرية. "
                f"<a href='https://rasd-monitor.vercel.app/monitor/alerts'>افتح لوحة التنبيهات</a></p></div>")
        if await send_email(sub["email"], f"{sev} تنبيه مركز الرصد", html):
            sent.append("email")
    if sub.get("telegram_chat_id"):
        if await send_telegram(sub["telegram_chat_id"], f"{sev} <b>تنبيه — مركز الرصد</b>\n{message}"):
            sent.append("telegram")
    return sent
