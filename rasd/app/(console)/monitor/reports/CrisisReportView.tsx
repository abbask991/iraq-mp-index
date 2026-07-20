"use client";
import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";
import { BrandLine, BrandTitle, BrandLogo } from "@/components/Brand";
import { PageHeader, Button, Icon } from "@/components/ui";
import { SkelCards } from "@/components/Skeleton";

/**
 * Crisis Situation Report — a printable national crisis sitrep built from the
 * live battlefield picture (/api/battlefield/national, the same owner-scoped
 * feed the war room reads) plus the alert stream. It reframes the war-room data
 * as a document: alert posture, entities under attack, escalating narratives,
 * coordinated campaigns, spreading threats, and the AI situation assessment —
 * the crisis-relevant slice, laid out for print rather than a live wall.
 */
const riskColor = (v: number) => (v >= 70 ? "#f43f5e" : v >= 50 ? "#fb923c" : v >= 30 ? "#f59e0b" : "#22c55e");
const sevColor = (s: string) => (s === "red" ? "#f43f5e" : s === "orange" ? "#fb923c" : "#eab308");
const TRAJ = (t: string) => (t === "rising" || t === "escalating" ? "متصاعد ▲" : t === "declining" || t === "cooling" ? "متراجع ▼" : "مستقر ▬");

// National alert posture — same DEFCON scale the war room keys off.
function posture(risk: number) {
  if (risk >= 70) return { label: "حالة حرجة", code: "ALERT 1", color: "#f43f5e" };
  if (risk >= 50) return { label: "تحذير مرتفع", code: "ALERT 2", color: "#fb923c" };
  if (risk >= 30) return { label: "مراقبة", code: "ALERT 3", color: "#f59e0b" };
  return { label: "هادئ — تحت السيطرة", code: "ALERT 4", color: "#22c55e" };
}

