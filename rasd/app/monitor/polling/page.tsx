"use client";
import { useState } from "react";
import { apiGet } from "@/lib/api";

const repC = (lbl?: string) => (lbl === "عالية" ? "#22c55e" : lbl === "متوسطة" ? "#f59e0b" : "#f43f5e");
function Stat({ l, v, c }: { l: string; v: any; c?: string }) {
  return <div style={{ textAlign: "center" }}><div style={{ fontWeight: 800, fontSize: 18, color: c }}>{v}</div><div className="muted" style={{ fontSize: 11 }}>{l}</div></div>;
}

const TYPES = ["موثّق", "مؤثّر", "عادي"];
const WEIGHTINGS = [{ v: "population", l: "ترجيح سكّاني" }, { v: "equal", l: "موازنة المحافظات" }, { v: "raw", l: "بدون ترجيح" }];

export default function Polling() {
  const [subject, setSubject] = useState("");
  const [d, setD] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [size, setSize] = useState(500);
  const [types, setTypes] = useState<string[]>([...TYPES]);
  const [excludeBots, setExcludeBots] = useState(true);
  const [weighting, setWeighting] = useState("population");

  const toggleType = (t: string) => setTypes((p) => p.includes(t) ? p.filter((x) => x !== t) : [...p, t]);

  const run = async (s?: string) => {
    const q = (s ?? subject).trim(); if (!q) return;
    setSubject(q); setBusy(true); setD(null);
    const qs = new URLSearchParams({
      subject: q, sample_size: String(size), exclude_bots: String(excludeBots),
      weighting, account_types: types.length === TYPES.length ? "" : types.join(","),
    }).toString();
    const r = await apiGet(`/api/polling/survey?${qs}`).catch(() => null);
    setD(r); setBusy(false);
  };

  const res = d?.result || {}; const rep = d?.representativeness || {}; const smp = d?.sample || {};
  const fav = res.favorable;

  return (
    <div>
      <h2 style={{ margin: 0 }}>استطلاع الرأي الاجتماعي</h2>
      <p className="muted" style={{ marginTop: 4 }}>قياس رأي عام من السوشيال ميديا بمنهجية: حجم العيّنة، الترجيح السكّاني، هامش الخطأ، وتمثيلية العيّنة. لأي حزب · شخصية · شركة.</p>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "12px 0" }}>
        <input placeholder="الموضوع (مثال: محمد شياع السوداني)" value={subject} onChange={(e) => setSubject(e.target.value)} onKeyDown={(e) => e.key === "Enter" && run()} style={{ flex: 1, minWidth: 220 }} />
        <button className="btn" onClick={() => run()} disabled={busy}>{busy ? "جارٍ القياس…" : "إجراء الاستطلاع"}</button>
      </div>

      {/* تصميم العيّنة */}
      <div className="cbox" style={{ marginBottom: 14 }}>
        <h4 style={{ marginTop: 0 }}>تصميم العيّنة</h4>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 14 }}>
          <div>
            <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>حجم العيّنة المستهدف</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {[200, 500, 1000, 2000, 3000].map((s) => (
                <button key={s} className={size === s ? "btn" : "btn ghost"} style={{ fontSize: 12, padding: "5px 12px" }} onClick={() => setSize(s)}>{s.toLocaleString()}</button>
              ))}
            </div>
          </div>
          <div>
            <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>نوع العيّنة (الحسابات)</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {TYPES.map((t) => (
                <button key={t} className={types.includes(t) ? "btn" : "btn ghost"} style={{ fontSize: 12, padding: "5px 12px" }} onClick={() => toggleType(t)}>{t}</button>
              ))}
            </div>
          </div>
          <div>
            <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>طريقة الترجيح (النسبة)</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {WEIGHTINGS.map((w) => (
                <button key={w.v} className={weighting === w.v ? "btn" : "btn ghost"} style={{ fontSize: 12, padding: "5px 12px" }} onClick={() => setWeighting(w.v)}>{w.l}</button>
              ))}
            </div>
          </div>
          <div>
            <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>تنقية</div>
            <button className={excludeBots ? "btn" : "btn ghost"} style={{ fontSize: 12, padding: "5px 12px" }} onClick={() => setExcludeBots((v) => !v)}>
              {excludeBots ? "✓ استبعاد الحسابات الآلية" : "تضمين الحسابات الآلية"}
            </button>
          </div>
        </div>
      </div>

      {busy && <div><span className="spinner" /> جمع العيّنة · استبعاد الآليين · تصنيف المواقف · ترجيح…</div>}
      {d?.error && <p className="muted">تعذّر — {d.error}</p>}

      {d && !d.error && (
        <>
          {/* headline result */}
          <div className="cbox" style={{ textAlign: "center", padding: 24 }}>
            <div className="muted" style={{ fontSize: 13 }}>التأييد لـ «{d.subject}»</div>
            <div style={{ fontSize: 56, fontWeight: 900, lineHeight: 1.1, color: fav >= 55 ? "#22c55e" : fav <= 45 ? "#f43f5e" : "var(--text)" }}>
              {fav != null ? `${fav}%` : "—"}
            </div>
            <div className="muted" style={{ fontSize: 13 }}>± {res.margin_of_error} نقطة · هامش الخطأ (ثقة 95%)</div>
            {/* support/oppose bar */}
            {fav != null && (
              <div style={{ display: "flex", height: 22, borderRadius: 11, overflow: "hidden", margin: "14px auto", maxWidth: 460, border: "1px solid var(--line)" }}>
                <div style={{ width: `${fav}%`, background: "#22c55e", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#04121a" }}>مؤيّد {fav}%</div>
                <div style={{ width: `${res.unfavorable}%`, background: "#f43f5e", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#fff" }}>معارض {res.unfavorable}%</div>
              </div>
            )}
            <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
              <span className="chip" style={{ color: res.weighting_applied ? "#22c55e" : "#fb923c" }}>
                {res.weighting_applied ? "مُرجّح سكّانياً ✓" : "خام (عيّنة غير كافية للترجيح)"}
              </span>
              {res.weighted_favorable != null && <span className="chip">مُرجّح: {res.weighted_favorable}%</span>}
              {res.raw_favorable != null && <span className="chip">خام: {res.raw_favorable}%</span>}
              <span className="chip">صافي: {res.net > 0 ? "+" : ""}{res.net}</span>
            </div>
          </div>

          {/* methodology bar */}
          <div className="cbox" style={{ marginTop: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(110px,1fr))", gap: 12 }}>
              <Stat l="حجم العيّنة (n)" v={smp.n} c="var(--accent)" />
              <Stat l="إشارات محلّلة" v={smp.analyzed} />
              <Stat l="بلا رأي" v={smp.no_opinion} />
              <Stat l="آليون مُستبعدون" v={smp.bots_excluded} c="#fb923c" />
              <Stat l="الثقة" v={`${d.confidence}%`} />
              <Stat l="التمثيلية" v={`${rep.score}/100`} c={repC(rep.label)} />
            </div>
            <div style={{ marginTop: 10, padding: 10, borderRadius: 10, background: "color-mix(in srgb, var(--accent) 6%, transparent)", borderInlineStart: `3px solid ${repC(rep.label)}` }}>
              <b style={{ fontSize: 12.5 }}>تمثيلية العيّنة: {rep.label}</b>
              <span className="muted" style={{ fontSize: 11.5 }}> — غطّت {rep.governorates_covered}/18 محافظة · مطابقة سكّانية {rep.alignment_pct}%</span>
            </div>
          </div>

          <div className="cc-grid" style={{ marginTop: 14 }}>
            {/* geography */}
            <div className="cbox">
              <h4 style={{ marginTop: 0 }}>التأييد حسب المحافظة</h4>
              {(d.geography || []).slice(0, 10).map((g: any, i: number) => (
                <div key={i} style={{ margin: "6px 0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}><span>{g.name}</span><span className="muted">{g.support_pct}% · ن={g.sample}</span></div>
                  <div style={{ height: 6, background: "var(--line)", borderRadius: 3, marginTop: 2 }}><div style={{ width: `${g.support_pct}%`, height: "100%", background: g.support_pct >= 50 ? "#22c55e" : "#f43f5e", borderRadius: 3 }} /></div>
                </div>
              ))}
              {!d.geography?.length && <span className="muted">عيّنة جغرافية غير كافية (عدّ الحسابات بلا موقع محدّد).</span>}
            </div>

            {/* platforms + composition */}
            <div className="cbox">
              <h4 style={{ marginTop: 0 }}>حسب المنصّة + تركيب العيّنة</h4>
              {(d.platforms || []).map((p: any, i: number) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "3px 0" }}>
                  <span>{p.platform}</span><span className="muted">تأييد {p.support_pct}% · ن={p.sample}</span>
                </div>
              ))}
              <div style={{ marginTop: 8, borderTop: "1px solid var(--line)", paddingTop: 8 }}>
                <div className="muted" style={{ fontSize: 11, marginBottom: 4 }}>تركيب الحسابات:</div>
                {Object.entries(smp.account_types || {}).map(([k, v]: any) => <span key={k} className="chip" style={{ margin: 2 }}>{k}: {v}</span>)}
              </div>
            </div>
          </div>

          {/* method + honest disclaimer */}
          <div className="cbox" style={{ marginTop: 14 }}>
            <h4 style={{ marginTop: 0 }}>المنهجية</h4>
            <p style={{ fontSize: 13, lineHeight: 1.9, margin: "0 0 8px" }}>{d.method}</p>
            <p className="muted" style={{ fontSize: 11.5, lineHeight: 1.8 }}>{d.disclaimer}</p>
          </div>
        </>
      )}
    </div>
  );
}
