"use client";
import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";
import BattlefieldGraph from "@/components/BattlefieldGraph";
import { SkelCards } from "@/components/Skeleton";

const TIER_C: Record<string, string> = { big: "#f43f5e", mid: "#fb923c", rising: "#22c55e" };
const stanceC = (lbl?: string) => (lbl === "داعم" ? "#22c55e" : lbl === "معارض" ? "#f43f5e" : "#94a3b8");

function Stat({ l, v, c }: { l: string; v: any; c?: string }) {
  return <div style={{ textAlign: "center" }}><div style={{ fontWeight: 800, fontSize: 16, color: c }}>{v}</div><div className="muted" style={{ fontSize: 11 }}>{l}</div></div>;
}

export default function InfluencersView() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState<string | null>(null);
  const [prof, setProf] = useState<any>(null);
  const [pLoading, setPLoading] = useState(false);

  useEffect(() => { apiGet("/api/influencers?range=day").then((r) => { setData(r); setLoading(false); }).catch(() => setLoading(false)); }, []);

  const open = async (handle: string) => {
    setSel(handle); setProf(null); setPLoading(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
    const r = await apiGet(`/api/influencers/profile?handle=${encodeURIComponent(handle)}`).catch(() => null);
    setProf(r); setPLoading(false);
  };

  const list = data?.influencers || [];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
        <div>
          <h2 style={{ margin: 0 }}>رادار المؤثّرين</h2>
          <p className="muted" style={{ marginTop: 4 }}>الحسابات الكبيرة والكبيرة نسبياً — مع مَن يشتغل كل مؤثّر، مَن يدعم، وضد مَن.</p>
        </div>
        {data && <span className="chip">{data.scanned?.toLocaleString()} منشور · {list.length} مؤثّر</span>}
      </div>

      {/* PROFILE DETAIL */}
      {sel && (
        <div className="cbox" style={{ margin: "14px 0", borderInlineStart: `4px solid ${stanceC(prof?.stance?.label)}` }}>
          <button className="btn ghost" style={{ float: "inline-start", fontSize: 12 }} onClick={() => { setSel(null); setProf(null); }}>← رجوع للمؤثّرين</button>
          {pLoading && <div style={{ padding: 20 }}><span className="spinner" /> جارٍ تحليل المؤثّر (منشوراته + مَن حوله)…</div>}
          {prof?.error && <p className="muted">تعذّر التحليل — {prof.error}</p>}
          {prof && !prof.error && (
            <>
              <h3 style={{ marginTop: 4 }}>@{prof.influencer?.username} <span className="muted" style={{ fontSize: 13 }}>{prof.influencer?.name}</span></h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(110px,1fr))", gap: 10, margin: "10px 0" }}>
                <Stat l="التصنيف" v={prof.influencer?.tier?.label} c={TIER_C[prof.influencer?.tier?.key]} />
                <Stat l="متابعون" v={Number(prof.influencer?.followers || 0).toLocaleString()} />
                <Stat l="التأثير" v={prof.influencer?.influence} />
                <Stat l="الموقف" v={prof.stance?.label} c={stanceC(prof.stance?.label)} />
                <Stat l="مؤشر الموقف" v={`${prof.stance?.net > 0 ? "+" : ""}${prof.stance?.net}`} c={stanceC(prof.stance?.label)} />
                <Stat l="احتمال آلية" v={`${prof.influencer?.bot}%`} c={prof.influencer?.bot > 60 ? "#f43f5e" : undefined} />
              </div>

              {prof.summary && <div className="card" style={{ marginBottom: 12 }}><p style={{ fontSize: 14, lineHeight: 1.95, margin: 0 }}>{prof.summary}</p></div>}

              <div className="cc-grid">
                <div className="card">
                  <h4 style={{ marginTop: 0, color: "#22c55e" }}>🟢 يدعم</h4>
                  {(prof.supports || []).length ? prof.supports.map((s: any, i: number) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "3px 0" }}><span>{s.entity}</span><span className="muted">{s.count}×</span></div>
                  )) : <span className="muted">— لا إشارات دعم واضحة</span>}
                </div>
                <div className="card">
                  <h4 style={{ marginTop: 0, color: "#f43f5e" }}>🔴 ضد / ينتقد</h4>
                  {(prof.against || []).length ? prof.against.map((s: any, i: number) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "3px 0" }}><span>{s.entity}</span><span className="muted">{s.count}×</span></div>
                  )) : <span className="muted">— لا إشارات معارضة واضحة</span>}
                </div>
              </div>

              <div className="cc-grid" style={{ marginTop: 12 }}>
                <div className="card">
                  <h4 style={{ marginTop: 0 }}>🤝 يعمل مع / يضخّم</h4>
                  {(prof.works_with || []).length ? prof.works_with.map((a: any, i: number) => (
                    <span key={i} className="chip" style={{ margin: 2 }}>@{a.username} · {a.count}</span>
                  )) : <span className="muted">— لا تفاعل بارز</span>}
                  <p className="muted" style={{ fontSize: 10, marginTop: 6 }}>إشارات تفاعل/تضخيم — ليست إثبات تنسيق.</p>
                </div>
                <div className="card">
                  <h4 style={{ marginTop: 0 }}>📡 حملات / هاشتاغات يدفعها</h4>
                  {(prof.campaigns || []).length ? prof.campaigns.map((c: any, i: number) => (
                    <span key={i} className="chip" style={{ margin: 2 }}>{c.hashtag} · {c.count}</span>
                  )) : <span className="muted">—</span>}
                </div>
              </div>

              <div className="cc-grid" style={{ marginTop: 12 }}>
                <div className="card">
                  <h4 style={{ marginTop: 0, color: "#22c55e" }}>مَن يدعمه (خارجياً)</h4>
                  {(prof.external_supporters || []).length ? prof.external_supporters.map((a: any, i: number) => (
                    <div key={i} style={{ fontSize: 13, padding: "2px 0" }}>@{a.username} <span className="muted">· تأثير {a.influence}</span></div>
                  )) : <span className="muted">—</span>}
                </div>
                <div className="card">
                  <h4 style={{ marginTop: 0, color: "#f43f5e" }}>مَن يهاجمه (خارجياً)</h4>
                  {(prof.external_attackers || []).length ? prof.external_attackers.map((a: any, i: number) => (
                    <div key={i} style={{ fontSize: 13, padding: "2px 0" }}>@{a.username} <span className="muted">· تأثير {a.influence}</span></div>
                  )) : <span className="muted">—</span>}
                </div>
              </div>

              {!!prof.network?.nodes?.length && (
                <div className="card" style={{ marginTop: 12 }}>
                  <h4 style={{ marginTop: 0 }}>🕸️ شبكة العلاقات</h4>
                  <BattlefieldGraph data={prof.network} onSelect={() => {}} />
                  <div className="muted" style={{ fontSize: 11 }}>أخضر = يدعم · أحمر = يهاجم · أزرق = يتفاعل/يضخّم</div>
                </div>
              )}
              <p className="muted" style={{ fontSize: 11, marginTop: 12 }}>{prof.disclaimer}</p>
            </>
          )}
        </div>
      )}

      {/* RADAR LIST */}
      {!sel && (
        <>
          {loading && <SkelCards count={6} />}
          {data?.error && <p className="muted">تعذّر المسح المباشر — {data.error}</p>}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(290px,1fr))", gap: 12, marginTop: 14 }}>
            {list.map((n: any) => (
              <button key={n.username} className="cbox" onClick={() => open(n.username)}
                style={{ textAlign: "start", cursor: "pointer", border: "1px solid var(--line)", borderInlineStart: `4px solid ${stanceC(n.stance_label)}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <div><b style={{ fontSize: 14 }}>@{n.username}</b>{n.verified && <span style={{ color: "#3b82f6" }}> ✓</span>}<div className="muted" style={{ fontSize: 11 }}>{n.name}</div></div>
                  <span className="chip" style={{ color: TIER_C[n.tier?.key] }}>{n.tier?.label}</span>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "8px 0" }}>
                  <span className="chip" style={{ color: stanceC(n.stance_label) }}>{n.stance_label} {n.net_stance > 0 ? "+" : ""}{n.net_stance}</span>
                  {n.bot > 60 && <span className="chip" style={{ color: "#f43f5e" }}>🤖 {n.bot}%</span>}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 4 }}>
                  <Stat l="متابعون" v={n.followers >= 1000 ? `${Math.round(n.followers / 1000)}k` : n.followers} />
                  <Stat l="تأثير" v={n.influence} />
                  <Stat l="منشورات" v={n.posts} />
                </div>
                {!!n.supports?.length && <div style={{ fontSize: 11, marginTop: 8, color: "#22c55e" }}>يدعم: {n.supports.slice(0, 2).join(" · ")}</div>}
                {!!n.against?.length && <div style={{ fontSize: 11, marginTop: 2, color: "#f43f5e" }}>ضد: {n.against.slice(0, 2).join(" · ")}</div>}
              </button>
            ))}
          </div>
          {!loading && !list.length && !data?.error && <p className="muted">لا مؤثّرين بارزين الآن — جرّب لاحقاً.</p>}
          {data?.disclaimer && <p className="muted" style={{ fontSize: 11, marginTop: 14 }}>{data.disclaimer}</p>}
        </>
      )}
    </div>
  );
}
