"use client";
import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";
import { SkelCards } from "@/components/Skeleton";
import { HBars, Donut, Stars } from "@/components/MiniCharts";
import { useDemo } from "@/components/ui/DemoContext";

const fmt = (n: number) => (n || 0).toLocaleString("en-US");

export default function GoogleReviews() {
  const [place, setPlace] = useState("");
  const { demo } = useDemo();
  const [d, setD] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const load = async (real = false) => {
    setLoading(true);
    const r = await apiGet(`/api/corporate/reviews?place=${encodeURIComponent(place)}${real ? "" : "&demo=1"}`).catch(() => null);
    // if a real lookup isn't configured, keep showing the sample so charts stay populated
    if (real && r && r.configured === false) { setD({ ...r, _needsKey: true }); }
    else setD(r);
    setLoading(false);
  };
  useEffect(() => { load(false); /* auto-load sample so results appear immediately */ /* eslint-disable-next-line */ }, []);

  const dist = d?.distribution || {};
  const distData = ["5", "4", "3", "2", "1"].map((k) => ({ label: `${k} ★`, value: dist[k] || 0, color: Number(k) >= 4 ? "#22c55e" : Number(k) === 3 ? "#f59e0b" : "#f43f5e" }));
  const s = d?.sentiment || {};

  return (
    <div>
      <h2 style={{ margin: 0 }}>ريفيوات Google</h2>
      <p className="muted">تقييمات ومراجعات Google Maps: النجوم، توزيع التقييمات، مشاعر المراجعات، وأحدثها — تظهر تلقائياً.</p>
      <div className="card" style={{ marginBottom: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input placeholder="اسم المكان/الشركة على خرائط Google" value={place} onChange={(e) => setPlace(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load(true)} style={{ flex: 1 }} />
        <button className="btn" onClick={() => load(true)} disabled={loading}>جلب من Google</button>
      </div>

      {loading && <SkelCards count={3} />}
      {!loading && d && (
        <>
          {d._needsKey && <div className="cbox" style={{ marginBottom: 12, borderInlineStart: "4px solid #f59e0b" }}>ℹ️ {d.note} — تُعرض بيانات تجريبية أدناه للتوضيح.</div>}
          {(d.demo || d._needsKey) && <p className="muted" style={{ fontSize: 11.5, color: "#6366f1" }}>🧪 عيّنة توضيحية — تُستبدل بريفيوات حقيقية عند إضافة مفتاح المزوّد.</p>}

          {/* header stats */}
          <div className="grid" style={{ marginBottom: 14 }}>
            <div className="cbox" style={{ textAlign: "center" }}>
              <div style={{ fontSize: 44, fontWeight: 900, color: "#f59e0b" }}>{d.rating ?? "—"}</div>
              <Stars rating={d.rating} size={20} />
              <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{fmt(d.total_reviews)} مراجعة · {d.place}</div>
            </div>
            <div className="cbox">
              <h4 style={{ marginTop: 0 }}>توزيع التقييمات</h4>
              <HBars data={distData} />
            </div>
            <div className="cbox" style={{ textAlign: "center" }}>
              <h4 style={{ marginTop: 0 }}>مشاعر المراجعات</h4>
              <Donut size={110} segments={[{ value: s.positive || 0, color: "#22c55e" }, { value: s.neutral || 0, color: "#8a97ad" }, { value: s.negative || 0, color: "#f43f5e" }]} label={`${s.negative || 0}%-`} />
              <div style={{ fontSize: 11.5, marginTop: 4 }}><span style={{ color: "#22c55e" }}>إيجابي {s.positive}%</span> · <span style={{ color: "#f43f5e" }}>سلبي {s.negative}%</span></div>
            </div>
          </div>

          {d.summary && <div className="cbox" style={{ marginBottom: 14 }}>{d.summary}</div>}

          {d.recent?.length > 0 && (
            <div className="cbox" style={{ marginBottom: 14 }}>
              <h4>أحدث المراجعات</h4>
              {d.recent.map((r: any, i: number) => (
                <div key={i} style={{ padding: "8px 0", borderTop: i ? "1px solid var(--line)" : 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <b style={{ fontSize: 13 }}>{r.author || "مستخدم"}</b>
                    <span><Stars rating={r.rating} /> <span className="muted" style={{ fontSize: 11 }}>{r.time}</span></span>
                  </div>
                  <div style={{ fontSize: 13, marginTop: 3 }}>{r.text}</div>
                </div>
              ))}
            </div>
          )}
          <p className="muted" style={{ fontSize: 11 }}>{d.disclaimer}</p>
        </>
      )}
    </div>
  );
}
