"""System Settings — DB-first, env/default fallback.

A single SCHEMA registry defines every admin-controllable setting (English key,
Arabic label, type, default, options, secret flag). The frontend renders it
generically. Values live in `system_settings` (key/value_json/category); every
change is written to `system_audit_logs` (old→new). Secrets are never returned in
full — only a masked hint + a configured/not status derived from env.

Read order for any key: DB value → env var (if mapped) → schema default.
"""
import os
import time

from app.services import db

# ── schema helpers ──────────────────────────────────────────────────────────
# field tuple: (key, label_ar, type, default, extra?)
#   types: toggle | number | select | text | password | tags | info
def _f(key, label, typ, default, **extra):
    return {"key": key, "label": label, "type": typ, "default": default, **extra}


FREQ = [{"v": 15, "l": "كل 15 دقيقة"}, {"v": 30, "l": "كل 30 دقيقة"},
        {"v": 60, "l": "كل ساعة"}, {"v": 180, "l": "كل 3 ساعات"}, {"v": 360, "l": "كل 6 ساعات"}]
LANGS = [{"v": "ar", "l": "العربية"}, {"v": "en", "l": "English"}]
SOURCES = ["X", "Telegram", "RSS", "Google News", "GDELT", "YouTube", "TikTok", "Instagram", "Reddit"]

