"use client";
import { useEffect, useState } from "react";
import { apiPost } from "@/lib/api";
import { getTargets, primaryKeyword } from "@/lib/targets";
import { useDemo } from "@/components/ui/DemoContext";
import RangeSelect, { Range } from "@/components/RangeSelect";
import Logo from "@/components/Logo";
import { PageHeader, Button, Icon } from "@/components/ui";

/**
 * Campaign Report — a printable deliverable over the coordinated-campaign
 * detector (POST /monitor/campaign, the same 9-signal engine the Campaigns
 * module renders interactively). Reports frames it as a document: letterhead,
 * a coordination-score banner, the nine signals as a table, and the amplifier
 * evidence — laid out for print/PDF rather than exploration.
 */
const LV: Record<string, string> = {
  highly: "#f43f5e", strong: "#fb923c", possible: "#f59e0b", weak: "#84cc16", organic: "#22c55e",
};
const SIG_LABEL: Record<string, string> = {
  text_similarity: "التشابه النصّي", timing_sync: "تزامن التوقيت", account_suspicion: "جودة الحسابات",
  network_amplification: "التضخيم الشبكي", link_repetition: "تكرار الروابط", hashtag_pattern: "نمط الهاشتاغ",
  cross_platform: "عبر المنصّات", narrative_consistency: "تماسك السردية", influencer_trigger: "تحريك المؤثّرين",
};

