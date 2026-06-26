"""Fraud & Scam monitoring — detect posts impersonating a company or running
scams against its customers (fake promos, phishing, fake support pages). High
priority: each hit becomes an alert.
"""
from app.services import entity_resolver

_norm = entity_resolver.normalize_arabic

_SIGNALS = {
    "phishing": ["الرقم السري", "otp", "رمز التحقق", "كود التحقق", "كلمه المرور", "حدث بياناتك",
                 "فعل حسابك", "ادخل بياناتك", "اكد هويتك", "تم تعليق حسابك", "حسابك معلق"],
    "fake_promo": ["ربحت", "فزت", "مبروك الفوز", "جائزه", "سحب على", "هديه مجانيه", "عرض حصري",
                   "وزع مبالغ", "منحه", "مكافاه ماليه", "اول 100"],
    "impersonation": ["الصفحه الرسميه", "حساب رسمي", "الدعم الفني الرسمي", "خدمه العملاء الرسميه",
                      "الصفحه الموثقه", "ادارة المصرف"],
    "suspicious_link": ["bit.ly", "tinyurl", "cutt.ly", "shorturl", "اضغط هنا", "سجل الان", "رابط التسجيل"],
}
_LABEL = {"phishing": "تصيّد (Phishing)", "fake_promo": "عرض/جائزة وهمية",
          "impersonation": "انتحال صفة", "suspicious_link": "رابط مشبوه"}


def scan_text(text: str) -> dict:
    norm = _norm(text or "")
    hits = [k for k, ws in _SIGNALS.items() if any(_norm(w) in norm for w in ws)]
    risk = min(100, len(hits) * 28 + (45 if "phishing" in hits else 0) + (20 if "impersonation" in hits else 0))
    return {"suspicious": bool(hits), "signals": hits, "risk": risk}


def scan_feed(posts: list[dict], *, company: str = "") -> dict:
    """posts: [{text, author?, url?}]. Returns suspicious posts + counts by type."""
    flagged, by_type = [], {}
    for p in posts:
        r = scan_text(p.get("text", ""))
        if r["suspicious"]:
            for s in r["signals"]:
                by_type[s] = by_type.get(s, 0) + 1
            flagged.append({"text": (p.get("text") or "")[:200], "author": p.get("author"),
                            "url": p.get("url"), "signals": [_LABEL[s] for s in r["signals"]],
                            "risk": r["risk"]})
    flagged.sort(key=lambda x: -x["risk"])
    return {"count": len(flagged), "by_type": {_LABEL[k]: v for k, v in by_type.items()},
            "flagged": flagged[:15],
            "alert": len(flagged) > 0,
            "explain": "كشف منشورات احتيال/انتحال تستهدف العملاء — مؤشرات لغوية تتطلّب تحقّقاً سريعاً."}
