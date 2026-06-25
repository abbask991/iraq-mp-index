"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { apiPost, apiGet, intelGet, intelPost } from "@/lib/api";
import RangeSelect, { Range } from "@/components/RangeSelect";
import { getCoverage } from "@/lib/targets";
import { SkelCards } from "@/components/Skeleton";
import IraqMap from "@/components/IraqMap";
import EmptyState from "@/components/EmptyState";
import Gauge from "@/components/Gauge";

const C = { neg: "#f43f5e", neu: "#8a97ad", pos: "#22c55e", warn: "#f59e0b" };
const sColor = (s: string) => (s === "سلبي" ? C.neg : s === "إيجابي" ? C.pos : C.neu);
const LV: Record<string, string> = { highly: "#f43f5e", strong: "#fb923c", possible: "#f59e0b", weak: "#84cc16", organic: "#22c55e" };
const SEV: Record<string, { c: string; t: string }> = {
  red: { c: "#f43f5e", t: "🔴" }, orange: { c: "#fb923c", t: "🟠" }, yellow: { c: "#f59e0b", t: "🟡" },
  watch: { c: "#4f9dff", t: "🔵" }, info: { c: "#8a97ad", t: "⚪" },
  high: { c: "#f43f5e", t: "🔴" }, medium: { c: "#fb923c", t: "🟠" }, low: { c: "#84cc16", t: "🟢" },
};
const riskLabel: Record<string, string> = { سياسي: "سياسي" };
const PLAT_AR: Record<string, string> = { x: "X", news: "أخبار", telegram: "تيليغرام", reddit: "Reddit" };
const RISK_LV = (v: number) => (v >= 70 ? { c: "#f43f5e", t: "حرج" } : v >= 50 ? { c: "#fb923c", t: "مرتفع" } : v >= 30 ? { c: "#f59e0b", t: "متوسط" } : { c: "#22c55e", t: "منخفض" });

