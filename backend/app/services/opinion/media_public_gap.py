"""Media–Public Gap — is media coverage aligned with public reaction? Compares
media sentiment (news) against observed public opinion (social). A large gap = the
press says one thing while the street says another — a high-value signal.
"""


def gap(media_sentiment_score: float, public_opinion_score: float) -> dict:
    """Both scores are -100..+100. Gap is the absolute distance, scaled 0-100."""
    g = abs((media_sentiment_score or 0) - (public_opinion_score or 0))
    score = round(min(100, g / 2))                     # max distance 200 → 100
    label = ("متوافق" if score <= 20 else "فجوة متوسطة" if score <= 40
             else "فجوة كبيرة" if score <= 70 else "فجوة حادّة")
    if media_sentiment_score > public_opinion_score + 15:
        explanation = "الإعلام أكثر إيجابية من الجمهور — تغطية متفائلة لا تعكس الشارع."
    elif public_opinion_score > media_sentiment_score + 15:
        explanation = "الجمهور أكثر إيجابية من الإعلام — تغطية سلبية تتجاوز المزاج العام."
    else:
        explanation = "تغطية الإعلام قريبة من رد فعل الجمهور."
    return {"gap_score": score, "label": label,
            "media_sentiment": round(media_sentiment_score, 1),
            "public_opinion": round(public_opinion_score, 1), "explanation": explanation}
