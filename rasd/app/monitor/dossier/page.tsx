"use client";
import { useState } from "react";
import { apiPost } from "@/lib/api";
import RangeSelect, { Range } from "@/components/RangeSelect";

const sColor = (s: string) => (s === "سلبي" ? "#f43f5e" : s === "إيجابي" ? "#22c55e" : "#8a97ad");
const PERIOD: Record<string, string> = { day: "آخر 24 ساعة", week: "آخر 7 أيام", month: "آخر شهر", year: "آخر سنة" };
const lvlColor = (l: string) => (l?.includes("جداً") ? "#f43f5e" : l === "مرتفع" ? "#fb923c" : l === "متوسط" ? "#f59e0b" : "#22c55e");

export default function Dossier() {
  const [name, setName] = useState("");
  const [range, setRange] = useState<Range>("week");
  const [d, setD] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const today = new Date().toISOString().slice(0, 10);

  const run = async (q: string) => {
    if (!q.trim()) return;
    setName(q); setLoading(true); setD(null);
    const r = await apiPost("dossier", { keywords: [q], range }).catch(() => null);
    setD(r); setLoading(false);
  };

  const downloadPdf = async () => {
    setDownloading(true);
    try {
      const html2pdf = (await import("html2pdf.js")).default;
      await html2pdf().set({
        margin: [8, 8, 10, 8], filename: `تقرير-${name}.pdf`,
        image: { type: "jpeg", quality: 0.96 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff", windowWidth: 980 },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        pagebreak: { mode: ["css", "legacy"], before: ".break" },
      }).from(document.querySelector(".paper")).save();
    } finally { setDownloading(false); }
  };

  const s = d?.sentiment || { pos: 0, neg: 0, neu: 0 };
  const c = d?.content || {};
  const bd = d?.bigdata || {};

  return (
    <div>
      <div className="rep-actions no-print">
        <h2 style={{ margin: 0 }}>التقرير الشامل عن شخصية</h2>
        {d && !loading && !d.message && (
          <button className="btn" onClick={downloadPdf} disabled={downloading}>{downloading ? "جارٍ التحميل…" : "تحميل PDF"}</button>
        )}
      </div>

      <div className="card no-print" style={{ margin: "12px 0" }}>
        <div style={{ display: "flex", gap: 8 }}>
          <input placeholder="اسم الشخصية (مثال: باسم البدري)" value={name}
            onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && run(name)} />
          <button className="btn" onClick={() => run(name)} disabled={loading}>{loading ? "جارٍ إعداد التقرير…" : "أنشئ التقرير"}</button>
        </div>
        <div style={{ marginTop: 10 }}><RangeSelect value={range} onChange={setRange} disabled={loading} /></div>
      </div>

      {loading && <div style={{ textAlign: "center", padding: 40 }}><div className="spinner" /><p className="muted">يجمع البيانات ويحلّلها عبر كل الأقسام… (قد يأخذ دقيقة)</p></div>}

      {d && !loading && (d.message ? <p className="muted">{d.message}</p> : (
        <div className="paper">
          <div className="rep-head">
            <div>
              <div className="brand">مركز الرصد · تقرير استخباراتي شامل</div>
              <h1>{d.entity}</h1>
              <div className="sub">تحليل التغطية الإعلامية والرقمية</div>
            </div>
            <div className="rep-meta">
              <div>تاريخ التقرير: <b>{today}</b></div>
              <div>الفترة: {PERIOD[d.period] || d.period}</div>
              <div>المصادر: أخبار ({d.news}) + X ({d.x})</div>
            </div>
          </div>

          <div className="rep-kpis">
            <div className="k"><div className="v">{d.total}</div><div className="l">إجمالي ما نُشر</div></div>
            <div className="k"><div className="v" style={{ color: d.media_index >= 60 ? "#16a34a" : d.media_index <= 40 ? "#dc2626" : "#0b1220" }}>{d.media_index}/100</div><div className="l">المؤشّر الإعلامي</div></div>
            <div className="k"><div className="v" style={{ color: "#dc2626" }}>{s.neg}</div><div className="l">سلبي</div></div>
            <div className="k"><div className="v" style={{ color: bd.manipulation_index >= 50 ? "#dc2626" : "#0b1220" }}>{bd.manipulation_index ?? "—"}</div><div className="l">مؤشّر التلاعب</div></div>
          </div>

          {d.executive && <section><h2>التقييم التنفيذي</h2><p className="summary" style={{ whiteSpace: "pre-line" }}>{d.executive}</p></section>}

          {(c.narratives || []).length > 0 && (
            <section>
              <h2>السرديات المهيمنة</h2>
              {c.narratives.map((n: any, i: number) => (
                <div key={i} className="item">
                  <div className="it-t">{n.label} <span style={{ color: sColor(n.sentiment) }}>● {n.sentiment}</span> — <b>{n.share}%</b></div>
                  <div className="it-m">{n.description}</div>
                </div>
              ))}
            </section>
          )}

          <div className="rep-grid">
            {c.tone?.label && (
              <section><h2>النبرة والأُطر</h2>
                <p style={{ fontSize: 13 }}><b>النبرة:</b> {c.tone.label} — {c.tone.description}</p>
                {(c.frames || []).map((f: any, i: number) => <div key={i} style={{ fontSize: 12.5, padding: "3px 0" }}><b>{f.label}:</b> {f.description}</div>)}
              </section>
            )}
            {(c.key_messages || []).length > 0 && (
              <section><h2>الرسائل الرئيسية</h2>
                <ul style={{ paddingInlineStart: 16, fontSize: 13, lineHeight: 1.9 }}>{c.key_messages.map((m: string, i: number) => <li key={i}>{m}</li>)}</ul>
              </section>
            )}
          </div>

          <section><h2>انحياز المصادر</h2>
            {(d.sources || []).map((src: any) => (
              <div className="brow" key={src.source}>
                <div className="bl">{src.source}</div>
                <div className="bar" style={{ display: "flex", background: "#eef1f6" }}>
                  <i style={{ width: `${(src.neg / src.total) * 100}%`, background: "#dc2626" }} />
                  <i style={{ width: `${(src.neu / src.total) * 100}%`, background: "#94a3b8" }} />
                  <i style={{ width: `${(src.pos / src.total) * 100}%`, background: "#16a34a" }} />
                </div>
                <div className="bn" style={{ color: src.lean >= 20 ? "#16a34a" : src.lean <= -20 ? "#dc2626" : "#64748b" }}>{src.lean > 0 ? "+" : ""}{src.lean}</div>
              </div>
            ))}
          </section>

          <section className="break"><h2>تحليل النشاط الرقمي (البيانات الضخمة)</h2>
            <div className="rep-grid">
              <div>
                <p style={{ fontSize: 13 }}><b>مؤشّر التلاعب:</b> <span style={{ color: lvlColor(bd.level) }}>{bd.manipulation_index ?? "—"} ({bd.level || "—"})</span></p>
                {bd.drivers && <p className="muted" style={{ fontSize: 12.5 }}>حسابات مشبوهة {bd.drivers.bot_pct}% · محتوى مكرّر {bd.drivers.dup_ratio}% · حسابات جديدة {bd.drivers.new_pct}% · تركيز زمني {bd.drivers.burst}%</p>}
                <p style={{ fontSize: 13 }}>شبكة التأثير: {bd.network_accounts} حساب · {bd.network_edges} رابط · موجات تزامن: {bd.waves} · حسابات آلية: {bd.automation}</p>
              </div>
              <div>
                {d.spread?.first_poster && <p style={{ fontSize: 13 }}><b>أول من نشر:</b> @{d.spread.first_poster.username} (قبل {d.spread.first_poster.hours_ago} ساعة)</p>}
                {d.spread?.first_influential && <p style={{ fontSize: 13 }}><b>أول حساب مؤثّر:</b> @{d.spread.first_influential.username}</p>}
                {(d.spread?.amplifiers || []).length > 0 && <p style={{ fontSize: 12.5 }}><b>أبرز المضخّمين:</b> {d.spread.amplifiers.map((a: any) => "@" + a.username).join("، ")}</p>}
              </div>
            </div>
          </section>

          <div className="rep-grid">
            <section><h2>أبرز القضايا</h2>
              {(d.themes || []).map((t: any) => <div className="brow" key={t.label}><div className="bl">{t.label}</div><div className="bar"><i style={{ width: `${(t.count / Math.max(1, ...d.themes.map((x: any) => x.count))) * 100}%` }} /></div><div className="bn">{t.count}</div></div>)}
            </section>
            <section><h2>المصطلحات المفتاحية</h2>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{(d.key_terms || []).map((t: any) => <span key={t.term} style={{ fontSize: 11 + Math.min(8, t.count), color: "#334155" }}>{t.term}</span>)}</div>
            </section>
          </div>

          <section><h2>أبرز ما نُشر</h2>
            {(d.top_items || []).map((h: any, i: number) => (
              <div className="item sm" key={i}>
                <div className="it-t">{h.platform === "x" ? "𝕏" : "📰"} {h.title}</div>
                <div className="it-m"><span>{h.source}</span> <span style={{ color: sColor(h.sentiment) }}>● {h.sentiment}</span></div>
              </div>
            ))}
          </section>

          <div className="rep-foot">مركز الرصد · تقرير آلي بمساعدة الذكاء الاصطناعي (Claude) · {today} — يحتاج مراجعة بشرية للقرارات الحسّاسة.</div>
        </div>
      ))}
    </div>
  );
}