# ── the registry ────────────────────────────────────────────────────────────
SCHEMA = [
    {"category": "general", "label": "الإعدادات العامة", "icon": "", "fields": [
        _f("platform_name", "اسم المنصّة", "text", "مركز الرصد"),
        _f("org_name", "اسم المؤسسة", "text", ""),
        _f("default_language", "اللغة الافتراضية", "select", "ar", options=LANGS),
        _f("timezone", "المنطقة الزمنية", "text", "Asia/Baghdad"),
        _f("country_focus", "الترکیز الجغرافي", "text", "العراق"),
        _f("default_page", "الصفحة الافتراضية", "select", "chief",
           options=[{"v": "chief", "l": "ضابط الاستخبارات"}, {"v": "overview", "l": "لوحة القيادة"}, {"v": "narratives", "l": "غرفة السرديات"}]),
        _f("theme", "المظهر", "select", "dark", options=[{"v": "dark", "l": "داكن"}, {"v": "light", "l": "فاتح"}]),
        _f("rtl", "دعم RTL", "toggle", True),
        _f("date_format", "صيغة التاريخ", "select", "YYYY-MM-DD", options=[{"v": "YYYY-MM-DD", "l": "2026-06-25"}, {"v": "DD/MM/YYYY", "l": "25/06/2026"}]),
        _f("currency", "صيغة العملة", "select", "IQD", options=[{"v": "IQD", "l": "دينار عراقي"}, {"v": "USD", "l": "دولار"}]),
    ]},
    {"category": "data_collection", "label": "جمع البيانات", "icon": "", "fields": [
        _f("frequency_minutes", "تكرار الجمع", "select", 180, options=[{"v": x["v"], "l": x["l"]} for x in FREQ]),
        _f("source_X", "تفعيل X", "toggle", True),
        _f("source_Telegram", "تفعيل Telegram", "toggle", True),
        _f("source_RSS", "تفعيل RSS", "toggle", True),
        _f("source_GoogleNews", "تفعيل Google News", "toggle", True),
        _f("source_GDELT", "تفعيل GDELT", "toggle", True),
        _f("source_YouTube", "تفعيل YouTube", "toggle", False),
        _f("source_TikTok", "تفعيل TikTok", "toggle", False),
        _f("source_Instagram", "تفعيل Instagram", "toggle", False),
        _f("source_Reddit", "تفعيل Reddit", "toggle", True),
        _f("max_posts_per_run", "أقصى منشورات لكل دورة", "number", 5000),
        _f("max_posts_per_source", "أقصى منشورات لكل مصدر/دورة", "number", 1000),
        _f("max_posts_per_keyword", "أقصى منشورات لكل كلمة مفتاحية", "number", 500),
        _f("max_pages_per_request", "أقصى صفحات لكل طلب API", "number", 5),
        _f("enable_pagination", "تفعيل التصفّح (pagination)", "toggle", True),
        _f("enable_dedup", "تفعيل إزالة التكرار", "toggle", True),
        _f("store_raw", "تخزين البيانات الخام", "toggle", True),
        _f("keep_raw_days", "حفظ البيانات الخام (أيام)", "number", 30),
        _f("keep_clean_days", "حفظ البيانات النظيفة (أيام)", "number", 365),
    ]},
    {"category": "aice", "label": "محرّك الجمع الذكي (AICE)", "icon": "", "fields": [
        _f("enabled", "تفعيل محرّك الجمع الذكي", "toggle", True),
        _f("enable_cluster_before_ai", "التجميع قبل الذكاء (تقليل كلفة Claude)", "toggle", True),
        _f("cron_coverage_limit", "حد التغطية للجمع المجدول (آمن للحصّة)", "number", 15000),
        _f("manual_refresh_limit", "حد التحديث اليدوي", "number", 50000),
        _f("max_surge_multiplier", "أقصى مضاعِف تصعيد (مبدئياً 2)", "number", 2),
        _f("cluster_target_percent", "نسبة التجميع المستهدفة (%)", "number", 12),
        _f("ai_representative_cap", "سقف العيّنات المُرسلة للذكاء", "number", 800),
        _f("discovery_reserve_percent", "حصّة الاستكشاف المحجوزة (%)", "number", 10),
        _f("monthly_tweet_cap", "السقف الشهري للتغريدات (حماية الرصيد · 0=بلا حد)", "number", 600000),
    ]},
    {"category": "x_api", "label": "إعدادات X API", "icon": "", "service": "x", "fields": [
        _f("enabled", "تفعيل جمع X", "toggle", True),
        _f("api_key", "مفتاح X API", "password", "", env="X_BEARER_TOKEN"),
        _f("monthly_quota", "الحد الشهري للحصّة", "number", 10000),
        _f("daily_quota", "الحد اليومي للحصّة", "number", 1000),
        _f("max_tweets_per_run", "أقصى تغريدات لكل دورة", "number", 1000),
        _f("max_tweets_per_keyword", "أقصى تغريدات لكل كلمة", "number", 500),
        _f("cron_limit", "حد التحديث المجدول", "number", 3000),
        _f("manual_refresh_limit", "حد التحديث اليدوي", "number", 1000),
        _f("enable_manual_refresh", "تفعيل التحديث اليدوي", "toggle", True),
        _f("track_influencers", "تتبّع المؤثرين", "toggle", True),
        _f("track_hashtags", "تتبّع الهاشتاغات", "toggle", True),
        _f("collect_replies", "جمع الردود", "toggle", False),
        _f("engagement_metrics", "مقاييس التفاعل", "toggle", True),
        _f("quota_alert_thresholds", "تنبيه عند بلوغ الحصّة (%)", "tags", ["70", "90", "100"]),
    ]},
    {"category": "telegram", "label": "إعدادات Telegram", "icon": "", "service": "telegram", "fields": [
        _f("enabled", "تفعيل جمع Telegram", "toggle", True),
        _f("channels", "القنوات المرصودة", "tags", []),
        _f("max_messages_per_channel", "أقصى رسائل لكل قناة", "number", 200),
        _f("max_messages_per_run", "أقصى رسائل لكل دورة", "number", 2000),
        _f("collect_media", "جمع الوسائط", "toggle", False),
        _f("detect_forwarded", "كشف الرسائل المُعاد توجيهها", "toggle", True),
        _f("channel_influence", "درجة تأثير القناة", "toggle", True),
        _f("detect_duplicates", "كشف الرسائل المكرّرة", "toggle", True),
    ]},
    {"category": "rss", "label": "إعدادات RSS / الأخبار", "icon": "", "fields": [
        _f("enabled", "تفعيل RSS", "toggle", True),
        _f("full_text", "استخراج النص الكامل للمقال", "toggle", False),
        _f("credibility_score", "درجة مصداقية المصدر", "toggle", True),
        _f("frequency_minutes", "تكرار الجمع", "select", 180, options=[{"v": x["v"], "l": x["l"]} for x in FREQ]),
    ], "custom": "rss_sources"},
    {"category": "ai", "label": "إعدادات الذكاء الاصطناعي", "icon": "", "service": "ai", "fields": [
        _f("enabled", "تفعيل التحليل بالذكاء الاصطناعي", "toggle", True),
        _f("api_key", "مفتاح Anthropic", "password", "", env="ANTHROPIC_API_KEY"),
        _f("model_cheap", "نموذج المهام الخفيفة", "text", "claude-haiku-4-5-20251001"),
        _f("model_deep", "نموذج التحليل العميق", "text", "claude-sonnet-4-6"),
        _f("model_exec", "نموذج الموجزات التنفيذية", "text", "claude-sonnet-4-6"),
        _f("max_calls_per_day", "أقصى نداءات يومياً", "number", 5000),
        _f("max_calls_per_user", "أقصى نداءات لكل مستخدم", "number", 500),
        _f("max_cost_per_day", "أقصى كلفة يومية ($)", "number", 50),
        _f("cache_results", "تخزين نتائج الذكاء", "toggle", True),
        _f("cache_hours", "مدة التخزين (ساعات)", "number", 24),
        _f("rule_fallback", "قواعد قبل الذكاء (fallback)", "toggle", True),
        _f("batch_classify", "تصنيف دفعي", "toggle", True),
        _f("enable_sentiment", "تحليل المشاعر", "toggle", True),
        _f("enable_emotions", "تحليل الانفعالات", "toggle", True),
        _f("enable_narrative", "تحليل السرديات", "toggle", True),
        _f("enable_campaign", "تحليل الحملات", "toggle", True),
        _f("enable_exec_brief", "توليد الموجز التنفيذي", "toggle", True),
        _f("enable_daily", "موجز يومي", "toggle", True),
        _f("enable_weekly", "موجز أسبوعي", "toggle", True),
        _f("enable_monthly", "تقرير شهري", "toggle", True),
    ]},
    {"category": "alerts", "label": "إعدادات الإنذار", "icon": "", "fields": [
        _f("enabled", "تفعيل الإنذارات", "toggle", True),
        _f("channel_dashboard", "قناة: لوحة التحكم", "toggle", True),
        _f("channel_email", "قناة: البريد", "toggle", False),
        _f("channel_telegram", "قناة: Telegram", "toggle", True),
        _f("channel_whatsapp", "قناة: WhatsApp (لاحقاً)", "toggle", False),
        _f("cooldown_minutes", "فترة التهدئة بين التكرار (دقائق)", "number", 60),
        _f("dedup", "إزالة تكرار الإنذارات", "toggle", True),
        _f("min_risk_score", "أدنى درجة خطر للإنذار", "number", 60),
        _f("min_campaign_score", "أدنى درجة حملة للإنذار", "number", 50),
        _f("min_neg_spike", "أدنى قفزة سلبية (%)", "number", 40),
        _f("min_velocity", "أدنى سرعة ترند", "number", 30),
        _f("alert_quota_low", "تنبيه عند انخفاض حصّة X", "toggle", True),
        _f("alert_collector_fail", "تنبيه عند فشل الجامع", "toggle", True),
        _f("alert_ai_fail", "تنبيه عند فشل الذكاء", "toggle", True),
        _f("alert_db_errors", "تنبيه عند تزايد أخطاء القاعدة", "toggle", True),
    ]},
    {"category": "trends", "label": "كشف الترندات", "icon": "", "fields": [
        _f("enabled", "تفعيل كشف الترندات", "toggle", True),
        _f("min_mentions", "أدنى إشارات لاعتبارها ترند", "number", 20),
        _f("min_velocity", "أدنى درجة سرعة", "number", 5),
        _f("min_acceleration", "أدنى درجة تسارع", "number", 2),
        _f("windows", "النوافذ الزمنية", "tags", ["15m", "1h", "6h", "24h"]),
        _f("forecasting", "توقّع الترندات", "toggle", True),
        _f("emerging_hashtags", "كشف الهاشتاغات الناشئة", "toggle", True),
        _f("origin_tracking", "تتبّع المنشأ", "toggle", True),
        _f("cross_platform", "كشف عبر المنصّات", "toggle", True),
    ]},
    {"category": "campaigns", "label": "كشف الحملات", "icon": "", "fields": [
        _f("enabled", "تفعيل كشف الحملات", "toggle", True),
        _f("min_posts", "أدنى منشورات مطلوبة", "number", 15),
        _f("min_accounts", "أدنى حسابات فريدة", "number", 8),
        _f("text_similarity", "عتبة تشابه النص (%)", "number", 70),
        _f("timing_burst", "عتبة دفقة التوقيت", "number", 60),
        _f("suspicious_threshold", "عتبة الحساب المشبوه", "number", 50),
        _f("coordination_threshold", "عتبة درجة التنسيق", "number", 50),
        _f("enable_dna", "تفعيل الحمض النووي للحملة", "toggle", True),
        _f("origin_tracking", "تتبّع المنشأ", "toggle", True),
        _f("network_analysis", "تحليل الشبكة", "toggle", True),
        _f("dup_content", "كشف المحتوى المكرّر", "toggle", True),
        _f("repeated_links", "كشف الروابط المتكرّرة", "toggle", True),
        _f("repeated_hashtags", "كشف الهاشتاغات المتكرّرة", "toggle", True),
        _f("require_human_review", "مراجعة بشرية للادعاءات الحرجة", "toggle", True),
    ]},
    {"category": "entities", "label": "الكيانات والأسماء البديلة", "icon": "", "custom": "entities", "fields": []},
    {"category": "source_weights", "label": "أوزان المصادر", "icon": "", "custom": "source_weights", "fields": []},
    {"category": "dashboard", "label": "إعدادات لوحة القيادة", "icon": "", "fields": [
        _f("default_range", "النطاق الزمني الافتراضي", "select", "day", options=[{"v": "day", "l": "يوم"}, {"v": "week", "l": "أسبوع"}, {"v": "month", "l": "شهر"}]),
        _f("default_entity", "الكيان الافتراضي", "text", ""),
        _f("refresh_interval_sec", "فترة التحديث (ثوانٍ)", "number", 180),
        _f("live_mode", "الوضع المباشر", "toggle", True),
        _f("demo_mode", "وضع العرض التجريبي", "toggle", False),
        _f("command_center_default", "لوحة القيادة كصفحة افتراضية", "toggle", False),
        _f("chief_ai_page", "تفعيل صفحة ضابط الاستخبارات", "toggle", True),
    ]},
    {"category": "reports", "label": "إعدادات التقارير", "icon": "", "fields": [
        _f("enable_pdf", "تقارير PDF", "toggle", True),
        _f("enable_word", "تقارير Word", "toggle", True),
        _f("enable_pptx", "تقارير PowerPoint", "toggle", True),
        _f("language", "لغة التقرير", "select", "ar", options=LANGS),
        _f("branding", "هوية بصرية", "text", "مركز الرصد"),
        _f("footer_text", "نص التذييل", "text", ""),
        _f("exec_style", "أسلوب الموجز التنفيذي", "select", "concise", options=[{"v": "concise", "l": "موجز"}, {"v": "detailed", "l": "مفصّل"}]),
        _f("auto_daily", "تقرير يومي تلقائي", "toggle", False),
        _f("auto_weekly", "تقرير أسبوعي تلقائي", "toggle", False),
        _f("auto_monthly", "تقرير شهري تلقائي", "toggle", False),
        _f("recipients", "مستلمو التقارير", "tags", []),
        _f("generation_time", "وقت التوليد", "text", "07:00"),
    ]},
    {"category": "users", "label": "المستخدمون والأدوار", "icon": "", "custom": "users", "fields": []},
    {"category": "subscription", "label": "الاشتراك والباقة", "icon": "", "fields": [
        _f("package", "الباقة الحالية", "select", "enterprise",
           options=[{"v": "basic", "l": "أساسية"}, {"v": "professional", "l": "احترافية"}, {"v": "enterprise", "l": "مؤسسية"}, {"v": "government", "l": "حكومية"}]),
        _f("max_entities", "أقصى كيانات مرصودة", "number", 100),
        _f("max_sources", "أقصى مصادر", "number", 50),
        _f("max_users", "أقصى مستخدمين", "number", 25),
        _f("max_posts_month", "أقصى منشورات شهرياً", "number", 300000),
        _f("max_ai_month", "أقصى نداءات ذكاء شهرياً", "number", 100000),
        _f("max_reports_month", "أقصى تقارير شهرياً", "number", 500),
        _f("api_access", "وصول API", "toggle", True),
        _f("early_warning", "الإنذار المبكر", "toggle", True),
        _f("campaign_radar", "رادار الحملات", "toggle", True),
        _f("chief_ai", "ضابط الاستخبارات", "toggle", True),
        _f("government_features", "ميزات حكومية", "toggle", True),
    ]},
    {"category": "system_health", "label": "صحّة النظام", "icon": "", "custom": "system_health", "fields": []},
    {"category": "performance", "label": "إعدادات الأداء", "icon": "", "fields": [
        _f("redis_cache", "تفعيل تخزين Redis", "toggle", True),
        _f("cache_seconds", "مدة التخزين (ثوانٍ)", "number", 1800),
        _f("snapshot_cache_seconds", "مدة تخزين لقطة اللوحة", "number", 3600),
        _f("ai_cache_hours", "مدة تخزين الذكاء (ساعات)", "number", 24),
        _f("api_timeout_sec", "مهلة API (ثوانٍ)", "number", 60),
        _f("max_collectors", "أقصى جامعات متزامنة", "number", 4),
        _f("max_ai_jobs", "أقصى مهام ذكاء متزامنة", "number", 3),
        _f("background_jobs", "تفعيل المهام الخلفية", "toggle", True),
        _f("lazy_loading", "تحميل كسول", "toggle", True),
        _f("compressed_responses", "ضغط الاستجابات", "toggle", True),
    ]},
    {"category": "security", "label": "إعدادات الأمان", "icon": "", "fields": [
        _f("require_2fa", "إلزام التحقّق الثنائي", "toggle", False),
        _f("session_timeout_min", "مهلة الجلسة (دقائق)", "number", 480),
        _f("allowed_domains", "النطاقات المسموحة", "tags", []),
        _f("audit_logs", "سجلّات التدقيق", "toggle", True),
        _f("data_export", "السماح بتصدير البيانات", "toggle", True),
        _f("data_delete", "السماح بحذف البيانات", "toggle", False),
        _f("rls_status", "حالة RLS (للعرض)", "info", "مُفعّل"),
        _f("admin_lock", "قفل الإعدادات للمدير فقط", "toggle", True),
    ]},
    {"category": "audit", "label": "سجلّات التدقيق", "icon": "", "custom": "audit", "fields": []},
    {"category": "backup", "label": "النسخ والاحتفاظ بالبيانات", "icon": "", "fields": [
        _f("daily_backup", "نسخ احتياطي يومي", "toggle", True),
        _f("backup_frequency", "تكرار النسخ", "select", "daily", options=[{"v": "daily", "l": "يومي"}, {"v": "weekly", "l": "أسبوعي"}]),
        _f("retention_days", "مدة الاحتفاظ (أيام)", "number", 90),
        _f("delete_old_raw", "حذف الخام القديم", "toggle", True),
        _f("delete_old_alerts", "حذف الإنذارات القديمة", "toggle", False),
        _f("archive_old_campaigns", "أرشفة الحملات القديمة", "toggle", True),
        _f("keep_reports_forever", "حفظ التقارير دائماً", "toggle", True),
    ]},
]

