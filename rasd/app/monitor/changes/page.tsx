"use client";
import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";
import { SkelCards } from "@/components/Skeleton";
import EmptyState from "@/components/EmptyState";
import EvidenceExplorer from "@/components/EvidenceExplorer";

const fmt = (n: number) => (n || 0).toLocaleString("en-US");
const lvlColor = (l: string) => (/حرج/.test(l || "") ? "#dc2626" : /مرتفع/.test(l || "") ? "#f43f5e" : /متوسط/.test(l || "") ? "#f59e0b" : "#22c55e");
const PERIODS = [["last_24h", "24 ساعة"], ["last_7d", "7 أيام"], ["custom", "مخصّص"]];

export default function WhatChanged() {
  const [d, setD] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [demo, setDemo] = useState(false);
  const [period, setPeriod] = useState("last_24h");
  const load = () => { setLoading(true); apiGet(`/api/what-changed?period=${period}${demo ? "&demo=1" : ""}`).then(setD).finally(() => setLoading(false)); };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [demo, period]);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <h2 style={{ margin: 0 }}>🔄 ما الذي تغيّر؟</h2>
        <button className={`btn ${demo ? "" : "ghost"}`} onClick={() => setDemo(!demo)} style={demo ? { background: "#6366f1" } : {}}>🧪 وضع العرض {demo ? "(مفعّل)" : ""}</button>
      </div>
      <p className="muted">ما الجديد منذ الفترة السابقة — حملات، تراجع سمعة، تحوّل مشاعر، منشورات فايرل، تصاعد غضب.</p>
      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
        {PERIODS.map(([k, l]) => <button key={k} className={`btn ${period === k ? "" : "ghost"}`} style={{ fontSize: 12 }} onClick={() => setPeriod(k)}>{l}</button>)}
      </div>

      {loading && <SkelCards count={4} />}
      {!loading && d && !d.count && <EmptyState title="لا تغيّرات ملحوظة" subtitle={d?.note} action={{ label: "وضع العرض", onClick: () => setDemo(true) }} />}

      {!loading && d && d.count > 0 && (
        <>
          {demo && <p className="muted" style={{ fontSize: 11.5, color: "#6366f1" }}>🧪 {d.note}</p>}
          <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>{d.period_label} · {d.count} تغيّر</div>
          {d.history_note && <p className="muted" style={{ fontSize: 11, marginBottom: 8 }}>ℹ️ {d.history_note}</p>}
          {d.changes.map((c: any, i: number) => (
            <div key={i} className="cbox" style={{ marginBottom: 10, borderInlineStart: `4px solid ${lvlColor(c.risk_level)}`, display: "flex", gap: 12, alignItems: "flex-start" }}>
              <span style={{ fontSize: 24 }}>{c.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                  <div style={{ fontSize: 14 }}><b>{c.entity}</b> <span className="chip" style={{ fontSize: 10.5 }}>{c.label}</span> <span className="chip" style={{ fontSize: 10.5, color: lvlColor(c.risk_level) }}>{c.change}</span></div>
                  <span className="chip" style={{ fontSize: 10.5, color: lvlColor(c.risk_level) }}>خطر {c.risk_level}</span>
                </div>
                <div style={{ fontSize: 12.5, marginTop: 4, lineHeight: 1.7 }}>{c.reason}</div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 5 }}>
                  <span className="muted" style={{ fontSize: 11 }}>📎 {fmt(c.evidence_count)} دليل{c.first_seen ? ` · أول ظهور ${String(c.first_seen).slice(0, 16).replace("T", " ")}` : ""}</span>
                  <EvidenceExplorer subject={c.entity} type={c.type} demo={demo} />
                </div>
              </div>
            </div>
          ))}
          <p className="muted" style={{ fontSize: 11 }}>{d.disclaimer}</p>
        </>
      )}
    </div>
  );
}
