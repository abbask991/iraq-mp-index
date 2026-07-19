"use client";
import { SkelCards } from "@/components/Skeleton";
import { HBars, Donut, Stars } from "@/components/MiniCharts";
import { useBrand } from "../useBrand";

const fmt = (n: number) => (n || 0).toLocaleString("en-US");

/** Moved verbatim from /corporate/reviews. Host owns brand + demo + fetch. */
export default function ReviewsView({ brand, demo }: { brand: string; demo: boolean }) {
  const { d, loading } = useBrand("reviews", brand, demo, "place");
  if (loading) return <SkelCards count={3} />;
  if (d?.empty) return <div className="cbox">{d.note}</div>;
  const dist = d?.distribution || {};
  const distData = ["5", "4", "3", "2", "1"].map((k) => ({ label: `${k} ★`, value: dist[k] || 0, color: Number(k) >= 4 ? "#22c55e" : Number(k) === 3 ? "#f59e0b" : "#f43f5e" }));
  const s = d?.sentiment || {};
  return (
    <>
      {!loading && d && (
        <>
          {/* The old copy claimed sample data was shown below. It was not: load()
              stores the real (empty) response here, so nothing followed. Say what
              is true, and do not name a provider key to the client. */}
          {d._needsKey && <div className="cbox" style={{ marginBottom: 12, borderInlineStart: "4px solid var(--warn)" }}>{d.note}</div>}


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
    </>
  );
}
