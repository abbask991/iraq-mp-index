"use client";
import { useEffect, useState } from "react";
import { apiGet, apiSend } from "@/lib/api";
import { Icon, Badge } from "@/components/ui";

/**
 * Intelligence Memory Recall — "has this happened before?". Similarity-matches the
 * current issue against the tenant's RECORDED case history (real past situations
 * with dated outcomes + lessons an analyst entered). It never invents a past
 * outcome; an empty history shows an honest empty state and an inline "record this
 * case" form so the memory grows from real events.
 */
export default function IntelligenceMemoryRecall({ entity, issue, anger, platforms, compact }:
  { entity?: string; issue?: string; anger?: number; platforms?: string[]; compact?: boolean }) {
  const [d, setD] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [recording, setRecording] = useState(false);
  const [form, setForm] = useState({ title: "", outcome: "", lesson: "", resolved_at: "" });
  const [msg, setMsg] = useState("");

  const load = () => {
    setLoading(true);
    const p = new URLSearchParams();
    if (entity) p.set("entity", entity);
    if (issue) p.set("issue", issue);
    if (anger != null) p.set("anger_score", String(Math.round(anger)));
    if (platforms?.length) p.set("platforms", platforms.join(","));
    apiGet(`/api/intel-cases/recall?${p.toString()}`).then(setD).catch(() => setD(null)).finally(() => setLoading(false));
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [entity, issue, anger]);

  const save = async () => {
    if (!form.title.trim()) { setMsg("العنوان مطلوب"); return; }
    setMsg("…");
    const body = {
      title: form.title, entity: entity || "", issue: issue || "",
      anger_score: anger != null ? Math.round(anger) : null, platforms: platforms || [],
      outcome: form.outcome, lesson: form.lesson, resolved_at: form.resolved_at || null,
    };
    const r = await apiSend("/api/intel-cases/record", "POST", body).catch(() => null);
    if (r?.saved) { setMsg("✅ سُجّلت الحالة في الذاكرة المرجعية"); setForm({ title: "", outcome: "", lesson: "", resolved_at: "" }); setRecording(false); load(); }
    else setMsg(r?.note || "تعذّر الحفظ — سجّل الدخول");
  };

  if (loading || !d) return null;
  const matches = d.matches || [];
  const total = d.total_cases || 0;

  if (compact && !matches.length) return null; // stay quiet in compact when nothing to recall

  return (
    <div className="cbox">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 6 }}>
        <span style={{ fontWeight: 700, fontSize: 14, display: "inline-flex", alignItems: "center", gap: 7 }}>
          <Icon name="refresh" size={15} /> هل حدث هذا من قبل؟
        </span>
        {!compact && <button className="btn ghost" style={{ fontSize: 12, padding: "3px 10px" }} onClick={() => setRecording((v) => !v)}>{recording ? "إلغاء" : "سجّل حالة"}</button>}
      </div>

      {matches.length === 0 && !recording && (
        <p className="muted" style={{ fontSize: 13, margin: 0 }}>
          {total === 0 ? "لا حالات مرجعية مسجّلة بعد — تُبنى الذاكرة مع تسجيل الحالات وخلاصاتها لتُقارَن مستقبلاً."
            : "لا حالة سابقة مشابهة بما يكفي في السجل."}
        </p>
      )}

      {matches.map((m: any) => (
        <div key={m.id} style={{ borderInlineStart: "3px solid var(--accent)", padding: "8px 12px", marginTop: 8, background: "color-mix(in srgb, var(--accent) 4%, transparent)", borderRadius: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <b>{m.title}</b>
            <Badge t={m.similarity >= 70 ? "danger" : m.similarity >= 45 ? "warn" : "info"}>تشابه {m.similarity}%</Badge>
          </div>
          {(m.match_reasons || []).length > 0 && <div className="u-fine">مطابقة: {m.match_reasons.join("، ")}</div>}
          {m.outcome && <div style={{ fontSize: 13, marginTop: 4 }}><b>ما حدث لاحقاً:</b> {m.outcome}</div>}
          {m.lesson && <div style={{ fontSize: 13, marginTop: 2, color: "var(--accent)" }}>▸ الدرس: {m.lesson}</div>}
          {m.current_difference && <div className="u-fine" style={{ marginTop: 3 }}>الفرق الآن: {m.current_difference}</div>}
          {m.resolved_at && <div className="u-fine">حُسمت: {String(m.resolved_at).slice(0, 10)}</div>}
        </div>
      ))}

      {recording && (
        <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
          <input placeholder="عنوان الحالة (مثال: موجة غضب الكهرباء — تموز)" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <textarea rows={2} placeholder="ما حدث لاحقاً (النتيجة)" value={form.outcome} onChange={(e) => setForm({ ...form, outcome: e.target.value })} style={{ fontFamily: "inherit", fontSize: 13 }} />
          <textarea rows={2} placeholder="الدرس المستفاد" value={form.lesson} onChange={(e) => setForm({ ...form, lesson: e.target.value })} style={{ fontFamily: "inherit", fontSize: 13 }} />
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <input type="date" value={form.resolved_at} onChange={(e) => setForm({ ...form, resolved_at: e.target.value })} style={{ width: 160 }} />
            <button className="btn" onClick={save}>حفظ في الذاكرة</button>
            <span className="u-fine">سيُربط تلقائياً بـ: {entity || "—"}{anger != null ? ` · غضب ${Math.round(anger)}` : ""}</span>
          </div>
        </div>
      )}
      {msg && <p className="u-fine" style={{ marginTop: 6 }}>{msg}</p>}
      {!compact && <p className="u-fine" style={{ marginTop: 8 }}>الذاكرة تعرض فقط حالات مسجّلة فعلاً (لكل عميل على حدة) — لا تُختلق نتائج سابقة.</p>}
    </div>
  );
}
