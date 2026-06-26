"use client";
import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";
import IraqMap from "@/components/IraqMap";

const PLAT_ICON: Record<string, string> = { x: "𝕏", instagram: "📸", tiktok: "🎵", facebook: "👤", youtube: "▶️", reddit: "🟠" };
const riskC = (lv?: string) => (lv === "حرج" ? "#f43f5e" : lv === "مرتفع" ? "#fb923c" : lv === "متوسط" ? "#f59e0b" : "#22c55e");

function Stat({ l, v, c }: { l: string; v: any; c?: string }) {
  return <div style={{ textAlign: "center" }}><div style={{ fontWeight: 800, fontSize: 18, color: c }}>{v}</div><div className="muted" style={{ fontSize: 11 }}>{l}</div></div>;
}

export default function Fusion() {
  const [entity, setEntity] = useState("");
  const [d, setD] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  const run = async (e?: string) => {
    const q = (e ?? entity).trim(); if (!q) return;
    setEntity(q); setBusy(true); setD(null);
    const r = await apiGet(`/api/fusion/picture?entity=${encodeURIComponent(q)}`).catch(() => null);
    setD(r); setBusy(false);
  };

  useEffect(() => { const u = new URLSearchParams(window.location.search).get("q"); if (u) run(u); /* eslint-disable-next-line */ }, []);

  const s = d?.synthesis || {};

  return (
    <div>
      <h2 style={{ margin: 0 }}>الصورة الاستخباراتية الموحّدة</h2>
      <p className="muted" style={{ marginTop: 4 }}>كل المنصّات في محصلة واحدة — وصول مدموج، سرديات عابرة للمنصّات، ومن يقود الانتشار. اكتب كياناً أو موضوعاً.</p>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "12px 0" }}>
        <input placeholder="مثال: وزارة الكهرباء" value={entity} onChange={(e) => setEntity(e.target.value)} onKeyDown={(e) => e.key === "Enter" && run()} style={{ flex: 1, minWidth: 220 }} />
        <button className="btn" onClick={() => run()} disabled={busy}>{busy ? "جارٍ الدمج…" : "بناء الصورة"}</button>
        {["وزارة الكهرباء", "محمد شياع السوداني", "الرواتب"].map((x) => <button key={x} className="btn ghost" style={{ fontSize: 12 }} onClick={() => run(x)}>{x}</button>)}
      </div>

      {busy && <div><span className="spinner" /> دمج المنصّات + تركيب ذكي…</div>}

      {d?.error && <p className="muted">تعذّر — {d.error}</p>}

      {d && !d.error && (
        <>
          {/* headline reach + platform breakdown */}
          <div className="cbox" style={{ borderInlineStart: `4px solid ${riskC(s.risk_level)}` }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 12, marginBottom: 10 }}>
              <Stat l="وصول إجمالي مقدّر" v={Number(d.reach?.total_reach || 0).toLocaleString()} c="var(--accent)" />
              <Stat l="منصّات نشطة" v={d.reach?.platform_count} />
              <Stat l="منشورات" v={d.totals?.posts} />
              <Stat l="سلبي" v={`${d.sentiment?.negative}%`} c="#f43f5e" />
              <Stat l="مستوى الخطر" v={s.risk_level} c={riskC(s.risk_level)} />
            </div>
            {/* reach bar across platforms */}
            <div style={{ display: "flex", height: 14, borderRadius: 7, overflow: "hidden", border: "1px solid var(--line)" }}>
              {(d.reach?.platforms || []).map((b: any) => (
                <div key={b.platform} title={`${b.platform}: ${b.reach_share}%`} style={{ width: `${b.reach_share}%`, background: b.platform === "x" ? "#1d9bf0" : b.platform === "tiktok" ? "#ff0050" : b.platform === "instagram" ? "#e1306c" : b.platform === "facebook" ? "#1877f2" : b.platform === "youtube" ? "#ff0000" : "#ff4500" }} />
              ))}
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 6 }}>
              {(d.reach?.platforms || []).map((b: any) => (
                <span key={b.platform} className="muted" style={{ fontSize: 11 }}>{PLAT_ICON[b.platform]} {b.platform} {b.reach_share}% · {Number(b.reach).toLocaleString()}</span>
              ))}
            </div>
          </div>

          {/* AI synthesis — the final verdict */}
          {s.executive && (
            <div className="cbox" style={{ marginTop: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                <h4 style={{ margin: 0 }}>التركيب النهائي {s.fallback ? "" : "(ذكاء اصطناعي)"}</h4>
                <span className="chip">ثقة {s.confidence}%</span>
              </div>
              <p style={{ fontSize: 14.5, lineHeight: 2, marginTop: 8 }}>{s.executive}</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 8, fontSize: 13 }}>
                {s.key_finding && <div><b>أهم استنتاج:</b> {s.key_finding}</div>}
                {s.who_drives && <div><b>من يقود:</b> {s.who_drives}</div>}
              </div>
              <div style={{ marginTop: 8 }}>
                <div style={{ color: riskC(s.risk_level), fontSize: 13 }}><b>الخطر ({s.risk_level}):</b> {s.risk_reason}</div>
                <div style={{ color: "var(--accent)", fontSize: 13, marginTop: 4 }}><b>التوصية:</b> {s.recommendation}</div>
              </div>
            </div>
          )}

          <div className="cc-grid" style={{ marginTop: 14 }}>
            {/* narratives across platforms */}
            <div className="cbox">
              <h4 style={{ marginTop: 0 }}>السرديات عبر المنصّات</h4>
              {(d.narratives || []).map((n: any, i: number) => (
                <div key={i} style={{ padding: "6px 0", borderTop: i ? "1px solid var(--line)" : 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                    <b>{n.narrative}</b><span className="muted">{n.posts} منشور · {n.share}%</span>
                  </div>
                  <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                    {(n.platforms || []).map((p: string) => <span key={p} className="chip" style={{ fontSize: 10 }}>{PLAT_ICON[p]} {p}</span>)}
                    {n.cross_platform > 1 && <span className="chip" style={{ fontSize: 10, color: "#fb923c" }}>عابرة {n.cross_platform} منصّات</span>}
                  </div>
                </div>
              ))}
              {!d.narratives?.length && <span className="muted">—</span>}
            </div>

            {/* top influencers across platforms */}
            <div className="cbox">
              <h4 style={{ marginTop: 0 }}>من يقود الانتشار (كل المنصّات)</h4>
              {(d.influencers || []).slice(0, 8).map((a: any, i: number) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "3px 0" }}>
                  <span>{PLAT_ICON[a.platform]} @{a.username}</span>
                  <span className="muted">وصول {Number(a.reach).toLocaleString()}</span>
                </div>
              ))}
              {!d.influencers?.length && <span className="muted">—</span>}
            </div>
          </div>

          {!!d.heatmap?.located && (
            <div className="cbox" style={{ marginTop: 14 }}>
              <h4 style={{ marginTop: 0 }}>الانتشار الجغرافي (X)</h4>
              <IraqMap geo={d.heatmap} />
            </div>
          )}

          <p className="muted" style={{ fontSize: 11, marginTop: 12 }}>
            {d.totals?.x_posts} منشور X مباشر + {d.totals?.cross_posts} من منصّات أخرى (مخزّنة). {d.disclaimer}
          </p>
        </>
      )}
    </div>
  );
}
