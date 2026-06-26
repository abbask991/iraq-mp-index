"use client";
import { useEffect, useRef, useState } from "react";
import { apiGet } from "@/lib/api";
import Gauge from "@/components/Gauge";
import CountUp from "@/components/CountUp";
import BattlefieldGraph from "@/components/BattlefieldGraph";

const sevIcon = (s: string) => (s === "red" ? "🔴" : s === "orange" ? "🟠" : "🟡");
const riskColor = (v: number) => (v >= 70 ? "#f43f5e" : v >= 50 ? "#fb923c" : v >= 30 ? "#f59e0b" : "#22c55e");

export default function WarRoom() {
  const [d, setD] = useState<any>(null);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [clock, setClock] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const load = () => {
    apiGet("/api/battlefield/national").then(setD).catch(() => {});
    apiGet("/monitor/alerts-feed").then((r) => setAlerts(r?.alerts || [])).catch(() => {});
  };
  useEffect(() => { load(); const i = setInterval(load, 45000); return () => clearInterval(i); }, []);
  useEffect(() => { const t = setInterval(() => setClock(new Date().toLocaleTimeString("ar-IQ")), 1000); return () => clearInterval(t); }, []);

  const fs = () => {
    const el = ref.current as any;
    if (!document.fullscreenElement) el?.requestFullscreen?.();
    else document.exitFullscreen?.();
  };

  const sc = d?.scores || {};
  const risk = sc.national_risk || 0;
  const narrs = d?.top_narratives || [];
  const camps = d?.top_campaigns || [];
  const attacked = d?.most_attacked || [];

  return (
    <div ref={ref} className="wr">
      {/* header */}
      <div className="wr-top">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span className="wr-live"><span className="wr-dot" />LIVE</span>
          <b style={{ fontSize: 18, letterSpacing: "1px" }}>SENTINEL · غرفة الحرب</b>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span className="wr-clock">{clock}</span>
          <button className="btn ghost" style={{ fontSize: 12 }} onClick={fs}>⛶ ملء الشاشة</button>
        </div>
      </div>

      {!d && <div style={{ padding: 40, textAlign: "center" }}><span className="spinner" /> تهيئة غرفة الحرب…</div>}

      {d && (
        <>
          {/* KPI hero */}
          <div className="wr-kpis">
            <div className="wr-kpi"><div className="wr-g"><Gauge value={risk} size={92} invert color={riskColor(risk)} /></div><div className="wr-l">الخطر الوطني</div></div>
            <div className="wr-kpi"><div className="wr-v" style={{ color: riskColor(sc.crisis || 0) }}><CountUp value={sc.crisis || 0} /></div><div className="wr-l">مؤشر الأزمة</div></div>
            <div className="wr-kpi"><div className="wr-v" style={{ color: riskColor(sc.political || 0) }}><CountUp value={sc.political || 0} /></div><div className="wr-l">الخطر السياسي</div></div>
            <div className="wr-kpi"><div className="wr-v"><CountUp value={narrs.length} /></div><div className="wr-l">سرديات نشطة</div></div>
            <div className="wr-kpi"><div className="wr-v" style={{ color: camps.length ? "#fb923c" : undefined }}><CountUp value={camps.length} /></div><div className="wr-l">حملات منسّقة</div></div>
            <div className="wr-kpi"><div className="wr-v" style={{ color: alerts.length ? "#f43f5e" : "#22c55e" }}><CountUp value={alerts.length} /></div><div className="wr-l">تنبيهات</div></div>
          </div>

          {/* main: threat graph + alert ticker */}
          <div className="wr-main">
            <div className="wr-graph">
              <div className="wr-cap">خريطة التهديد الحيّة — الكيانات · السرديات · الحملات</div>
              {!!d.nodes?.length ? <BattlefieldGraph data={{ nodes: d.nodes, edges: d.edges }} onSelect={() => {}} />
                : <div className="muted" style={{ padding: 30, textAlign: "center" }}>لا بيانات شبكة بعد.</div>}
            </div>
            <div className="wr-side">
              <div className="wr-cap" style={{ color: "#f43f5e" }}>● بثّ التنبيهات</div>
              <div className="wr-alerts">
                {alerts.length ? alerts.slice(0, 12).map((a, i) => (
                  <div key={i} className="wr-alert">
                    <span>{sevIcon(a.severity)}</span>
                    <span style={{ flex: 1 }}>{a.message}</span>
                  </div>
                )) : <div className="muted" style={{ fontSize: 13, padding: 8 }}>لا تنبيهات نشطة — الوضع تحت السيطرة.</div>}
              </div>
            </div>
          </div>

          {/* bottom: narratives + most attacked */}
          <div className="wr-bottom">
            <div className="wr-panel">
              <div className="wr-cap">أقوى السرديات الآن</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {narrs.slice(0, 8).map((n: any, i: number) => (
                  <span key={i} className="wr-narr">{n.narrative}<b style={{ marginInlineStart: 6, color: "var(--accent)" }}>{n.posts || n.share || ""}</b></span>
                ))}
                {!narrs.length && <span className="muted">—</span>}
              </div>
            </div>
            <div className="wr-panel">
              <div className="wr-cap" style={{ color: "#f43f5e" }}>الأكثر تعرّضاً للهجوم</div>
              {attacked.slice(0, 5).map((e: any, i: number) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, padding: "5px 0", borderTop: i ? "1px solid var(--line)" : 0 }}>
                  <span>{e.name}</span><span style={{ color: riskColor(e.risk || 0), fontWeight: 800 }}>{e.risk}</span>
                </div>
              ))}
              {!attacked.length && <span className="muted">—</span>}
            </div>
          </div>

          <div className="muted" style={{ fontSize: 11, textAlign: "center", marginTop: 10 }}>
            تحديث حيّ كل ٤٥ ثانية · Sentinel Intelligence by Integrate Dynamics
          </div>
        </>
      )}
    </div>
  );
}