export default function CrisisReportView() {
  const [d, setD] = useState<any>(null);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const today = new Date().toLocaleDateString("ar-IQ", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  const load = () => {
    setLoading(true);
    Promise.all([
      apiGet("/api/battlefield/national").catch(() => null),
      apiGet("/monitor/alerts-feed").catch(() => null),
    ]).then(([nat, af]) => {
      setD(nat);
      setAlerts((af?.alerts || []).filter((a: any) => a.severity === "red" || a.severity === "orange"));
    }).finally(() => setLoading(false));
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const sc = d?.scores || {};
  const risk = sc.national_risk || 0;
  const pos = posture(risk);
  const narrs = (d?.top_narratives || []);
  const camps = (d?.top_campaigns || []);
  const attacked = (d?.most_attacked || []);
  const momentum = (d?.momentum || []);

  return (
    <div className="brief-wrap">
      <div className="no-print">
        <PageHeader
          title="تقرير الأزمات — الوضع الوطني"
          sub="تقرير موقف قابل للطباعة عن حالة التأهّب والتهديدات المتصاعدة الآن."
          actions={
            <>
              <Button onClick={load} disabled={loading}><Icon name="refresh" size={14} /> تحديث</Button>
              {d && !loading && <Button variant="primary" onClick={() => window.print()}><Icon name="clip" size={14} /> PDF</Button>}
            </>
          }
        />
      </div>

      {loading && <SkelCards count={4} />}

      {!loading && d && (
        <div className="brief-doc">
          <div className="brief-head">
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <BrandLogo size={42} />
              <div>
                <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: 0.5 }}><BrandTitle /></div>
                <div className="muted" style={{ fontSize: 12 }}>تقرير موقف الأزمة الوطني · {today}</div>
              </div>
            </div>
            <div className="brief-class">سرّي — للاستخدام الداخلي</div>
          </div>

          {/* alert posture banner */}
          <div className="brief-threat" style={{ ["--pc" as any]: pos.color }}>
            <div>
              <div className="muted" style={{ fontSize: 12 }}>حالة التأهّب الوطني</div>
              <div style={{ fontSize: 24, fontWeight: 900, color: pos.color }}>{pos.code} · {pos.label}</div>
            </div>
            <div style={{ fontSize: 38, fontWeight: 900, color: pos.color }}>{risk}<span style={{ fontSize: 16, color: "var(--muted)" }}>/100</span></div>
          </div>

          {/* crisis KPIs */}
          <section className="brief-sec">
            <h3>① مؤشّرات الأزمة</h3>
            <div className="brief-kpis">
              {[["مؤشر الأزمة", sc.crisis], ["الخطر السياسي", sc.political], ["حملات منسّقة", sc.campaign],
                ["خطر السمعة", sc.reputation], ["تنبيهات حرجة", alerts.filter((a) => a.severity === "red").length],
                ["كيانات تحت الهجوم", attacked.length]].map(([l, v]: any) => (
                <div className="brief-kpi" key={l}>
                  <div style={{ fontSize: 24, fontWeight: 900, color: typeof v === "number" ? riskColor(v) : undefined }}>{v ?? 0}</div>
                  <div className="muted" style={{ fontSize: 11.5 }}>{l}</div>
                </div>
              ))}
            </div>
          </section>

          {/* AI situation assessment */}
          {d.summary && (
            <section className="brief-sec">
              <h3>② تقييم الموقف</h3>
              <p style={{ fontSize: 14.5, lineHeight: 2 }}>{d.summary}</p>
            </section>
          )}

          {/* critical alerts */}
          {alerts.length > 0 && (
            <section className="brief-sec">
              <h3>③ التنبيهات النشطة</h3>
              {alerts.slice(0, 12).map((a: any, i: number) => (
                <div key={i} className="brief-row">
                  <span className="brief-dot" style={{ background: sevColor(a.severity), marginTop: 7 }} />
                  <span style={{ flex: 1 }}>{a.message}</span>
                </div>
              ))}
            </section>
          )}

          {/* entities under attack */}
          {attacked.length > 0 && (
            <section className="brief-sec">
              <h3>④ الكيانات الأكثر تعرّضاً للهجوم</h3>
              <table className="brief-tbl">
                <thead><tr><th>الكيان</th><th>مستوى الخطر</th></tr></thead>
                <tbody>
                  {attacked.slice(0, 8).map((e: any, i: number) => (
                    <tr key={i}><td>{e.name}</td><td><b style={{ color: riskColor(e.risk || 0) }}>{e.risk}</b></td></tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          <div className="brief-2col">
            {/* escalating narratives */}
            {narrs.length > 0 && (
              <section className="brief-sec">
                <h3>⑤ السرديات المتصاعدة</h3>
                {narrs.slice(0, 7).map((n: any, i: number) => (
                  <div key={i} className="brief-row">
                    <span className="brief-dot" style={{ background: (n.neg_ratio || 0) > 0.5 ? "#f43f5e" : "#22c55e", marginTop: 6 }} />
                    <span style={{ flex: 1 }}>{n.narrative}</span>
                    <b style={{ color: "var(--accent)" }}>{n.posts || 0}</b>
                  </div>
                ))}
              </section>
            )}
            {/* coordinated campaigns */}
            {camps.length > 0 && (
              <section className="brief-sec">
                <h3>⑥ الحملات المنسّقة</h3>
                {camps.slice(0, 7).map((c: any, i: number) => (
                  <div key={i} className="brief-row">
                    <span style={{ flex: 1 }}>#{c.hashtag || "—"}</span>
                    <span className="chip" style={{ color: (c.coordination_score || 0) >= 60 ? "#f43f5e" : "#fb923c" }}>تنسيق {c.coordination_score || 0}</span>
                  </div>
                ))}
              </section>
            )}
          </div>

          {/* spreading threats */}
          {momentum.length > 0 && (
            <section className="brief-sec">
              <h3>⑦ التهديدات الأسرع انتشاراً</h3>
              <table className="brief-tbl">
                <thead><tr><th>الموضوع</th><th>السرعة</th><th>المسار</th></tr></thead>
                <tbody>
                  {momentum.slice(0, 6).map((mo: any, i: number) => (
                    <tr key={i}>
                      <td>{mo.name}</td>
                      <td><b style={{ color: riskColor(mo.velocity || 0) }}>{mo.velocity || 0}</b></td>
                      <td className="muted">{TRAJ(mo.trajectory)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {/* recommended response */}
          {(d.recommended_actions || []).length > 0 && (
            <section className="brief-sec">
              <h3>⑧ إجراءات الاستجابة الموصى بها</h3>
              <ol className="brief-recs">{d.recommended_actions.map((a: string, i: number) => <li key={i}>{a}</li>)}</ol>
            </section>
          )}

          <div className="brief-foot muted">
            تقرير آلي — المؤشرات احتمالية وتتطلّب مراجعة بشرية قبل أي قرار · <BrandLine /> ·
            بيانات حتى: {d.generated_at ? new Date(d.generated_at).toLocaleString("ar-IQ") : "—"}
          </div>
        </div>
      )}

      {!loading && !d && (
        <div className="cbox">تعذّر تحميل بيانات الأزمة. <button className="btn ghost" onClick={load}>إعادة المحاولة</button></div>
      )}
    </div>
  );
}