export default function Overview() {
  const router = useRouter();
  const [d, setD] = useState<any>(null);
  const [dg, setDg] = useState<any>(null);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<Range>("day");
  const [at, setAt] = useState("");
  const [q, setQ] = useState("");
  const [aq, setAq] = useState(""); const [ans, setAns] = useState<any>(null);

  const load = useCallback(async (rng: Range) => {
    setLoading(true);
    const r = await apiPost("overview", { range: rng, limit: getCoverage() }).catch(() => null);
    setD(r); setAt(new Date().toLocaleTimeString("ar-IQ", { hour: "2-digit", minute: "2-digit" })); setLoading(false);
  }, []);
  useEffect(() => { load("day"); }, [load]);
  useEffect(() => {
    intelGet("/digest").then(setDg).catch(() => {});
    apiGet("/monitor/status").then(setStatus).catch(() => {});
    supabase.from("alerts").select("type,severity,message,created_at").order("created_at", { ascending: false }).limit(8)
      .then(({ data }) => setAlerts(data || []));
  }, []);

  const search = () => { if (q.trim()) router.push(`/monitor/intelligence?q=${encodeURIComponent(q.trim())}`); };
  const ask = async () => {
    if (!aq.trim()) return;
    setAns({ loading: true });
    const r = await intelPost("/ask", { question: aq }).catch(() => null);
    setAns(r);
  };

  const s = d?.sentiment || { pos: 0, neg: 0, neu: 0 };
  const ex = dg?.executive || {};
  const rs = dg?.risk_summary || {};
  const maxIssue = Math.max(1, ...(d?.issues || []).map((i: any) => i.count));
  const exRisk = { منخفض: "#22c55e", متوسط: "#f59e0b", مرتفع: "#fb923c", حرج: "#f43f5e" }[ex.risk_level as string] || "#8a97ad";

  return (
    <div>
      {/* hero + quick search */}
      <div className="cc-hero">
        <div>
          <div className="cc-live"><span className="cc-dot" /> {loading ? "جارٍ التحديث…" : `غرفة العمليات · مباشر · ${at}`}</div>
          <h2 style={{ margin: "6px 0 8px" }}>مركز القيادة</h2>
          <div style={{ display: "flex", gap: 8 }}>
            <input placeholder="🔍 ابحث عن شخص / جهة (مثال: السوداني)…" value={q}
              onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && search()} style={{ minWidth: 240 }} />
            <button className="btn" onClick={search}>بحث</button>
          </div>
        </div>
        <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
          {d && !d.error && <Gauge value={d.media_index ?? 50} label="المؤشر الإعلامي" size={92} />}
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <RangeSelect value={range} onChange={(v) => { setRange(v); load(v); }} disabled={loading} />
            <button className="btn ghost" onClick={() => load(range)} disabled={loading}>تحديث</button>
          </div>
        </div>
      </div>

      {/* live metrics */}
      <div className="cc-kpis" style={{ gridTemplateColumns: "repeat(6,1fr)" }}>
        {[["منشور اليوم", d?.scanned], ["حسابات", d?.accounts], ["حملات", d?.campaigns?.length],
          ["تنبيهات", alerts.length], ["ترندات", d?.trending?.length], ["كيانات مرصودة", dg?.count]].map(([l, v]: any) => (
          <div className="cc-kpi" key={l}><div className="v">{v != null ? Number(v).toLocaleString() : "—"}</div><div className="l">{l}</div></div>
        ))}
      </div>

      {/* Executive AI brief */}
      {ex.brief && (
        <div className="cbox" style={{ margin: "16px 0", borderInlineStart: `4px solid ${exRisk}` }}>
          <h4>🧠 الموجز التنفيذي (ذكاء اصطناعي)</h4>
          <p style={{ fontSize: 14.5, lineHeight: 2 }}>{ex.brief}</p>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 8, fontSize: 13 }}>
            <span className="chip" style={{ color: exRisk, borderColor: exRisk + "66" }}>مستوى الخطر: {ex.risk_level}</span>
            {ex.top_event && <span><b className="muted">أهم حدث:</b> {ex.top_event}</span>}
            {ex.recommendation && <span><b className="muted">التوصية:</b> {ex.recommendation}</span>}
          </div>
        </div>
      )}

      {loading && !d && <SkelCards count={4} />}
      {d && d.error && <EmptyState tone="error" title="تعذّر تحميل لوحة القيادة" subtitle={d.message} action={{ label: "إعادة المحاولة", onClick: () => load(range) }} />}

      {d && !d.error && (
        <>
          {/* alerts | risk summary */}
          <div className="cc-grid">
            <div className="cbox">
              <h4>🚨 التنبيهات النشطة</h4>
              {alerts.length === 0 && <span className="muted">لا تنبيهات حالياً.</span>}
              {alerts.map((a, i) => {
                const sv = SEV[a.severity] || SEV.info;
                return (
                  <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "8px 0", borderTop: i ? "1px solid var(--line)" : 0 }}>
                    <span>{sv.t}</span>
                    <div style={{ flex: 1, fontSize: 13 }}>{a.message}
                      <div className="muted" style={{ fontSize: 11 }}>{a.type} · {new Date(a.created_at).toLocaleString("ar-IQ", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })}</div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="cbox">
              <h4>⚠️ ملخّص المخاطر</h4>
              {!dg?.risk_summary ? <span className="muted">يُحتسب من أهدافك المرصودة…</span> : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, textAlign: "center" }}>
                  {[["سياسي", rs.political], ["سمعة", rs.reputation], ["أزمة", rs.crisis], ["حملات", rs.campaign]].map(([l, v]: any) => {
                    const lv = RISK_LV(v || 0);
                    return (
                      <div key={l}>
                        <Gauge value={v || 0} size={74} invert color={lv.c} />
                        <div style={{ fontSize: 12, marginTop: 2 }}>{l}</div>
                        <div className="muted" style={{ fontSize: 10 }}>{lv.t}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* trending | emerging campaigns */}
          <div className="cc-grid">
            <div className="cbox">
              <h4>📈 المواضيع الصاعدة</h4>
              {(d.trending || []).length === 0 && <span className="muted">لا ترندات بارزة.</span>}
              {(d.trending || []).map((h: any) => (
                <Link key={h.hashtag} href={`/monitor/trends?q=${encodeURIComponent(h.hashtag)}`} className="cc-trend">
                  <span className="t">#{h.hashtag}</span>
                  <span className="muted" style={{ fontSize: 11, marginInlineStart: "auto" }}>{h.mentions} ذِكر · <span style={{ color: sColor(h.sentiment) }}>{h.sentiment}</span></span>
                </Link>
              ))}
            </div>
            <div className="cbox">
              <h4>🎯 حملات ناشئة مشتبهة</h4>
              {(d.campaigns || []).length === 0 && <span className="muted">لا حملات مشتبهة حالياً.</span>}
              {(d.campaigns || []).map((c: any) => (
                <Link key={c.hashtag} href={`/monitor/campaign?q=${encodeURIComponent(c.hashtag)}`} className="cc-trend">
                  <span className="t">#{c.hashtag}</span>
                  <span className="muted" style={{ fontSize: 11 }}>{c.total_posts} منشور</span>
                  <span className="chip" style={{ color: LV[c.alert_level?.level] || "#84cc16", marginInlineStart: "auto", fontWeight: 800 }}>{c.coordination_score}</span>
                </Link>
              ))}
            </div>
          </div>

          {/* reputation changes | platform activity */}
          <div className="cc-grid">
            <div className="cbox">
              <h4>📉 تغيّرات السمعة اليوم</h4>
              {!(dg?.movers || []).length && <span className="muted">مستقرة / تُحتسب…</span>}
              {(dg?.movers || []).slice(0, 6).map((e: any) => (
                <div key={e.id} onClick={() => router.push(`/monitor/intelligence?q=${encodeURIComponent(e.name)}`)}
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", borderTop: "1px solid var(--line)", cursor: "pointer", fontSize: 13 }}>
                  <span>{e.name}</span>
                  <span style={{ display: "flex", gap: 10 }}>
                    <span style={{ color: (e.rep_delta || 0) >= 0 ? C.pos : C.neg }}>{(e.rep_delta || 0) >= 0 ? "▲" : "▼"} سمعة {e.rep_delta > 0 ? "+" : ""}{e.rep_delta}</span>
                    <span style={{ color: (e.risk_delta || 0) <= 0 ? C.pos : C.neg }}>خطر {e.risk_delta > 0 ? "+" : ""}{e.risk_delta}</span>
                  </span>
                </div>
              ))}
            </div>
            <div className="cbox">
              <h4>🥧 نشاط المنصّات</h4>
              {!(dg?.platform_activity || []).length && <span className="muted">يُحتسب من الأرشيف…</span>}
              {(dg?.platform_activity || []).map((p: any) => (
                <div className="srcrow" key={p.platform} style={{ marginBottom: 6 }}>
                  <div style={{ width: 80, fontSize: 13 }}>{PLAT_AR[p.platform] || p.platform}</div>
                  <div className="bar"><i style={{ width: `${p.pct}%` }} /></div>
                  <div className="num">{p.pct}%</div>
                </div>
              ))}
            </div>
          </div>

          {/* geo heatmap */}
          {d.geo?.located > 0 && (
            <div className="cbox" style={{ marginBottom: 16 }}>
              <h4>🗺️ التوزيع الجغرافي عبر المحافظات</h4>
              <IraqMap geo={d.geo} />
            </div>
          )}

          {/* AI assistant */}
          <div className="cbox" style={{ marginBottom: 16 }}>
            <h4>🤖 المساعد الذكي</h4>
            <p className="muted" style={{ fontSize: 12 }}>اسأل عن المشهد — يجيب من بيانات المنصّة. مثال: «ليش الكهرباء صارت ترند؟»</p>
            <div style={{ display: "flex", gap: 8, margin: "8px 0" }}>
              <input placeholder="اكتب سؤالك…" value={aq} onChange={(e) => setAq(e.target.value)} onKeyDown={(e) => e.key === "Enter" && ask()} />
              <button className="btn" onClick={ask}>اسأل</button>
            </div>
            {ans?.loading && <span className="spinner" />}
            {ans && !ans.loading && <p style={{ fontSize: 13.5, lineHeight: 1.9 }}>{ans.answer}</p>}
          </div>

          {/* system status */}
          {status && (
            <div className="cbox" style={{ marginBottom: 16 }}>
              <h4>🟢 حالة النظام</h4>
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                {[["X", status.x], ["الأخبار/RSS", status.rss], ["تيليغرام", status.telegram], ["الذكاء الاصطناعي", status.ai],
                  ["الكاش (Redis)", status.redis], ["قاعدة البيانات", status.database], ["قائمة المهام", status.queue]].map(([l, ok]: any) => (
                  <span key={l} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                    <span style={{ width: 9, height: 9, borderRadius: "50%", background: ok ? "#22c55e" : "#f43f5e", boxShadow: ok ? "0 0 8px #22c55e" : "none" }} />{l}
                  </span>
                ))}
              </div>
            </div>
          )}

          <p className="muted" style={{ fontSize: 11, marginTop: 4 }}>
            مسح حيّ لـ{d.scanned} منشور / {d.accounts} حساب. الموجز والمخاطر محدّثان كل ٣ ساعات. تحليل آلي يحتاج مراجعة بشرية.
          </p>
        </>
      )}
    </div>
  );
}
