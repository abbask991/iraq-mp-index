"use client";
import { useEffect, useState, useCallback } from "react";
import { apiPost } from "@/lib/api";
import RangeSelect, { Range } from "@/components/RangeSelect";

const botColor = (s: number) => (s >= 60 ? "#f43f5e" : s >= 35 ? "#f59e0b" : "#8a97ad");

function AccountRow({ a }: { a: any }) {
  return (
 <div className="srcrow" style={{ marginBottom: 4 }}>
 <div style={{ flex: 1, fontSize: 13 }}>
 <a href={`https://x.com/${a.username}`} target="_blank" rel="noopener" style={{ color: "var(--text)" }}>
          {a.name} <span className="muted">@{a.username}</span>
 </a>
 <span className="muted" style={{ fontSize: 11 }}> · أُنشئ {a.created} · {a.followers} متابع · {a.posts} منشور</span>
 </div>
 <span className="chip" style={{ color: botColor(a.bot_score), fontSize: 11 }}>بوت {a.bot_score}</span>
 </div>
  );
}

export default function NewAccounts() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<Range>("day");
  const [open, setOpen] = useState<string>("اليوم (≤24 ساعة)");

  const load = useCallback(async (rng: Range) => {
    setLoading(true);
    const r = await apiPost("new-accounts", { range: rng }).catch(() => null);
    setData(r); setLoading(false);
  }, []);
  useEffect(() => { load("day"); }, [load]);

  return (
 <div>
 <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
 <div>
 <h2> الحسابات الجديدة</h2>
 <p className="muted">يرصد الحسابات الحديثة الإنشاء النشطة في التدفّق العراقي، مجمّعة حسب فريمات زمنية — مؤشر على مزارع البوتات والحملات.</p>
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
 <div className="stat"><div className="v">{data.total_accounts}</div><div className="l">حسابات نشطة</div></div>
 <div className="stat"><div className="v" style={{ color: data.new_ratio > 0.2 ? "#f59e0b" : undefined }}>{data.new_accounts}</div><div className="l">جديدة (≤سنة)</div></div>
 <div className="stat"><div className="v" style={{ color: data.creation_clusters?.length ? "#f43f5e" : undefined }}>{data.creation_clusters?.length || 0}</div><div className="l">تكتّلات إنشاء</div></div>
 </div>

          {data.creation_clusters?.length > 0 && (
 <div className="cbox" style={{ marginBottom: 16, borderColor: "#f43f5e55", background: "#2a0f1622" }}>
 <h4 style={{ color: "#f43f5e" }}> تكتّلات إنشاء بنفس اليوم (مؤشر تنسيق)</h4>
 <p className="muted" style={{ fontSize: 12, margin: "2px 0 8px" }}>حسابات عدّة أُنشئت بنفس التاريخ ونشطة بنفس الموضوع — إشارة محتملة لمزرعة حسابات.</p>
              {data.creation_clusters.map((c: any) => (
 <div key={c.date} style={{ padding: "6px 0", borderTop: "1px solid var(--line)" }}>
 <b> {c.date}</b> <span className="chip" style={{ color: "#f43f5e" }}>{c.count} حساب</span>
 <div style={{ marginTop: 6 }}>{c.accounts.map((a: any) => <AccountRow key={a.username} a={a} />)}</div>
 </div>
              ))}
 </div>
          )}

 <div className="section-title">المجاميع حسب الفريم الزمني</div>
          {data.bands?.map((b: any) => (
 <div className="cbox" key={b.label} style={{ marginBottom: 8 }}>
 <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
                onClick={() => setOpen(open === b.label ? "" : b.label)}>
 <b>{b.label}</b>
 <span className="chip" style={{ color: b.count > 0 ? "var(--accent)" : "var(--muted)" }}>{b.count} حساب</span>
 </div>
              {open === b.label && b.count > 0 && (
 <div style={{ marginTop: 10, borderTop: "1px solid var(--line)", paddingTop: 8 }}>
                  {b.accounts.map((a: any) => <AccountRow key={a.username} a={a} />)}
                  {b.count > b.accounts.length && <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>… و{b.count - b.accounts.length} غيرها</div>}
 </div>
              )}
 </div>
          ))}

 <p className="muted" style={{ fontSize: 11, marginTop: 14 }}>
            * من عيّنة حديثة ({data.scanned} منشور). «درجة البوت» تقديرية. حداثة الإنشاء وحدها ليست دليلاً قاطعاً — تتطلّب مراجعة بشرية.
 </p>
 </>
      ))}
 </div>
  );
}