export default function CampaignReportView() {
  const [monitors, setMonitors] = useState<any[]>([]);
  const [term, setTerm] = useState("");
  const [range, setRange] = useState<Range>("week");
  const [res, setRes] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const { demo } = useDemo();
  const today = new Date().toLocaleDateString("ar-IQ", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("q");
    getTargets().then((ts) => {
      setMonitors(ts.map((t) => ({ name: t.name, keywords: t.keywords })));
      run(q || primaryKeyword(ts));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const run = async (q: string) => {
    if (!q.trim()) return;
    setTerm(q); setLoading(true); setRes(null);
    const r = await apiPost("campaign", { keywords: [q], range, ...(demo ? { demo: 1 } : {}) }).catch(() => null);
    setRes(r); setLoading(false);
  };
  // re-run when the demo switch flips
  useEffect(() => { if (term) run(term); /* eslint-disable-next-line */ }, [demo]);

  const c = LV[res?.alert_level?.level] || LV.organic;

  return (
    <div className="brief-wrap">
      <div className="no-print">
        <PageHeader
          title="تقرير الحملات المنسّقة"
          sub="تقرير قابل للطباعة عن درجة التنسيق والإشارات التسع لأي حملة أو هاشتاغ."
          actions={res && !loading && !res.error
            ? <Button variant="primary" onClick={() => window.print()}><Icon name="clip" size={14} /> PDF</Button>
            : null}
        />
        <div className="card" style={{ margin: "0 0 12px" }}>
          <div style={{ display: "flex", gap: 8 }}>
            <input placeholder="موضوع / هاشتاغ / حملة (مثال: استقالة الحكومة)" value={term}
              onChange={(e) => setTerm(e.target.value)} onKeyDown={(e) => e.key === "Enter" && run(term)} />
            <button className="btn" onClick={() => run(term)} disabled={loading}>{loading ? "جارٍ الفحص…" : "أنشئ التقرير"}</button>
          </div>
          <div style={{ marginTop: 10, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <RangeSelect value={range} onChange={setRange} disabled={loading} />
            {monitors.map((m) => (
              <button key={m.name} className="btn ghost" style={{ padding: "3px 10px", fontSize: 12 }}
                onClick={() => run((m.keywords || [m.name])[0])}>{m.name}</button>
            ))}
          </div>
        </div>
      </div>

      {loading && <div style={{ textAlign: "center", padding: 40 }}><div className="spinner" /><p className="muted">يحلّل سلوك النشر عبر تسع إشارات…</p></div>}

      {res && !loading && (res.error ? <p className="muted">{res.message || "تعذّر الفحص."}</p> : (
        <div className="brief-doc">
          <div className="brief-head">
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <Logo size={42} />
              <div>
                <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: 0.5 }}>Sentinel Intelligence</div>
                <div className="muted" style={{ fontSize: 12 }}>تقرير الحملات المنسّقة · {today}</div>
              </div>
            </div>
            <div className="brief-class">سرّي — للاستخدام الداخلي</div>
          </div>

          <div className="brief-threat" style={{ ["--pc" as any]: c }}>
            <div>
              <div className="muted" style={{ fontSize: 12 }}>الموضوع: {res.main_narrative || term}</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: c }}>{res.alert_level?.label}</div>
            </div>
            <div style={{ fontSize: 38, fontWeight: 900, color: c }}>{res.coordination_score}<span style={{ fontSize: 16, color: "var(--muted)" }}>/100</span></div>
          </div>

          <section className="brief-sec">
            <h3>① المؤشّرات الرئيسية</h3>
            <div className="brief-kpis">
              {[["إجمالي المنشورات", res.total_posts], ["حسابات فريدة", res.unique_accounts],
                ["محتوى مكرّر", Math.round((res.duplicate_content_ratio || 0) * 100) + "%"],
                ["ذروة ١٥ دقيقة", Math.round((res.peak_15min_post_ratio || 0) * 100) + "%"],
                ["حسابات مشبوهة", Math.round((res.suspicious_account_ratio || 0) * 100) + "%"],
                ["منصّات", res.platforms_detected?.length || 0]].map(([l, v]: any) => (
                <div className="brief-kpi" key={l}><div style={{ fontSize: 24, fontWeight: 900 }}>{v}</div><div className="muted" style={{ fontSize: 11.5 }}>{l}</div></div>
              ))}
            </div>
          </section>

          <section className="brief-sec">
            <h3>② الإشارات التسع (مع أوزانها)</h3>
            <table className="brief-tbl">
              <thead><tr><th>الإشارة</th><th>الوزن</th><th>الدرجة</th></tr></thead>
              <tbody>
                {Object.entries(res.sub_scores || {}).map(([k, v]: any) => (
                  <tr key={k}>
                    <td>{SIG_LABEL[k] || k}</td>
                    <td className="muted">{Math.round((res.weights?.[k] || 0) * 100)}%</td>
                    <td><b style={{ color: v >= 60 ? "#f43f5e" : v >= 35 ? "#f59e0b" : "#22c55e" }}>{v}</b></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="brief-sec"><h3>③ الشرح</h3><p style={{ fontSize: 14, lineHeight: 2 }}>{res.explanation}</p></section>

          <div className="brief-2col">
            {res.top_hashtags?.length > 0 && (
              <section className="brief-sec"><h3>④ أبرز الهاشتاغات</h3>
                {res.top_hashtags.slice(0, 6).map((h: any) => (
                  <div key={h.hashtag} className="brief-row"><span style={{ flex: 1 }}>#{h.hashtag}</span><b>{h.count}</b></div>
                ))}
              </section>
            )}
            {res.top_amplifier_accounts?.length > 0 && (
              <section className="brief-sec"><h3>⑤ أبرز المضخّمين</h3>
                {res.top_amplifier_accounts.slice(0, 6).map((m: any) => (
                  <div key={m.username} className="brief-row"><span style={{ flex: 1 }}>@{m.username}</span><span className="muted">{m.posts} منشور</span></div>
                ))}
              </section>
            )}
          </div>

          {res.top_repeated_phrases?.length > 0 && (
            <section className="brief-sec"><h3>⑥ أكثر العبارات تكراراً</h3>
              {res.top_repeated_phrases.map((p: any, i: number) => (
                <div key={i} className="brief-row"><span className="chip" style={{ color: "#f59e0b" }}>×{p.count}</span><span style={{ flex: 1 }}>{p.text}…</span></div>
              ))}
            </section>
          )}

          <div className="brief-foot muted">{res.disclaimer} · Sentinel Intelligence by Integrate Dynamics · {today}</div>
        </div>
      ))}
    </div>
  );
}
