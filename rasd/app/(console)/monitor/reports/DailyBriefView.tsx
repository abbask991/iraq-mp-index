"use client";
import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";
import { BrandLine, BrandTitle, BrandLogo } from "@/components/Brand";
import { PageHeader, Button, Icon, DemoBanner } from "@/components/ui";
import { SkelCards } from "@/components/Skeleton";
import { useDemo } from "@/components/ui/DemoContext";

const riskColor = (v: number) => (v >= 70 ? "#f43f5e" : v >= 50 ? "#fb923c" : v >= 30 ? "#f59e0b" : "#22c55e");
/** Severity → colour for a drawn dot (was 🔴/🟠/🟡). */
const sevColor = (s: string) => (s === "red" ? "#f43f5e" : s === "orange" ? "#fb923c" : "#eab308");
const traj = (t: string) => (t === "rising" || t === "escalating" ? "متصاعد ▲" : t === "declining" || t === "cooling" ? "متراجع ▼" : "مستقر ▬");

const lvlColor = (l: string) => (/حرج/.test(l || "") ? "#dc2626" : /مرتفع/.test(l || "") ? "#f43f5e" : /متوسط/.test(l || "") ? "#f59e0b" : "#22c55e");

function ExecBrief({ demo }: { demo: boolean }) {
  const [d, setD] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { setLoading(true); apiGet("/api/brief/executive" + (demo ? "?demo=1" : "")).then(setD).finally(() => setLoading(false)); }, [demo]);
  if (loading) return <SkelCards count={4} />;
  const s = d?.sections || {};
  const Block = ({ n, title, children }: any) => <section className="brief-sec"><h3>{n} {title}</h3>{children}</section>;
  return (
    <div className="brief-doc">
      {d?.urgent && <div className="cbox" style={{ borderInlineStart: "4px solid #f43f5e", marginBottom: 12 }}><b>الأولوية الآن:</b> {d.urgent}</div>}

      <Block n="①" title="الموجز التنفيذي"><p style={{ fontSize: 14.5, lineHeight: 2 }}>{s["1_executive_summary"]}</p></Block>

      <Block n="②" title="أعلى 5 مخاطر">
        {(s["2_top_risks"] || []).map((r: any, i: number) => (
          <div key={i} className="brief-row" style={{ alignItems: "flex-start" }}>
            <span className="brief-dot" style={{ background: lvlColor(r.level), marginTop: 6 }} />
            <div style={{ flex: 1 }}><b>{r.entity}</b> <span className="chip" style={{ fontSize: 10.5, color: lvlColor(r.level) }}>{r.level} · {r.risk}</span>
              <div className="muted" style={{ fontSize: 12 }}>{r.reason} · {r.evidence_count} · ثقة عالية</div>
              <div style={{ fontSize: 12.5 }}>▸ {r.recommended_action}</div></div>
          </div>
        ))}
      </Block>

      <Block n="③" title="أعلى 5 فرص">
        {(s["3_top_opportunities"] || []).map((o: any, i: number) => (
          <div key={i} className="brief-row"><span className="brief-dot" style={{ background: "#22c55e" }} />
            <span style={{ flex: 1 }}>{o.title} <span className="muted">— {o.detail}</span><div style={{ fontSize: 12 }}>▸ {o.recommendation} <span className="muted">(ثقة {o.confidence})</span></div></span></div>
        ))}
      </Block>

      <Block n="④" title="ما الذي تغيّر منذ الأمس">
        {(s["4_what_changed"] || []).map((c: any, i: number) => (
          <div key={i} className="brief-row"><span className="brief-dot" style={{ background: lvlColor(c.risk_level), marginTop: 7 }} /><span style={{ flex: 1 }}>{c.label ? <span className="muted">{c.label} · </span> : null}<b>{c.entity}</b> — {c.change} <span className="muted">({c.reason})</span></span></div>
        ))}
      </Block>

      <div className="brief-2col">
        <Block n="⑤" title="الحملات النشطة">
          {(s["5_active_campaigns"] || []).map((c: any, i: number) => <div key={i} className="brief-row"><span style={{ flex: 1 }}>#{c.hashtag}</span><span className="chip" style={{ color: lvlColor(c.level) }}>تنسيق {c.coordination}</span></div>)}
          {!(s["5_active_campaigns"] || []).length && <p className="muted" style={{ fontSize: 12 }}>لا حملات.</p>}
        </Block>
        <Block n="⑥" title="أبرز السرديات">
          {(s["6_top_narratives"] || []).map((t: any, i: number) => <div key={i} className="brief-row"><span style={{ flex: 1 }}>{t.topic}</span><span className="chip" style={{ color: lvlColor(t.risk) }}>سرعة {t.velocity}</span></div>)}
        </Block>
      </div>

      <div className="brief-2col">
        <Block n="⑦" title="إشارات جمهور فيسبوك">
          <div style={{ fontSize: 12.5, lineHeight: 1.9 }}>
            {s["7_facebook_signals"]?.approval != null && <div>التأييد: <b>{s["7_facebook_signals"].approval}%</b></div>}
            {s["7_facebook_signals"]?.reaction_comment_gap != null && <div>فجوة التفاعل/التعليق: <b style={{ color: "#f43f5e" }}>{s["7_facebook_signals"].reaction_comment_gap}</b> ({s["7_facebook_signals"].gap_level})</div>}
            {s["7_facebook_signals"]?.dominant_mood && <div>المزاج الغالب: <b>{s["7_facebook_signals"].dominant_mood}</b></div>}
            {s["7_facebook_signals"]?.note && <div className="muted">{s["7_facebook_signals"].note}</div>}
          </div>
        </Block>
        <Block n="⑧" title="إشارات الرأي العام">
          <div style={{ fontSize: 12.5, lineHeight: 1.9 }}>
            {["political", "reputation", "crisis"].map((k) => s["8_public_opinion"]?.[k] != null && <span key={k} className="chip" style={{ marginInlineEnd: 6 }}>{k}: {s["8_public_opinion"][k]}</span>)}
            {s["8_public_opinion"]?.reading && <div className="muted" style={{ marginTop: 4 }}>{s["8_public_opinion"].reading}</div>}
          </div>
        </Block>
      </div>

      <Block n="⑨" title="إجراءات موصى بها">
        <ol className="brief-recs">{(s["9_recommended_actions"] || []).map((a: string, i: number) => <li key={i}>{a}</li>)}</ol>
      </Block>

      <Block n="⑩" title="قائمة مراقبة الـ24 ساعة القادمة">
        {(s["10_watchlist"] || []).map((w: any, i: number) => (
          <div key={i} className="brief-row"><span className="brief-dot" style={{ background: "#f59e0b" }} />
            <span style={{ flex: 1 }}>{w.item} <span className="muted">— {w.why}</span><div style={{ fontSize: 12 }}>▸ {w.recommendation}</div></span></div>
        ))}
      </Block>

      <div className="brief-foot muted">{d?.disclaimer} · <BrandLine /></div>
    </div>
  );
}

export default function DailyBriefView() {
  const [d, setD] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<string>("");
  const [mode, setMode] = useState<"exec" | "classic">("exec");
  const { demo, setDemo } = useDemo();

  useEffect(() => { apiGet("/api/brief").then(setD).finally(() => setLoading(false)); }, []);

  const sendTg = async () => {
    setSending(true); setSent("");
    const r = await apiGet("/monitor/cron/brief").catch(() => null);
    setSending(false);
    setSent(r?.pushed ? "تم الإرسال إلى تيليغرام " : r?.chat_configured === false ? "لم يُضبط ALERT_TELEGRAM_CHAT" : "تعذّر الإرسال");
  };

  const th = d?.threat || {}; const k = d?.kpis || {}; const s = k.sentiment || {};
  const today = new Date().toLocaleDateString("ar-IQ", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  return (
    <div className="brief-wrap">
      {/* toolbar (hidden in print) */}
      <div className="no-print">
        <PageHeader
          title="التقرير الاستخباراتي اليومي"
          sub="مستند يُقرأ ويُرسل — موجز الصباح جاهز للطباعة أو الإرسال."
          actions={
            <>
              <Button aria-pressed={mode === "exec"} onClick={() => setMode("exec")}>الموجز التنفيذي</Button>
              <Button aria-pressed={mode === "classic"} onClick={() => setMode("classic")}>التقرير الكامل</Button>
              <Button onClick={sendTg} disabled={sending}>
                <Icon name="megaphone" size={14} /> {sending ? "…" : "تيليغرام"}
              </Button>
              <Button variant="primary" onClick={() => window.print()}>
                <Icon name="clip" size={14} /> PDF
              </Button>
            </>
          }
        />
      </div>
      {sent && <p className="muted no-print" style={{ fontSize: 13 }}>{sent}</p>}

      {mode === "exec" && <ExecBrief demo={demo} />}

      {mode === "classic" && loading && <SkelCards count={3} />}

      {mode === "classic" && d && !loading && (
        <div className="brief-doc">
          {/* letterhead */}
          <div className="brief-head">
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <BrandLogo size={42} />
              <div>
                <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: 0.5 }}><BrandTitle /></div>
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
                <div key={i} className="brief-row"><span className="brief-dot" style={{ background: sevColor(a.severity), marginTop: 7 }} /><span style={{ flex: 1 }}>{a.message}</span></div>
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
            {d.disclaimer} · <BrandLine /> ·
            بيانات حتى: {d.data_generated_at ? new Date(d.data_generated_at * 1000).toLocaleString("ar-IQ") : "—"}
          </div>
        </div>
      )}
    </div>
  );
}