CATEGORIES = {c["category"]: c for c in SCHEMA}


def _full_key(category, key):
    return f"{category}.{key}"


def _defaults():
    out = {}
    for c in SCHEMA:
        for fld in c["fields"]:
            out[_full_key(c["category"], fld["key"])] = fld["default"]
    return out


def mask_secret(value: str) -> str:
    if not value:
        return ""
    s = str(value)
    return ("sk-****" + s[-4:]) if len(s) > 6 else "****"


async def _db_values() -> dict:
    if not db.enabled():
        return {}
    try:
        rows = await db.select("system_settings", "select=key,value_json&limit=1000")
        return {r["key"]: (r.get("value_json") or {}).get("v") for r in (rows or [])}
    except Exception:
        return {}


async def get(category: str, key: str, default=None):
    """Single setting — DB → env → schema default."""
    fk = _full_key(category, key)
    vals = await _db_values()
    if fk in vals and vals[fk] is not None:
        return vals[fk]
    fld = next((f for f in CATEGORIES.get(category, {}).get("fields", []) if f["key"] == key), None)
    if fld and fld.get("env") and os.getenv(fld["env"]):
        return os.getenv(fld["env"])
    if fld is not None:
        return fld["default"]
    return default


async def get_view() -> list:
    """Whole schema with current values, secrets masked + service status."""
    vals = await _db_values()
    out = []
    for c in SCHEMA:
        fields = []
        for fld in c["fields"]:
            fk = _full_key(c["category"], fld["key"])
            cur = vals.get(fk, fld["default"])
            f2 = {**fld}
            if fld["type"] == "password":
                env_set = bool(fld.get("env") and os.getenv(fld["env"]))
                f2["value"] = mask_secret(cur) if cur else ("sk-****env" if env_set else "")
                f2["configured"] = bool(cur) or env_set
                f2.pop("env", None)
            else:
                f2["value"] = cur
            fields.append(f2)
        out.append({"category": c["category"], "label": c["label"], "icon": c["icon"],
                    "custom": c.get("custom"), "service": c.get("service"), "fields": fields})
    return out


