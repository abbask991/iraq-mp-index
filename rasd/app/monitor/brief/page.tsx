"use client";
import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";
import Logo from "@/components/Logo";
import { SkelCards } from "@/components/Skeleton";

const riskColor = (v: number) => (v >= 70 ? "#f43f5e" : v >= 50 ? "#fb923c" : v >= 30 ? "#f59e0b" : "#22c55e");
const sevIcon = (s: string) => (s === "red" ? "🔴" : s === "orange" ? "🟠" : "🟡");
const traj = (t: string) => (t === "rising" || t === "escalating" ? "متصاعد ▲" : t === "declining" || t === "cooling" ? "متراجع ▼" : "مستقر ▬");

export default function DailyBrief() {
  const [d, setD] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<string>("");

  useEffect(() => { apiGet("/api/brief").then(setD).finally(() => setLoading(false)); }, []);

  const sendTg = async () => {
    setSending(true); setSent("");
    const r = await apiGet("/monitor/cron/brief").catch(() => null);
    setSending(false);
    setSent(r?.pushed ? "تم الإرسال إلى تيليغرام ✅" : r?.chat_configured === false ? "لم يُضبط ALERT_TELEGRAM_CHAT" : "تعذّر الإرسال");
  };

  const th = d?.threat || {}; const k = d?.kpis || {}; const s = k.sentiment || {};
  const today = new Date().toLocaleDateString("ar-IQ", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  return (
    <div className="brief-wrap">
      {/* toolbar (hidden in print) */}
      <div className="brief-bar no-print">
        <h2 style={{ margin: 0 }}>📊 التقرير الاستخباراتي اليومي</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn ghost" onClick={() => apiGet("/api/brief").then(setD)}>↻ تحديث</button>
          <button className="btn ghost" onClick={sendTg} disabled={sending}>{sending ? "…" : "✈️ إرسال تيليغرام"}</button>
          <button className="btn" onClick={() => window.print()}>⬇️ تحميل / طباعة PDF</button>
        </div>
      </div>
      {sent && <p className="muted no-print" style={{ fontSize: 13 }}>{sent}</p>}

      {loading && <SkelCards count={3} />}

      {d && !loading && (
        <div className="brief-doc">
          {/* letterhead */}
          <div className="brief-head">
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <Logo size={42} />
              <div>
                <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: 0.5 }}>Sentinel Intelligence</div>
                <div className="muted" style={{ fontSize: 12 }}>التقرير الاستخباراتي اليومي · {today}</div>
              </div>
            </div>
            <div className="brief-class">سرّي — للاستخدام الداخلي</div>
          </div>

          {/* threat banner */}
          <div className="brief-threat" style={{ ["--pc" as any]: th.color }}>
            <div><div className="muted" style={{ fontSize: 12 }}>حالة التأهّب الوطني</div>
              <div style={{ fontSize: 24, fontWeight: 900, color: th.color }}>{th.code} · {th.level}</div></div>
            <div style={{ fontSize: 38, fontWeight: 900, color: th.color }}>{th.risk}<span style={{ fontSize: 16, color: "var(--muted)" }}>/100</span></div>
          </div>

          {/* executive summary */}
          {d.executive && (
            <section className="brief-sec">
              <h3>① الموجز التنفيذي</h3>
              <p style={{ fontSize: 14.5, lineHeight: 2.1 }}>{d.executive}</p>
            </section>
          )}

          {/* KPIs */}
          <section className="brief-sec">
            <h3>② المؤشّرات الرئيسية</h3>
            <div className="brief-kpis">
              {[["الخطر الوطني", k.national_risk, riskColor(k.national_risk || 0)],
                ["سياسي", k.political, riskColor(k.political || 0)],
                ["أزمة", k.crisis, riskColor(k.crisis || 0)],
                ["حملات", k.campaign, riskColor(k.campaign || 0)],
                ["تنبيهات حرجة", k.critical, k.critical ? "#f43f5e" : "#22c55e"],
                ["كيانات مرصودة", k.entities, "#4f9dff"]].map(([l, v, c]: any) => (
                <div className="brief-kpi" key={l}><div style={{ fontSize: 26, fontWeight: 900, color: c }}>{v ?? 0}</div><div className="muted" style={{ fontSize: 11.5 }}>{l}</div></div>
              ))}
            </div>
            {(s.pos || s.neg || s.neu) ? (
              <div className="brief-sent">
                <span style={{ color: "#22c55e" }}>إيجابي {s.pos}</span>
                <span style={{ color: "#f43f5e" }}>سلبي {s.neg}</span>
                <span className="muted">محايد {s.neu}</span>
              </div>
            ) : null}
          </section>

          {/* top threats */}
          {d.top_threats?.length > 0 && (
            <section className="brief-sec">
              <h3>③ أبرز التهديدات</h3>
              <table className="brief-tbl">
                <thead><tr><th>الكيان</th><th>الخطر</th><th>تغيّر السمعة</th><th>المسار</th></tr></thead>
                <tbody>
                  {d.top_threats.map((e: any, i: number) => (
                    <tr key={i}>
                      <td>{e.name}</td>
                      <td><b style={{ color: riskColor(e.risk || 0) }}>{e.risk}</b></td>
                      <td style={{ color: (e.rep_delta || 0) < 0 ? "#f43f5e" : "#22c55e" }}>{(e.rep_delta || 0) > 0 ? "+" : ""}{e.rep_delta || 0}</td>
                      <td className="muted">{e.trajectory ? traj(e.trajectory) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {/* narratives + campaigns */}
          <div className="brief-2col">
            {d.narratives?.length > 0 && (
              <section className="brief-sec">
                <h3>④ السرديات الصاعدة</h3>
                {d.narratives.map((n: any, i: number) => (
                  <div key={i} className="brief-row">
                    <span className="brief-dot" style={{ background: (n.neg_ratio || 0) > 0.5 ? "#f43f5e" : "#22c55e" }} />
                    <span style={{ flex: 1 }}>{n.narrative}</span>
                    <b style={{ color: "var(--accent)" }}>{n.posts}</b>
                  </div>
                ))}
              </section>
            )}
            {d.campaigns?.length > 0 && (
              <section className="brief-sec">
                <h3>⑤ الحملات المنسّقة</h3>
                {d.campaigns.map((c: any, i: number) => (
                  <div key={i} className="brief-row">
                    <span style={{ flex: 1 }}>#{c.hashtag}</span>
                    <span className="chip" style={{ color: (c.coordination_score || 0) >= 60 ? "#f43f5e" : "#fb923c" }}>تنسيق {c.coordination_score}</span>
                  </div>
                ))}
              </section>
            )}
          </div>

          {/* alerts */}
          {d.alerts?.length > 0 && (
            <section className="brief-sec">
              <h3>⑥ التنبيهات النشطة</h3>
              {d.alerts.map((a: any, i: number) => (
                <div key={i} className="brief-row"><span>{sevIcon(a.severity)}</span><span style={{ flex: 1 }}>{a.message}</span></div>
              ))}
            </section>
          )}

          {/* recommendations */}
          {d.recommendations?.length > 0 && (
            <section className="brief-sec">
              <h3>⑦ التوصيات</h3>
              <ol className="brief-recs">
                {d.recommendations.map((r: string, i: number) => <li key={i}>{r}</li>)}
              </ol>
            </section>
          )}

          <div className="brief-foot muted">
            {d.disclaimer} · Sentinel Intelligence by Integrate Dynamics ·
            بيانات حتى: {d.data_generated_at ? new Date(d.data_generated_at * 1000).toLocaleString("ar-IQ") : "—"}
          </div>
        </div>
      )}
    </div>
  );
}
