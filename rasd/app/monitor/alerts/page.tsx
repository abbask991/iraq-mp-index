"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { apiPost } from "@/lib/api";

const LEVEL = {
  high: { c: "#f43f5e", bg: "#2a0f16", label: "خطر مرتفع", icon: "🔴" },
  medium: { c: "#f59e0b", bg: "#2a1f0a", label: "انتباه", icon: "🟡" },
  low: { c: "#22c55e", bg: "#0f2418", label: "طبيعي", icon: "🟢" },
} as const;

type Risk = { level: "high" | "medium" | "low"; total: number; neg: number; recent_neg: number; neg_ratio: number; score: number; top_negative: any[] };

export default function Alerts() {
  const [monitors, setMonitors] = useState<any[]>([]);
  const [risks, setRisks] = useState<Record<number, Risk | "loading">>({});
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    supabase.from("monitors").select("*").order("created_at", { ascending: false })
      .then(({ data }) => setMonitors(data || []));
  }, []);

  const scan = useCallback(async (list: any[]) => {
    setScanning(true);
    // scan sequentially so each card fills in as it resolves (cache makes repeats instant)
    for (const m of list) {
      setRisks((r) => ({ ...r, [m.id]: "loading" }));
      const res = await apiPost("risk", { keywords: m.keywords }).catch(() => null);
      setRisks((r) => ({ ...r, [m.id]: res || { level: "low", total: 0, neg: 0, recent_neg: 0, neg_ratio: 0, score: 0, top_negative: [] } }));
    }
    setScanning(false);
  }, []);

  const ranked = [...monitors].sort((a, b) => {
    const ra = risks[a.id], rb = risks[b.id];
    const sa = ra && ra !== "loading" ? ra.score : -1;
    const sb = rb && rb !== "loading" ? rb.score : -1;
    return sb - sa;
  });
  const highCount = monitors.filter((m) => { const r = risks[m.id]; return r && r !== "loading" && r.level === "high"; }).length;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <div>
          <h2>🔔 الإنذار المبكر</h2>
          <p className="muted">يفحص أهدافك ويكشف ارتفاع الذِكر السلبي قبل ما يتحوّل لأزمة.</p>
        </div>
        <button className="btn" onClick={() => scan(monitors)} disabled={scanning || !monitors.length}>
          {scanning ? "جارٍ الفحص…" : "🔍 افحص الآن"}
        </button>
      </div>

      {!monitors.length && <p className="muted">لا أهداف بعد — أنشئ عملية رصد أولاً من <Link href="/monitor">عمليات الرصد</Link>.</p>}

      {Object.keys(risks).length > 0 && (
        <div className="stat-grid" style={{ margin: "14px 0" }}>
          <div className="stat"><div className="v">{monitors.length}</div><div className="l">أهداف مرصودة</div></div>
          <div className="stat"><div className="v" style={{ color: highCount ? LEVEL.high.c : undefined }}>{highCount}</div><div className="l">تنبيهات خطر مرتفع</div></div>
        </div>
      )}

      {ranked.map((m) => {
        const r = risks[m.id];
        const lv = r && r !== "loading" ? LEVEL[r.level] : null;
        return (
          <div className="card" key={m.id} style={{ marginBottom: 10, borderInlineStart: lv ? `4px solid ${lv.c}` : undefined }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
              <div>
                <b>📡 {m.name}</b>
                <div className="muted" style={{ fontSize: 12 }}>{(m.keywords || []).join(" · ")}</div>
              </div>
              {r === "loading" ? <span className="muted">جارٍ الفحص…</span>
                : r ? (
                  <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                    <span style={{ color: lv!.c, fontWeight: 800 }}>{lv!.icon} {lv!.label}</span>
                    <span className="muted" style={{ fontSize: 12 }}>سلبي حديث: <b style={{ color: LEVEL.high.c }}>{r.recent_neg}</b> · إجمالي سلبي: {r.neg}/{r.total}</span>
                    <Link href={`/monitor/${m.id}`} className="btn ghost" style={{ padding: "4px 10px", fontSize: 12 }}>التفاصيل</Link>
                  </div>
                ) : <span className="muted">—</span>}
            </div>
            {r && r !== "loading" && r.level !== "low" && r.top_negative?.length > 0 && (
              <div style={{ marginTop: 10, background: lv!.bg, borderRadius: 8, padding: "8px 12px" }}>
                <div className="muted" style={{ fontSize: 11, marginBottom: 6 }}>أبرز المنشورات السلبية:</div>
                {r.top_negative.slice(0, 4).map((h: any, i: number) => (
                  <div key={i} style={{ fontSize: 12.5, padding: "3px 0" }}>
                    <span style={{ opacity: 0.6 }}>{h.platform === "x" ? "𝕏" : "📰"}</span>{" "}
                    <a href={h.link} target="_blank" rel="noopener" style={{ color: "var(--text)" }}>{h.title}</a>
                    <span className="muted"> — {h.source} · {h.date}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {monitors.length > 0 && Object.keys(risks).length === 0 && (
        <p className="muted" style={{ marginTop: 14 }}>اضغط «افحص الآن» لبدء تقييم المخاطر لأهدافك.</p>
      )}
    </div>
  );
}