async def set_many(category: str, changes: dict, *, user=None, ip=None) -> dict:
    """Upsert changed keys + write audit logs (old→new). Secrets stored as-is in
    DB (server-side only) but never returned in full by get_view()."""
    if not db.enabled():
        return {"saved": 0, "reason": "db_disabled"}
    cur = await _db_values()
    saved, failed = 0, 0
    ts = int(time.time())
    for key, val in (changes or {}).items():
        fk = _full_key(category, key)
        old = cur.get(fk)
        if old == val:
            continue
        try:
            ok = await db.insert("system_settings",
                                 {"key": fk, "value_json": {"v": val}, "category": category,
                                  "updated_by": str(user) if user else None},
                                 upsert=True, on_conflict="key")
            if ok:
                await db.insert("system_audit_logs",
                                {"user_id": str(user) if user else None, "action": "update",
                                 "category": category, "key": fk, "ip_address": ip,
                                 "old_value": {"v": old}, "new_value": {"v": _audit_safe(category, key, val)}})
                saved += 1
            else:
                failed += 1
        except Exception:
            failed += 1
    out = {"saved": saved, "failed": failed, "persisted": saved > 0 and failed == 0, "ts": ts}
    if failed and not saved:
        out["reason"] = "table_missing"   # system_settings not created — run migration 007
    return out


def _audit_safe(category, key, val):
    fld = next((f for f in CATEGORIES.get(category, {}).get("fields", []) if f["key"] == key), None)
    if fld and fld["type"] == "password":
        return mask_secret(val)
    return val


async def reset_category(category: str, *, user=None) -> dict:
    if not db.enabled():
        return {"reset": 0, "reason": "db_disabled"}
    keys = [f["key"] for f in CATEGORIES.get(category, {}).get("fields", [])]
    n = 0
    for k in keys:
        fk = _full_key(category, k)
        try:
            await db.update("system_settings", f"key=eq.{fk}",
                            {"value_json": None, "updated_by": str(user) if user else None})
            n += 1
        except Exception:
            pass
    await db.insert("system_audit_logs",
                    {"user_id": str(user) if user else None, "action": "reset",
                     "category": category, "key": category, "old_value": {}, "new_value": {}})
    return {"reset": n}


async def audit_log(limit: int = 100) -> list:
    if not db.enabled():
        return []
    try:
        rows = await db.select("system_audit_logs",
                               f"select=user_id,action,category,key,old_value,new_value,created_at&order=created_at.desc&limit={limit}")
        return rows or []
    except Exception:
        return []
