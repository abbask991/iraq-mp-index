"use client";
import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";
import AreaChart from "@/components/AreaChart";
import { SkelCards } from "@/components/Skeleton";

const fmt = (n: number) => (n || 0).toLocaleString("en-US");
const usd = (n: number) => "$" + (n || 0).toFixed(2);
const catColor = ["#4f9dff", "#f43f5e", "#fb923c", "#a855f7", "#22c55e", "#34d6c6", "#eab308", "#ec4899", "#8b5cf6", "#f59e0b"];

export default function UsageView() {
  const [d, setD] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { apiGet("/api/settings/usage").then(setD).finally(() => setLoading(false)); }, []);

  const b = d?.budget || {};
  const rate = b.cost_per_1k || 0.01;
  const cats = d?.categories || [];
  const maxCat = Math.max(1, ...cats.map((c: any) => c.tweets));
  const daily = (d?.daily || []).map((x: any) => ({ label: (x.date || "").slice(5), value: x.tweets, sub: usd(x.tweets / 1000 * rate) }));

  return (
    <div>
      <h2>💰 الاستهلاك والكلفة</h2>
      <p className="muted">كم تغريدة جلب النظام هذا الشهر، وين راحت (حسب الفيجر)، والكلفة بالدولار بسعرك الفعلي — مع ترددات التحديث التلقائي.</p>

      {loading && <SkelCards count={3} />}
      {d && (
        <>
          {/* totals */}
          <div className="grid grid-4" style={{ marginBottom: 14, gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", display: "grid", gap: 12 }}>
            <div className="card" style={{ textAlign: "center" }}>
              <div style={{ fontSize: 28, fontWeight: 900, color: "#4f9dff" }}>{fmt(b.used)}</div>
              <div className="muted" style={{ fontSize: 12 }}>تغريدة هذا الشهر ({b.month})</div>
            </div>
            <div className="card" style={{ textAlign: "center" }}>
              <div style={{ fontSize: 28, fontWeight: 900, color: "#22c55e" }}>{usd(b.est_cost_usd)}</div>
              <div className="muted" style={{ fontSize: 12 }}>الكلفة (سعرك {usd(rate)}/ألف)</div>
            </div>
            <div className="card" style={{ textAlign: "center" }}>
              <div style={{ fontSize: 28, fontWeight: 900, color: b.capped ? "#f43f5e" : "#fb923c" }}>{b.pct ?? 0}%</div>
              <div className="muted" style={{ fontSize: 12 }}>من السقف ({fmt(b.cap)})</div>
            </div>
            <div className="card" style={{ textAlign: "center" }}>
              <div style={{ fontSize: 28, fontWeight: 900 }}>{fmt(b.remaining)}</div>
              <div className="muted" style={{ fontSize: 12 }}>متبقّي داخلياً</div>
            </div>
          </div>

          {/* daily chart */}
          <div className="cbox" style={{ marginBottom: 14 }}>
            <h4>📈 الاستهلاك اليومي (آخر ١٤ يوم)</h4>
            {daily.some((x: any) => x.value > 0)
              ? <AreaChart data={daily} height={150} color="#4f9dff" />
              : <p className="muted">لا استهلاك مُسجّل بعد — سيظهر بعد أول تحليل.</p>}
          </div>

          {/* category breakdown */}
          <div className="cbox" style={{ marginBottom: 14 }}>
            <h4>🧩 التوزيع حسب الفيجر</h4>
            {cats.length ? cats.map((c: any, i: number) => (
              <div key={c.category} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderTop: i ? "1px solid var(--line)" : 0 }}>
                <span style={{ fontSize: 13, minWidth: 150 }}>{c.label}</span>
                <span style={{ flex: 1, height: 10, borderRadius: 999, background: "var(--input)", overflow: "hidden" }}>
                  <span style={{ display: "block", height: "100%", width: `${(c.tweets / maxCat) * 100}%`, background: catColor[i % catColor.length], borderRadius: 999, transition: "width .8s" }} />
                </span>
                <span style={{ fontSize: 12.5, minWidth: 110, textAlign: "left" }}><b>{fmt(c.tweets)}</b> <span className="muted">· {usd(c.tweets / 1000 * rate)}</span></span>
              </div>
            )) : <p className="muted">لا بيانات بعد — ستظهر بعد تشغيل التحاليل.</p>}
          </div>

          {/* frequencies */}
          <div className="cbox" style={{ marginBottom: 14 }}>
            <h4>⏱️ ترددات التحديث التلقائي</h4>
            <table className="brief-tbl" style={{ width: "100%" }}>
              <thead><tr><th>المهمّة</th><th>التكرار</th><th>يجلب X؟</th></tr></thead>
              <tbody>
                {(d.frequencies || []).map((f: any, i: number) => (
                  <tr key={i}>
                    <td>{f.job}</td>
                    <td className="muted">{f.every}</td>
                    <td>{f.fetches_x ? <span style={{ color: "#f43f5e" }}>✅ نعم (~{fmt(f.tweets)})</span> : <span style={{ color: "#22c55e" }}>❌ مجاني</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>{d.note}</p>
          </div>
        </>
      )}
    </div>
  );
}
