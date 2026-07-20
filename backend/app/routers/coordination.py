"""Coordinated-network detection API — "who is behind the campaign". Heavy build
(fetch + cluster + network + AI) is SWR-cached: first call computes, repeats are
instant, refresh happens in the background."""
from fastapi import APIRouter

from app.services import cache
from app.services.coordination import builder

router = APIRouter(prefix="/api/coordination", tags=["coordination"])


async def _coord_demo(target: str) -> dict:
    """Curated demo for the coordinated-network detector — matches the shape
    detect_network() returns from live X data (the fields CoordinationView reads).
    Async so it drops straight into cache.swr, which awaits its factory."""
    nodes = [
        {"id": "a1", "x": 0.30, "y": 0.40, "degree": 5, "suspicion": 82},
        {"id": "a2", "x": 0.38, "y": 0.31, "degree": 4, "suspicion": 74},
        {"id": "a3", "x": 0.25, "y": 0.52, "degree": 4, "suspicion": 68},
        {"id": "a4", "x": 0.41, "y": 0.50, "degree": 3, "suspicion": 61},
        {"id": "a5", "x": 0.33, "y": 0.63, "degree": 3, "suspicion": 55},
        {"id": "b1", "x": 0.71, "y": 0.42, "degree": 5, "suspicion": 79},
        {"id": "b2", "x": 0.62, "y": 0.33, "degree": 4, "suspicion": 71},
        {"id": "b3", "x": 0.77, "y": 0.51, "degree": 3, "suspicion": 64},
        {"id": "b4", "x": 0.66, "y": 0.61, "degree": 3, "suspicion": 58},
        {"id": "c1", "x": 0.50, "y": 0.46, "degree": 4, "suspicion": 66},
    ]
    edges = [
        {"source": "a1", "target": "a2", "strong": True, "weight": 2.5},
        {"source": "a1", "target": "a3", "strong": True, "weight": 2.0},
        {"source": "a2", "target": "a4", "strong": False, "weight": 1.0},
        {"source": "a3", "target": "a5", "strong": False, "weight": 1.0},
        {"source": "b1", "target": "b2", "strong": True, "weight": 2.3},
        {"source": "b1", "target": "b3", "strong": False, "weight": 1.0},
        {"source": "b2", "target": "b4", "strong": False, "weight": 1.0},
        {"source": "c1", "target": "a1", "strong": False, "weight": 1.2},
        {"source": "c1", "target": "b1", "strong": True, "weight": 2.0},
    ]
    return {
        "demo": True,
        "topic": target,
        "coordination_score": 68,
        "alert_level": {"level": "strong", "label": "تنسيق مُرجّح"},
        "verdict": {"level": "مرتفع", "label": "تنسيق مُرجّح", "color": "#fb923c",
                    "text": "شبكة حسابات تتحرّك سوا بنمط غير عضوي — تكرار محتوى وتزامن توقيت مرتفعان."},
        "summary": (
            f"يكشف الفحص شبكتين متمايزتين من الحسابات تدفعان محتوى متطابقاً حول «{target}» بتزامن لافت. "
            "٤٤٪ من المنشورات مكرّرة أو شبه مكرّرة، و٦٠٪ من الحسابات المتشابكة تحمل مؤشّرات اشتباه، مع حساب "
            "جسر واحد يربط الشبكتين — نمط يرجّح إدارة مركزية لا تفاعلاً عفوياً."
        ),
        "metrics": {
            "cells": 2, "largest_cell": 5, "rings": 3, "strong_links": 5, "networked_accounts": 10,
            "duplicate_ratio": 0.44, "suspicious_ratio": 0.60, "peak_15min_ratio": 0.47,
            "total_posts": 1240, "unique_accounts": 96,
        },
        "network": {"nodes": nodes, "edges": edges},
        "rings": [
            {"author_count": 14, "post_count": 61, "span_minutes": 22,
             "text": f"لا صوت يعلو على {target} — الشعب يريد المحاسبة الآن",
             "authors": ["voice_iq_2026", "al_haqiqa_now", "watan_first", "sawt_alsha3b", "iraq_truth_x"]},
            {"author_count": 9, "post_count": 37, "span_minutes": 15,
             "text": "شاركوا الوسم قبل أن يُحذف — هذا ما لا يريدونكم أن تعرفوه",
             "authors": ["free_voice_iq", "n_alrafidain", "baghdad_now22"]},
        ],
        "bursts": [
            {"at": "2026-07-19T20:15:00", "count": 143, "accounts": 61, "ratio": 3.4},
            {"at": "2026-07-19T21:00:00", "count": 98, "accounts": 47, "ratio": 2.6},
        ],
        "suspicious_accounts": [
            {"username": "voice_iq_2026", "suspicion": 82, "reasons": ["حساب حديث (< شهر)", "إيقاع نشر آلي", "متابعون قلائل"]},
            {"username": "al_haqiqa_now", "suspicion": 74, "reasons": ["تكرار محتوى مرتفع", "نشاط في ذُرى متزامنة"]},
            {"username": "watan_first", "suspicion": 66, "reasons": ["نسبة إعادة نشر عالية", "غياب محتوى أصلي"]},
        ],
        "disclaimer": "مؤشّر احتمالي — يُستأنس به ولا يُعتمد كحقيقة قاطعة. (بيانات توضيحية)",
    }


@router.get("/{target}")
async def coordination(target: str, range: str = "week", demo: int = 0):
    if demo:
        return await cache.swr(f"coord:demo:{target}", 86400, lambda: _coord_demo(target))
    return await cache.swr(f"coord:{range}:{target}", 1800, lambda: builder.build(target, range))
