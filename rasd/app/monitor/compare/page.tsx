"use client";
import { Fragment, useEffect, useState } from "react";
import { apiPost, intelGet } from "@/lib/api";
import { getTargets, Target } from "@/lib/targets";
import Gauge from "@/components/Gauge";
import { SkelCards } from "@/components/Skeleton";
import EmptyState from "@/components/EmptyState";

const SCORES: { key: string; ar: string; invert?: boolean }[] = [
  { key: "reputation", ar: "السمعة" },
  { key: "political_influence", ar: "النفوذ السياسي" },
  { key: "public_trust", ar: "ثقة الجمهور" },
  { key: "media_influence", ar: "النفوذ الإعلامي" },
  { key: "narrative_dominance", ar: "هيمنة السردية" },
  { key: "political_risk", ar: "الخطر السياسي", invert: true },
  { key: "campaign_threat", ar: "تهديد الحملة", invert: true },
  { key: "crisis_escalation", ar: "تصعيد الأزمة", invert: true },
];

async function buildTwin(name: string) {
  const ing = await apiPost("ingest", { keywords: [name], range: "week" }).catch(() => null);
  if (!ing?.entity_id) return null;
  const t = await intelGet(`/twin/${encodeURIComponent(ing.entity_id)}`).catch(() => null);
  return t;
}

export default function Compare() {
  const [targets, setTargets] = useState<Target[]>([]);
  const [a, setA] = useState(""); const [b, setB] = useState("");
  const [twA, setTwA] = useState<any>(null); const [twB, setTwB] = useState<any>(null);
  const [busy, setBusy] = useState(false); const [ran, setRan] = useState(false);

  useEffect(() => {
    getTargets().then((ts) => {
      setTargets(ts);
      if (ts[0]) setA(ts[0].keywords?.[0] || ts[0].name);
      if (ts[1]) setB(ts[1].keywords?.[0] || ts[1].name);
    });
  }, []);

  const run = async () => {
    if (!a.trim() || !b.trim()) return;
    setBusy(true); setRan(true); setTwA(null); setTwB(null);
    const [ra, rb] = await Promise.all([buildTwin(a), buildTwin(b)]);
    setTwA(ra); setTwB(rb); setBusy(false);
  };

  const sa = twA?.scores || {}; const sb = twB?.scores || {};
  // winner per metric: higher is better, except invert (risk) where lower wins
  const winner = (k: string, inv?: boolean) => {
    const va = sa[k]?.score ?? 0, vb = sb[k]?.score ?? 0;
    if (va === vb) return 0;
    const aBetter = inv ? va < vb : va > vb;
    return aBetter ? -1 : 1;
  };

  return (
    <div>
      <h2>المقارنة الاستخباراتية — كيان مقابل كيان</h2>
      <p className="muted">قارن شخصيتين أو مؤسستين جنباً إلى جنب عبر المؤشرات الاستراتيجية الثمانية.</p>

      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 10, alignItems: "center" }}>
          <input placeholder="الكيان الأول" value={a} onChange={(e) => setA(e.target.value)} onKeyDown={(e) => e.key === "Enter" && run()} />
          <b style={{ color: "var(--muted)" }}>VS</b>
          <input placeholder="الكيان الثاني" value={b} onChange={(e) => setB(e.target.value)} onKeyDown={(e) => e.key === "Enter" && run()} />
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10, alignItems: "center" }}>
          <button className="btn" onClick={run} disabled={busy}>{busy ? "…" : "قارن"}</button>
          <span className="muted" style={{ fontSize: 12 }}>أهدافك:</span>
          {targets.map((t) => (
            <button key={t.id} className="btn ghost" style={{ padding: "3px 9px", fontSize: 12 }}
              onClick={() => (!a ? setA(t.keywords?.[0] || t.name) : setB(t.keywords?.[0] || t.name))}>{t.name}</button>
          ))}
        </div>
      </div>

      {busy && <SkelCards count={3} />}

      {ran && !busy && (!twA || !twB) && (
        <EmptyState tone="error" title="تعذّر بناء أحد الملفين"
          subtitle="تأكد من الاسمين وحاول مجدداً — قد يكون أحد الكيانين قليل النشاط حالياً."
          action={{ label: "إعادة المحاولة", onClick: run }} />
      )}

      {twA && twB && !busy && (
        <>
          {/* heads */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <div className="cbox" style={{ textAlign: "center" }}>
              <div style={{ fontSize: 18, fontWeight: 800 }}>{twA.identity?.name}</div>
              <div className="muted" style={{ fontSize: 12 }}>{twA.data_points} نقطة · {twA.media_exposure?.sources} مصدر</div>
            </div>
            <div style={{ fontSize: 22, fontWeight: 900, color: "var(--accent)" }}>VS</div>
            <div className="cbox" style={{ textAlign: "center" }}>
              <div style={{ fontSize: 18, fontWeight: 800 }}>{twB.identity?.name}</div>
              <div className="muted" style={{ fontSize: 12 }}>{twB.data_points} نقطة · {twB.media_exposure?.sources} مصدر</div>
            </div>
          </div>

          {/* paired gauges per metric */}
          <div className="card">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 150px 1fr", gap: 6, alignItems: "center" }}>
              {SCORES.map(({ key, ar, invert }) => {
                const w = winner(key, invert);
                const hl = (side: number) => ({
                  borderRadius: 14, padding: "6px 0",
                  background: w === side ? "rgba(52,214,198,.08)" : "transparent",
                  outline: w === side ? "1px solid rgba(52,214,198,.35)" : "none",
                });
                return (
                  <Fragment key={key}>
                    <div style={{ display: "flex", justifyContent: "center", ...hl(-1) }}>
                      <Gauge value={sa[key]?.score ?? 0} size={70} invert={invert} />
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>{ar}</div>
                      <div style={{ fontSize: 11, color: "var(--muted)" }}>
                        {w === -1 ? "◀ الأول" : w === 1 ? "الثاني ▶" : "تعادل"}</div>
                    </div>
                    <div style={{ display: "flex", justifyContent: "center", ...hl(1) }}>
                      <Gauge value={sb[key]?.score ?? 0} size={70} invert={invert} />
                    </div>
                  </Fragment>
                );
              })}
            </div>
          </div>

          {/* quick verdict */}
          <div className="cbox" style={{ marginTop: 14 }}>
            <h4>الخلاصة</h4>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, fontSize: 13 }}>
              {[["السمعة الأعلى", "reputation", false], ["النفوذ الأكبر", "political_influence", false],
                ["الخطر الأقل", "political_risk", true], ["الأكثر صعوداً", "narrative_dominance", false]].map(([label, k, inv]: any) => {
                const va = sa[k]?.score ?? 0, vb = sb[k]?.score ?? 0;
                const aWin = inv ? va < vb : va > vb;
                return (
                  <div key={k} style={{ padding: "6px 0", borderBottom: "1px solid var(--line)" }}>
                    <span className="muted">{label}: </span>
                    <b style={{ color: "var(--accent)" }}>{aWin ? twA.identity?.name : twB.identity?.name}</b>
                    <span className="muted"> ({aWin ? va : vb} مقابل {aWin ? vb : va})</span>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
