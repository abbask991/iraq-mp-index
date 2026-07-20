"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { apiPost } from "@/lib/api";
import RangeSelect, { Range } from "@/components/RangeSelect";

const LV: Record<string, { c: string; bg: string }> = {
  highly: { c: "#f43f5e", bg: "#2a0f16" },
  strong: { c: "#fb923c", bg: "#2a1a0a" },
  possible: { c: "#f59e0b", bg: "#2a1f0a" },
  weak: { c: "#84cc16", bg: "#1d2412" },
  organic: { c: "#22c55e", bg: "#0f2418" },
};

export default function RadarView() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<Range>("day");

  const load = useCallback(async (rng: Range) => {
    setLoading(true);
    const r = await apiPost("campaign-scan", { range: rng }).catch(() => null);
    setData(r); setLoading(false);
  }, []);

  useEffect(() => { load("day"); }, [load]);

  const camps: any[] = data?.campaigns || [];
  const flagged = camps.filter((c) => c.coordination_score >= 30);

  return (
 <div>
 <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
 <div>
 <h2> رادار الحملات</h2>
 <p className="muted">يمسح التدفّق العراقي تلقائياً ويكشف الحملات المنظّمة المحتملة — بدون ما تحدّد موضوع. اضغط أي حملة لتحليلها الكامل.</p>
 </div>
 <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
 <RangeSelect value={range} onChange={(v) => { setRange(v); load(v); }} disabled={loading} />
 <button className="btn" onClick={() => load(range)} disabled={loading}>{loading ? "…" : " مسح"}</button>
 </div>
 </div>

      {loading && <div className="spinner" />}

      {data && !loading && (data.error ? <p className="muted">{data.message || "تعذّر المسح."}</p> : (
 <>
 <div className="stat-grid" style={{ margin: "10px 0 16px" }}>
 <div className="stat"><div className="v">{camps.length}</div><div className="l">موضوع مفحوص</div></div>
 <div className="stat"><div className="v" style={{ color: flagged.length ? "#fb923c" : undefined }}>{flagged.length}</div><div className="l">حملات مشتبهة</div></div>
 <div className="stat"><div className="v">{data.scanned}</div><div className="l">منشور مُمسوح</div></div>
 </div>

          {camps.length === 0 && <p className="muted">لا هاشتاغات كافية للفحص حالياً — جرّب مدة مختلفة.</p>}

          {camps.map((c) => {
            const a = LV[c.alert_level?.level] || LV.organic;
            return (
 <Link key={c.hashtag} href={`/monitor/campaigns?tab=check&q=${encodeURIComponent(c.hashtag)}`}
                className="card" style={{ display: "block", marginBottom: 8, textDecoration: "none", borderInlineStart: `4px solid ${a.c}` }}>
 <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
 <div>
 <b style={{ color: "var(--text)" }}>#{c.hashtag}</b>
 <span className="chip" style={{ color: a.c, marginInlineStart: 8 }}>{c.alert_level?.label}</span>
 <div className="muted" style={{ fontSize: 12, marginTop: 3 }}>
                      {c.total_posts} منشور · {c.unique_accounts} حساب · سردية: {c.main_narrative}
                      {" · "}مكرّر {Math.round(c.duplicate_content_ratio * 100)}% · مشبوه {Math.round(c.suspicious_account_ratio * 100)}%
 </div>
 </div>
 <div style={{ textAlign: "center" }}>
 <div style={{ fontSize: 26, fontWeight: 800, color: a.c }}>{c.coordination_score}</div>
 <div className="muted" style={{ fontSize: 10 }}>درجة التنسيق</div>
 </div>
 </div>
 </Link>
            );
          })}

 <p className="muted" style={{ fontSize: 11, marginTop: 14 }}>
            * كشف احتمالي آلي من عيّنة حديثة. النقر يفتح التحليل الكامل (يشمل الأخبار والمنصّات). يتطلّب مراجعة بشرية قبل أي توصيف.
 </p>
 </>
      ))}
 </div>
  );
}
