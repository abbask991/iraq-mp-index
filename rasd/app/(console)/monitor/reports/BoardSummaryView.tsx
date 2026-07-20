"use client";
import { useEffect, useState } from "react";
import { apiGet, logEvent } from "@/lib/api";
import { useDemo } from "@/components/ui/DemoContext";
import { BrandTitle, BrandLogo } from "@/components/Brand";
import { PageHeader, Button, Icon } from "@/components/ui";
import { SkelCards } from "@/components/Skeleton";
import { buildMattersItems } from "@/components/WhatMattersNow";

/**
 * Board-Ready Summary — one concise page for a board / minister / executive.
 * Not a dashboard: the single headline, the three things that matter, the crisis
 * posture, and the actions — printable in a glance. Built from the real tenant
 * command-center picture (+ public anger); nothing invented.
 */
const riskColor = (v: number) => (v >= 70 ? "#f43f5e" : v >= 50 ? "#fb923c" : v >= 30 ? "#f59e0b" : "#22c55e");
const lvlColor = (l: string) => (/حرج/.test(l || "") ? "#dc2626" : /مرتفع/.test(l || "") ? "#f43f5e" : /متوسط/.test(l || "") ? "#f59e0b" : "#22c55e");

export default function BoardSummaryView() {
  const { demo } = useDemo();
  const [d, setD] = useState<any>(null);
  const [anger, setAnger] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const today = new Date().toLocaleDateString("ar-IQ", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  const load = () => {
    setLoading(true);
    apiGet("/api/command-center" + (demo ? "?demo=1" : "")).then(setD).finally(() => setLoading(false));
    const q = `scope_type=country&scope_id=${encodeURIComponent("العراق")}&scope_name=${encodeURIComponent("العراق")}&period=week${demo ? "&demo=1" : ""}`;
    apiGet(`/api/indices/public-anger?${q}`).then(setAnger).catch(() => setAnger(null));
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [demo]);

  const nr = d?.national_risk || {};
  const level = d?.executive?.risk_level;
  const peak = Math.max(nr.political || 0, nr.crisis || 0, nr.reputation || 0, nr.campaign || 0);
  const items = d ? buildMattersItems(d, anger, 3) : [];
  const actions = (d?.recommended_actions || []).slice(0, 4);

  return (
    <div className="brief-wrap">
      <div className="no-print">
        <PageHeader title="موجز المجلس" sub="صفحة واحدة موجزة لصانع القرار — العنوان، ما يهمّ، الموقف، والإجراءات."
          actions={d && !loading ? <Button variant="primary" onClick={() => { logEvent("report_generated", { kind: "board" }); window.print(); }}><Icon name="clip" size={14} /> PDF</Button> : null} />
      </div>

      {loading && <SkelCards count={3} />}

      {!loading && d && (
        <div className="brief-doc">
          <div className="brief-head">
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <BrandLogo size={42} />
              <div>
                <div style={{ fontSize: 20, fontWeight: 900 }}><BrandTitle /></div>
                <div className="muted" style={{ fontSize: 12 }}>موجز المجلس · {today}</div>
              </div>
            </div>
            <div className="brief-class">سرّي — لصانع القرار</div>
          </div>

          {/* headline */}
          <div className="brief-threat" style={{ ["--pc" as any]: riskColor(peak) }}>
            <div>
              <div className="muted" style={{ fontSize: 12 }}>الموقف الوطني</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: level ? lvlColor(level) : riskColor(peak) }}>{level || (peak >= 70 ? "حرج" : peak >= 50 ? "مرتفع" : peak >= 30 ? "متوسط" : "منخفض")}</div>
            </div>
            <div style={{ fontSize: 38, fontWeight: 900, color: riskColor(peak) }}>{peak}<span style={{ fontSize: 16, color: "var(--muted)" }}>/100</span></div>
          </div>

          {d.executive_brief && (
            <section className="brief-sec"><h3>العنوان</h3><p style={{ fontSize: 14.5, lineHeight: 2 }}>{d.executive_brief}</p></section>
          )}

          {items.length > 0 && (
            <section className="brief-sec">
              <h3>أهم ثلاثة تستحق القرار</h3>
              {items.map((it, i) => (
                <div key={i} className="brief-row" style={{ alignItems: "flex-start" }}>
                  <span className="brief-dot" style={{ background: riskColor(it.type === "anger" ? (anger?.score || 0) : 60), marginTop: 6 }} />
                  <div style={{ flex: 1 }}>
                    <b>{it.title}</b> {it.severity && <span className="muted" style={{ fontSize: 12 }}>· {it.severity}</span>}
                    {it.explanation && <div className="muted" style={{ fontSize: 12.5 }}>{it.explanation}</div>}
                    {it.action && <div style={{ fontSize: 12.5 }}>▸ {it.action}</div>}
                  </div>
                </div>
              ))}
            </section>
          )}

          <div className="brief-2col">
            <section className="brief-sec">
              <h3>الموقف والمؤشرات</h3>
              <div style={{ fontSize: 13, lineHeight: 2 }}>
                {nr.crisis != null && <div>مؤشر الأزمة: <b style={{ color: riskColor(nr.crisis) }}>{nr.crisis}</b></div>}
                {nr.political != null && <div>الخطر السياسي: <b style={{ color: riskColor(nr.political) }}>{nr.political}</b></div>}
                {anger?.score != null && <div>الغضب العام: <b style={{ color: riskColor(anger.score) }}>{anger.score}</b> ({anger.risk_level_ar})</div>}
                {(d.active_campaigns || []).length > 0 && <div>حملات منسّقة نشطة: <b>{d.active_campaigns.length}</b></div>}
              </div>
            </section>
            {actions.length > 0 && (
              <section className="brief-sec">
                <h3>إجراءات موصى بها</h3>
                <ol className="brief-recs">{actions.map((a: string, i: number) => <li key={i}>{a}</li>)}</ol>
              </section>
            )}
          </div>

          <div className="brief-foot muted">{d.disclaimer || "مؤشرات احتمالية — تتطلّب قراءة بشرية قبل القرار."} · <BrandTitle /> · {today}</div>
        </div>
      )}
    </div>
  );
}
