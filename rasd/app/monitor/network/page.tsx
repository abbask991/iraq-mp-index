"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { apiPost } from "@/lib/api";
import RangeSelect, { Range } from "@/components/RangeSelect";

export default function Network() {
  const [monitors, setMonitors] = useState<any[]>([]);
  const [term, setTerm] = useState("");
  const [res, setRes] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [range, setRange] = useState<Range>("week");

  useEffect(() => {
    supabase.from("monitors").select("name,keywords").then(({ data }) => setMonitors(data || []));
  }, []);

  const run = async (q: string) => {
    if (!q.trim()) return;
    setTerm(q); setLoading(true); setRes(null);
    const r = await apiPost("network", { keywords: [q], range }).catch(() => null);
    setRes(r); setLoading(false);
  };

  const sevColor = (s: number) => (s >= 60 ? "#f43f5e" : s >= 35 ? "#f59e0b" : "#22c55e");

  return (
    <div>
      <h2>🧠 البيانات الضخمة — كشف الحسابات الوهمية والحملات</h2>
      <p className="muted">يحلّل الحسابات الي تنشر عن أي موضوع، يكشف البوتات المحتملة والحملات المنظّمة (نسخ-لصق + حسابات جديدة متزامنة).</p>

      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <input placeholder="اكتب موضوعاً/اسماً (مثال: محمد الحلبوسي)" value={term}
            onChange={(e) => setTerm(e.target.value)} onKeyDown={(e) => e.key === "Enter" && run(term)} />
          <button className="btn" onClick={() => run(term)} disabled={loading}>{loading ? "جارٍ التحليل…" : "🔍 حلّل"}</button>
        </div>
        <div style={{ marginTop: 10 }}>
          <RangeSelect value={range} onChange={setRange} disabled={loading} />
          {(range === "month" || range === "year") && (
            <span className="muted" style={{ fontSize: 11, marginInlineStart: 8 }}>⚠️ X يحلّل آخر ٧ أيام فقط</span>
          )}
        </div>
        {monitors.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
            <span className="muted" style={{ fontSize: 12 }}>أهدافك:</span>
            {monitors.map((m) => (
              <button key={m.name} className="btn ghost" style={{ padding: "3px 10px", fontSize: 12 }}
                onClick={() => run((m.keywords || [m.name])[0])}>{m.name}</button>
            ))}
          </div>
        )}
      </div>

      {loading && <div className="spinner" />}

      {res && !loading && (res.error || !res.accounts ? (
        <p className="muted">{res.verdict || "لا بيانات كافية لهذا الموضوع خلال آخر ٧ أيام."}</p>
      ) : (
        <>
          <div className="card" style={{
            marginBottom: 14, textAlign: "center",
            borderColor: res.organized ? "#f43f5e55" : "var(--line)",
            background: res.organized ? "#2a0f1622" : undefined,
          }}>
            <div style={{ fontSize: 30 }}>{res.organized ? "🚨" : res.pct_suspicious >= 20 ? "⚠️" : "✅"}</div>
            <h3 style={{ margin: "6px 0", color: res.organized ? "#f43f5e" : "var(--text)" }}>{res.verdict}</h3>
            <p className="muted" style={{ fontSize: 13 }}>تحليل {res.accounts} حساب نشر عن «{term}»</p>
          </div>

          <div className="stat-grid" style={{ marginBottom: 14 }}>
            <div className="stat"><div className="v">{res.accounts}</div><div className="l">حسابات</div></div>
            <div className="stat"><div className="v" style={{ color: res.pct_suspicious >= 30 ? "#f43f5e" : undefined }}>{res.pct_suspicious}%</div><div className="l">مشبوهة (بوت محتمل)</div></div>
            <div className="stat"><div className="v" style={{ color: res.pct_new >= 35 ? "#f59e0b" : undefined }}>{res.pct_new}%</div><div className="l">حسابات جديدة (&lt;شهر)</div></div>
            <div className="stat"><div className="v">{res.avg_bot_score}</div><div className="l">متوسط درجة البوت</div></div>
          </div>

          {res.duplicate_clusters?.length > 0 && (
            <div className="card" style={{ marginBottom: 14, borderColor: "#f59e0b55" }}>
              <b>♻️ نسخ-لصق منظّم ({res.duplicate_clusters.length})</b>
              <p className="muted" style={{ fontSize: 12, margin: "4px 0 8px" }}>نصوص متطابقة من عدّة حسابات — مؤشر حملة:</p>
              {res.duplicate_clusters.map((c: any, i: number) => (
                <div key={i} style={{ padding: "6px 0", borderTop: i ? "1px solid var(--line)" : 0, fontSize: 13 }}>
                  <span className="chip" style={{ color: "#f59e0b" }}>×{c.count}</span> {c.text}…
                </div>
              ))}
            </div>
          )}

          <div className="section-title">أبرز الحسابات المشبوهة</div>
          {res.top_suspicious?.length === 0 && <p className="muted">لا حسابات مشبوهة بارزة.</p>}
          {res.top_suspicious?.map((a: any, i: number) => (
            <div className="card" key={i} style={{ marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                <div>
                  <a href={`https://x.com/${a.username}`} target="_blank" rel="noopener" style={{ color: "var(--text)", fontWeight: 700 }}>
                    {a.name} <span className="muted">@{a.username}</span>
                  </a>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {a.followers} متابع · عمر الحساب: {a.age_days != null ? `${a.age_days} يوم` : "?"}
                  </div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: sevColor(a.score) }}>{a.score}</div>
                  <div className="muted" style={{ fontSize: 10 }}>درجة البوت</div>
                </div>
              </div>
              {a.reasons?.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                  {a.reasons.map((r: string) => (
                    <span key={r} className="chip" style={{ fontSize: 11, color: "var(--muted)" }}>{r}</span>
                  ))}
                </div>
              )}
            </div>
          ))}

          <p className="muted" style={{ fontSize: 11, marginTop: 14 }}>
            * تحليل آلي تقريبي مبني على إشارات علنية (عمر الحساب، التفاعل، تكرار النص). يحتاج مراجعة بشرية قبل أي استنتاج نهائي.
          </p>
        </>
      ))}
    </div>
  );
}
