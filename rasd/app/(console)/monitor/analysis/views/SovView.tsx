"use client";
import { useEffect, useState } from "react";
import { apiPost } from "@/lib/api";
import RangeSelect, { Range } from "@/components/RangeSelect";

const sColor = (s: string) => (s === "سلبي" ? "#f43f5e" : s === "إيجابي" ? "#22c55e" : "#8a97ad");
const BAR = ["#2563eb", "#22c55e", "#f59e0b", "#f43f5e", "#a855f7", "#06b6d4"];

const PRESETS: { label: string; category: string; entities: { name: string; aliases: string[] }[] }[] = [
  {
    label: "قادة سياسيون", category: "قادة سياسيون",
    entities: [
      { name: "محمد شياع السوداني", aliases: ["السوداني", "محمد السوداني", "رئيس الوزراء", "رئيس الحكومة"] },
      { name: "مقتدى الصدر", aliases: ["مقتدى الصدر", "الصدر", "السيد مقتدى"] },
      { name: "نوري المالكي", aliases: ["نوري المالكي", "المالكي"] },
      { name: "محمد الحلبوسي", aliases: ["الحلبوسي", "محمد الحلبوسي"] },
    ],
  },
  {
    label: "كتل/أحزاب", category: "أحزاب",
    entities: [
      { name: "الإطار التنسيقي", aliases: ["الاطار التنسيقي", "الإطار التنسيقي"] },
      { name: "التيار الصدري", aliases: ["التيار الصدري", "الكتلة الصدرية"] },
      { name: "دولة القانون", aliases: ["دولة القانون", "ائتلاف دولة القانون"] },
      { name: "تقدم", aliases: ["تحالف تقدم", "حزب تقدم"] },
    ],
  },
];

export default function SovView() {
  const [range, setRange] = useState<Range>("week");
  const [custom, setCustom] = useState("");
  const [res, setRes] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const run = async (entities: any[], category: string) => {
    if (entities.length < 2) return;
    setLoading(true); setRes(null);
    const r = await apiPost("sov", { entities, category, range }).catch(() => null);
    setRes(r); setLoading(false);
  };
  const runCustom = () => {
    const names = custom.split(/[,،\n]/).map((s) => s.trim()).filter(Boolean);
    run(names.map((n) => ({ name: n, aliases: [n] })), "مخصّص");
  };
  useEffect(() => {
    if (PRESETS[0]) run(PRESETS[0].entities, PRESETS[0].category);   // ready insight on open
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
 <div>
 <h2> حصة الصوت الإعلامية (Share of Voice)</h2>
 <p className="muted">يقارن حضور عدّة كيانات في المحادثة الإعلامية — موزوناً بالذِكر + التفاعل + الوصول + وزن المصدر + البروز + الجودة، مع حصة لكل نبرة.</p>

 <div className="card" style={{ marginBottom: 14 }}>
 <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
 <RangeSelect value={range} onChange={setRange} disabled={loading} />
 </div>
 <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          {PRESETS.map((p) => (
 <button key={p.label} className="btn ghost" onClick={() => run(p.entities, p.category)} disabled={loading}>{p.label}</button>
          ))}
 </div>
 <div style={{ display: "flex", gap: 8 }}>
 <input placeholder="أو قارن أسماء مخصّصة (افصلها بفاصلة): السوداني، الصدر، المالكي" value={custom}
            onChange={(e) => setCustom(e.target.value)} onKeyDown={(e) => e.key === "Enter" && runCustom()} />
 <button className="btn" onClick={runCustom} disabled={loading}>قارن</button>
 </div>
 </div>

      {loading && <div className="spinner" />}

      {res && !loading && (res.message && !res.entities?.length ? <p className="muted">{res.message}</p> : (
 <>
          {res.report && (
 <div className="card" style={{ marginBottom: 14, borderInlineStart: "4px solid var(--accent)" }}>
 <b> {res.report}</b>
 <p className="muted" style={{ fontSize: 11, marginTop: 6 }}>{res.note}</p>
 </div>
          )}

 <div className="cbox" style={{ marginBottom: 14 }}>
 <h4>حصة الصوت الموزونة</h4>
            {res.entities.map((e: any, i: number) => (
 <div key={e.name} style={{ marginBottom: 10 }}>
 <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 3 }}>
 <span><b>{e.rank}. {e.name}</b> <span style={{ color: sColor(e.dominant_sentiment) }}>● {e.dominant_sentiment}</span></span>
 <b>{e.share_of_voice}%</b>
 </div>
 <div className="bar" style={{ height: 16 }}><i style={{ width: `${e.share_of_voice}%`, background: BAR[i % BAR.length] }} /></div>
 <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>
                  {e.mentions} ذِكر ·  {Number(e.engagement).toLocaleString()} · وصول ~{Number(e.reach).toLocaleString()} · منصّة: {e.main_platform} · سردية: {e.narrative}
                  {e.alerts?.length > 0 && <span style={{ color: "#f43f5e" }}> · {e.alerts.join(" · ")}</span>}
 </div>
 </div>
            ))}
 </div>

 <div className="cbox">
 <h4>حصة الصوت حسب النبرة</h4>
 <div className="muted" style={{ fontSize: 11, marginBottom: 8 }}>من يملك أكبر حصة من المحادثة الإيجابية/السلبية/المحايدة:</div>
            {res.entities.map((e: any) => (
 <div className="srcrow" key={e.name} style={{ marginBottom: 6 }}>
 <div style={{ width: 130, fontSize: 12 }}>{e.name}</div>
 <div style={{ flex: 1, display: "flex", height: 16, borderRadius: 4, overflow: "hidden" }}>
 <div style={{ width: `${e.positive_sov}%`, background: "#22c55e" }} title={`إيجابي ${e.positive_sov}%`} />
 <div style={{ width: `${e.neutral_sov}%`, background: "#8a97ad" }} title={`محايد ${e.neutral_sov}%`} />
 <div style={{ width: `${e.negative_sov}%`, background: "#f43f5e" }} title={`سلبي ${e.negative_sov}%`} />
 </div>
 <span className="muted" style={{ fontSize: 10, width: 90, textAlign: "left" }}>
                  +{e.positive_sov} / -{e.negative_sov}
 </span>
 </div>
            ))}
 </div>

 <p className="muted" style={{ fontSize: 11, marginTop: 14 }}>
            * مقارنة الفترة السابقة (تغيّر الحصة) تحتاج تخزيناً تاريخياً — تُضاف مع طبقة التخزين المستمر. تحليل آلي يحتاج مراجعة.
 </p>
 </>
      ))}
 </div>
  );
}
