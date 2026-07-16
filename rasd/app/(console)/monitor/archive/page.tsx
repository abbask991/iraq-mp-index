"use client";
import { useEffect, useState } from "react";
import { apiPost } from "@/lib/api";
import { getTargets, primaryKeyword, Target } from "@/lib/targets";
import RangeSelect, { Range } from "@/components/RangeSelect";
import AreaChart from "@/components/AreaChart";
import { SkelCards } from "@/components/Skeleton";

const C = { pos: "#22c55e", neu: "#8a97ad", neg: "#f43f5e" };

function Timeline({ rows }: { rows: any[] }) {
  if (!rows.length) return <p className="muted">لا بيانات مخزّنة بعد لهذه الفترة.</p>;
  const max = Math.max(1, ...rows.map((r) => r.count));
  const W = Math.max(rows.length * 26, 300), H = 150, pad = 18;
  const bw = (W - pad * 2) / rows.length;
  return (
    <div style={{ overflowX: "auto" }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ minWidth: Math.min(W, 700) }}>
        {rows.map((r, i) => {
          const x = pad + i * bw;
          const h = (r.count / max) * (H - pad * 2);
          const segs = [
            { v: r.neg, c: C.neg }, { v: r.neu, c: C.neu }, { v: r.pos, c: C.pos },
          ];
          let y = H - pad;
          return (
            <g key={i}>
              {segs.map((s, j) => {
                const sh = r.count ? (s.v / r.count) * h : 0;
                y -= sh;
                return <rect key={j} x={x + 2} y={y} width={bw - 4} height={sh} fill={s.c} rx={1} />;
              })}
              {(i % Math.ceil(rows.length / 10 || 1) === 0) && (
                <text x={x + bw / 2} y={H - 4} fill="var(--muted)" fontSize="8" textAnchor="middle">
                  {r.day.slice(5)}</text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export default function Archive() {
  const [targets, setTargets] = useState<Target[]>([]);
  const [term, setTerm] = useState("");
  const [range, setRange] = useState<Range>("month");
  const [d, setD] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const run = async (q: string, r: Range = range) => {
    if (!q.trim()) return;
    setTerm(q); setLoading(true); setD(null);
    const res = await apiPost("archive", { keywords: [q], range: r }).catch(() => null);
    setD(res); setLoading(false);
  };

  useEffect(() => {
    getTargets().then((ts) => { setTargets(ts); run(primaryKeyword(ts)); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const s = d?.sentiment || { pos: 0, neg: 0, neu: 0 };

  return (
    <div>
      <h2>أرشيف X — اتجاه طويل المدى (يكبر يومياً)</h2>
      <p className="muted">على عكس X المباشر (المحدود بآخر ٧ أيام)، هذا القسم يقرأ من <b>أرشيفنا المخزّن</b> الذي
        يكبر كل يوم تلقائياً — فالشهر والسنة يصيران حقيقيين تدريجياً بدون أي كلفة إضافية.</p>

      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <input placeholder="شخص / مؤسسة" value={term}
            onChange={(e) => setTerm(e.target.value)} onKeyDown={(e) => e.key === "Enter" && run(term)} />
          <button className="btn" onClick={() => run(term)} disabled={loading}>{loading ? "…" : "اعرض"}</button>
        </div>
        <div style={{ marginTop: 10, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <RangeSelect value={range} onChange={(r) => { setRange(r); if (term) run(term, r); }} disabled={loading} />
          {targets.map((t) => (
            <button key={t.id} className="btn ghost" style={{ padding: "3px 10px", fontSize: 12 }}
              onClick={() => run(t.keywords?.[0] || t.name)}>{t.name}</button>
          ))}
        </div>
      </div>

      {loading && <SkelCards count={4} />}

      {d && !loading && (
        <>
          <div className="grid" style={{ marginBottom: 14 }}>
            <div className="card"><div className="muted" style={{ fontSize: 12 }}>إجمالي مخزّن</div>
              <div style={{ fontSize: 24, fontWeight: 800 }}>{d.total}</div></div>
            <div className="card"><div className="muted" style={{ fontSize: 12 }}>أيام مغطّاة</div>
              <div style={{ fontSize: 24, fontWeight: 800 }}>{d.days_covered}<span style={{ fontSize: 12, color: "var(--muted)" }}> / {d.window_days}</span></div></div>
            <div className="card"><div className="muted" style={{ fontSize: 12 }}>أول رصد</div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{d.first_seen || "—"}</div></div>
            <div className="card"><div className="muted" style={{ fontSize: 12 }}>المنصّات</div>
              <div style={{ fontSize: 13 }}>{Object.entries(d.platforms || {}).map(([k, v]) => `${k}: ${v}`).join(" · ") || "—"}</div></div>
          </div>

          <div className="card" style={{ marginBottom: 14 }}>
            <b>حجم الذِكر اليومي (موزّع حسب النبرة)</b>
            <div style={{ display: "flex", gap: 14, fontSize: 12, margin: "6px 0" }}>
              <span><span style={{ color: C.pos }}>■</span> إيجابي {s.pos}</span>
              <span><span style={{ color: C.neu }}>■</span> محايد {s.neu}</span>
              <span><span style={{ color: C.neg }}>■</span> سلبي {s.neg}</span>
            </div>
            {(d.timeline || []).length > 1
              ? <AreaChart data={(d.timeline || []).map((r: any) => ({ label: r.day, sub: r.day, value: r.count }))} />
              : <Timeline rows={d.timeline || []} />}
          </div>

          {d.days_covered < d.window_days && (
            <p className="muted" style={{ fontSize: 12 }}>
              الأرشيف عمره {d.days_covered} يوم حالياً — سيمتلئ حتى {d.window_days} يوم تلقائياً مع استمرار التخزين كل ٣ ساعات.
            </p>
          )}
        </>
      )}
    </div>
  );
}
