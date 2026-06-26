"""Coordinated-network detector — composes the network signals with the existing
campaign coordination score into one "who is behind this" picture."""
from app.services.campaign import detector as campaign
from app.services.coordination import network


def detect_network(topic, tweets, users, news_count=0):
    rings = network.content_rings(tweets, users)
    net = network.account_network(rings, users)
    bursts = network.time_bursts(tweets)
    suspects = network.suspicious_accounts(users)
    camp = campaign.detect(topic, tweets, users, news_count) if len(tweets) >= 5 else {}
    score = camp.get("coordination_score", 0)

    return {
        "topic": topic,
        "coordination_score": score,
        "alert_level": camp.get("alert_level", {}),
        "sub_scores": camp.get("sub_scores", {}),
        "verdict": _verdict(score, net, rings),
        "network": net,
        "rings": [{k: v for k, v in r.items() if k != "author_ids"} for r in rings[:12]],
        "bursts": bursts,
        "suspicious_accounts": suspects,
        "metrics": {
            "rings": len(rings),
            "networked_accounts": len(net["nodes"]),
            "cells": net["cells"],
            "largest_cell": net["largest_cell"],
            "strong_links": net["strong_edges"],
            "duplicate_ratio": camp.get("duplicate_content_ratio", 0),
            "suspicious_ratio": camp.get("suspicious_account_ratio", 0),
            "peak_15min_ratio": camp.get("peak_15min_post_ratio", 0),
            "total_posts": len(tweets),
            "unique_accounts": len(users),
        },
        "disclaimer": "تحليل احتمالي آلي — التنسيق مؤشّر إحصائي لا اتهام قاطع، ويتطلّب مراجعة بشرية "
                      "خصوصاً في القضايا السياسية والقانونية.",
    }


def _verdict(score, net, rings):
    cells, largest = net["cells"], net["largest_cell"]
    nr = len(rings)
    if score >= 70 or (cells and largest >= 6):
        return {"level": "حرج", "label": "شبكة منسّقة عالية الاحتمال", "color": "#f43f5e",
                "text": f"رُصدت {cells} خليّة متناسقة، أكبرها {largest} حساباً، عبر {nr} حلقة محتوى متكرّر."}
    if score >= 45 or cells:
        return {"level": "مرتفع", "label": "إشارات تنسيق واضحة", "color": "#fb923c",
                "text": f"{cells} خليّة محتملة و{nr} حلقة محتوى متطابق — يُنصح بالمراجعة."}
    if score >= 25 or nr:
        return {"level": "متوسط", "label": "تنسيق محدود محتمل", "color": "#eab308",
                "text": f"{nr} حلقة محتوى متشابه دون شبكة حسابات واضحة بعد."}
    return {"level": "منخفض", "label": "لا مؤشرات تنسيق", "color": "#22c55e",
            "text": "النشاط يبدو عضوياً — لا حلقات نسخ ولا تزامن غير طبيعي."}
