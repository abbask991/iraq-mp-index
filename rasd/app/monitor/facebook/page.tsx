"use client";
import { useEffect, useState } from "react";
import { apiGet, apiSend } from "@/lib/api";
import Gauge from "@/components/Gauge";
import { SkelCards } from "@/components/Skeleton";
import EmptyState from "@/components/EmptyState";

const appColor = (v: number) => (v >= 60 ? "#22c55e" : v >= 40 ? "#f59e0b" : "#f43f5e");
const fmt = (n: number) => (n || 0).toLocaleString("en-US");

function Bar({ p }: { p: any }) {
  return (
    <span style={{ flex: 1, height: 8, borderRadius: 999, background: "var(--input)", overflow: "hidden", display: "flex" }}>
      <span style={{ width: `${p.approval ?? 50}%`, background: "#22c55e" }} />
      <span style={{ width: `${p.rejection ?? 50}%`, background: "#f43f5e" }} />
    </span>
  );
}

export default function Facebook() {
  const [tab, setTab] = useState<"page" | "national">("national");
  return (
    <div>
      <h2>👍 رصد فيسبوك — التأييد والرفض</h2>
      <p className="muted">فيسبوك مكان الجمهور العراقي الحقيقي. نقيس الاستقبال من التفاعلات (👍❤️🤗 تأييد · 😠😢 رفض) + مشاعر التعليقات.</p>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <button className={`btn ${tab === "national" ? "" : "ghost"}`} onClick={() => setTab("national")}>🇮🇶 النبض الوطني</button>
        <button className={`btn ${tab === "page" ? "" : "ghost"}`} onClick={() => setTab("page")}>🔎 صفحة محدّدة</button>
      </div>
      {tab === "page" ? <PageView Bar={Bar} /> : <NationalView Bar={Bar} />}
    </div>
  );
}

function NationalView({ Bar }: { Bar: any }) {
  const [d, setD] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [pages, setPages] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const load = () => { setLoading(true); apiGet("/api/facebook/national").then(setD).finally(() => setLoading(false)); };
  useEffect(() => { load(); apiGet("/api/facebook/pages").then((r) => setPages((r?.pages || []).join("\n"))); }, []);

  const save = async () => {
    setSaving(true);
    await apiSend("/api/facebook/pages", "POST", { pages: pages.split("\n").map((x) => x.trim()).filter(Boolean) }).catch(() => {});
    setSaving(false); load();
  };

  return (
    <>
      {/* editable seed list */}
      <details className="card" style={{ marginBottom: 14 }}>
        <summary style={{ cursor: "pointer", fontWeight: 700 }}>⚙️ الصفحات المرصودة (اضغط للتعديل) — أضِف slug صفحات عراقية حقيقية</summary>
        <textarea value={pages} onChange={(e) => setPages(e.target.value)} rows={8}
          style={{ width: "100%", marginTop: 8, fontFamily: "monospace", fontSize: 13, resize: "vertical" }}
          placeholder="صفحة بكل سطر — مثلاً: alsumaria.tv" />
        <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center" }}>
          <button className="btn" onClick={save} disabled={saving}>{saving ? "…" : "حفظ وإعادة الجلب"}</button>
          <span className="muted" style={{ fontSize: 11 }}>انسخ الـslug من رابط الصفحة بفيسبوك (facebook.com/<b>هذا_الجزء</b>).</span>
        </div>
      </details>

      {loading && <SkelCards count={3} />}
      {d?.error && <EmptyState tone="error" title="تعذّر" subtitle={d.message} action={{ label: "إعادة", onClick: load }} />}

      {d && !d.error && (
        <>
          <div className="cbox" style={{ marginBottom: 14, borderInlineStart: `4px solid ${appColor(d.approval || 0)}` }}>
            <div style={{ display: "flex", gap: 18, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ textAlign: "center" }}>
                <Gauge value={d.approval || 0} size={120} color={appColor(d.approval || 0)} />
                <div style={{ fontWeight: 800, marginTop: 4 }}>تأييد فيسبوك الوطني</div>
              </div>
              <div style={{ flex: 1, minWidth: 220 }}>
                <div style={{ fontSize: 24, fontWeight: 900 }}>
                  <span style={{ color: "#22c55e" }}>{d.approval}% تأييد</span> · <span style={{ color: "#f43f5e" }}>{d.rejection}% رفض</span>
                </div>
                <div className="muted" style={{ fontSize: 12.5, marginTop: 6 }}>
                  {d.pages_ok} صفحة · {fmt(d.total_engagement)} تفاعل · إيجابي {fmt(d.total_positive)} / سلبي {fmt(d.total_negative)}
                </div>
                {d.summary && <p style={{ fontSize: 14, lineHeight: 1.9, marginTop: 8 }}>{d.summary}</p>}
              </div>
            </div>
          </div>

          {/* per-page table */}
          {d.pages?.length > 0 && (
            <div className="cbox" style={{ marginBottom: 14 }}>
              <h4>📊 الصفحات (مرتّبة بالتفاعل)</h4>
              {d.pages.map((p: any, i: number) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderTop: i ? "1px solid var(--line)" : 0 }}>
                  <span style={{ minWidth: 130, fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.page}</span>
                  <span style={{ color: "#22c55e", fontSize: 12, minWidth: 36 }}>{p.approval ?? "—"}%</span>
                  <Bar p={p} />
                  <span className="muted" style={{ fontSize: 11, minWidth: 90, textAlign: "left" }}>{p.posts} منشور · {fmt(p.engagement)}</span>
                </div>
              ))}
            </div>
          )}

          {/* most rejected nationally */}
          {d.most_rejected?.length > 0 && (
            <div className="cbox" style={{ marginBottom: 14 }}>
              <h4 style={{ color: "#f43f5e" }}>🔴 أكثر ما يثير الرفض وطنياً</h4>
              {d.most_rejected.map((p: any, i: number) => (
                <div key={i} style={{ padding: "8px 0", borderTop: i ? "1px solid var(--line)" : 0, fontSize: 13 }}>
                  <span className="chip" style={{ color: "#f43f5e" }}>{p.rejection}% رفض</span> <span className="muted" style={{ fontSize: 11 }}>{p.page} · 😠😢 {fmt(p.neg)}</span>
                  <div style={{ marginTop: 4 }}>«{p.text}»</div>
                </div>
              ))}
            </div>
          )}

          {d.pages_failed?.length > 0 && <p className="muted" style={{ fontSize: 11.5 }}>⚠️ صفحات تعذّر جلبها (slug غير صحيح؟): {d.pages_failed.join("، ")}</p>}
          <p className="muted" style={{ fontSize: 11 }}>{d.note}</p>
        </>
      )}
    </>
  );
}

function PageView({ Bar }: { Bar: any }) {
  const [t, setT] = useState("");
  const [d, setD] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const run = async () => {
    if (!t.trim() || loading) return;
    setLoading(true); setD(null);
    const r = await apiGet(`/api/facebook/page?target=${encodeURIComponent(t.trim())}&limit=20`).catch(() => null);
    setD(r); setLoading(false);
  };

  return (
    <>
      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <input placeholder="اسم الصفحة أو رابطها (مثال: aljazeera)" value={t} onChange={(e) => setT(e.target.value)} onKeyDown={(e) => e.key === "Enter" && run()} />
          <button className="btn" onClick={run} disabled={loading}>{loading ? "…يجلب" : "حلّل الصفحة"}</button>
        </div>
        <p className="muted" style={{ fontSize: 11, marginTop: 6 }}>Apify (فاتورة منفصلة) — أبطأ شوي (~دقيقة لأنه يسحب منشورات + تعليقات).</p>
      </div>
      {loading && <SkelCards count={3} />}
      {d?.error && <EmptyState tone="error" title="تعذّر" subtitle={d.message} action={{ label: "إعادة", onClick: run }} />}
      {d && !d.error && (
        <>
          <div className="cbox" style={{ marginBottom: 14, borderInlineStart: `4px solid ${appColor(d.approval || 0)}` }}>
            <h4 style={{ margin: "0 0 4px" }}>{d.page_name}</h4>
            <div style={{ display: "flex", gap: 18, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ textAlign: "center" }}>
                <Gauge value={d.approval || 0} size={120} color={appColor(d.approval || 0)} />
                <div style={{ fontWeight: 800, marginTop: 4 }}>التأييد المدمَج</div>
              </div>
              <div style={{ flex: 1, minWidth: 220 }}>
                <div style={{ fontSize: 24, fontWeight: 900 }}><span style={{ color: "#22c55e" }}>{d.approval}% تأييد</span> · <span style={{ color: "#f43f5e" }}>{d.rejection}% رفض</span></div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", fontSize: 12.5, marginTop: 8 }}>
                  <span className="chip" style={{ color: "#22c55e" }}>👍 {fmt(d.total_positive)}</span>
                  <span className="chip" style={{ color: "#f43f5e" }}>😠😢 {fmt(d.total_negative)}</span>
                  <span className="chip">💬 {fmt(d.total_comments)}</span>
                  <span className="chip">🔁 {fmt(d.total_shares)}</span>
                </div>
                {d.comment_sentiment && <div style={{ marginTop: 8, fontSize: 12, color: "var(--muted)" }}>📊 تفاعلات {d.reaction_approval}% · تعليقات {d.comment_sentiment.approval}% → مدمَج {d.approval}%</div>}
                {d.summary && <p style={{ fontSize: 14, lineHeight: 1.9, marginTop: 8 }}>{d.summary}</p>}
              </div>
            </div>
          </div>
          {d.comment_sentiment && (
            <div className="cbox" style={{ marginBottom: 14 }}>
              <h4>💬 مشاعر التعليقات ({d.comment_sentiment.analyzed} تعليق)</h4>
              <div style={{ display: "flex", height: 14, borderRadius: 999, overflow: "hidden", marginBottom: 8 }}>
                <span style={{ width: `${(d.comment_sentiment.pos / d.comment_sentiment.analyzed) * 100}%`, background: "#22c55e" }} />
                <span style={{ width: `${(d.comment_sentiment.neu / d.comment_sentiment.analyzed) * 100}%`, background: "#8a97ad" }} />
                <span style={{ width: `${(d.comment_sentiment.neg / d.comment_sentiment.analyzed) * 100}%`, background: "#f43f5e" }} />
              </div>
              <div style={{ display: "flex", gap: 12, fontSize: 12.5 }}><span style={{ color: "#22c55e" }}>إيجابي {d.comment_sentiment.pos}</span><span className="muted">محايد {d.comment_sentiment.neu}</span><span style={{ color: "#f43f5e" }}>سلبي {d.comment_sentiment.neg}</span></div>
              {d.sample_comments?.map((c: any, i: number) => (
                <div key={i} style={{ fontSize: 12.5, padding: "4px 0", borderTop: i ? "1px solid var(--line)" : 0 }}>
                  <span style={{ color: c.sentiment === "إيجابي" ? "#22c55e" : c.sentiment === "سلبي" ? "#f43f5e" : "#8a97ad", fontWeight: 700 }}>● </span>{c.text}
                </div>
              ))}
              <p className="muted" style={{ fontSize: 11, marginTop: 6 }}>السخرية قد تُقرأ حرفياً أحياناً — مراجعة بشرية مستحسنة.</p>
            </div>
          )}
          {d.posts?.length > 0 && (
            <div className="cbox" style={{ marginBottom: 14 }}>
              <h4>📋 المنشورات</h4>
              {d.posts.map((p: any, i: number) => (
                <div key={i} style={{ padding: "9px 0", borderTop: i ? "1px solid var(--line)" : 0 }}>
                  <div style={{ fontSize: 13, marginBottom: 5 }}>{p.text || "—"}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ color: "#22c55e", fontSize: 12, minWidth: 38 }}>{p.approval ?? "—"}%</span><Bar p={p} /><span style={{ color: "#f43f5e", fontSize: 12, minWidth: 38, textAlign: "left" }}>{p.rejection ?? "—"}%</span>
                  </div>
                  <div className="muted" style={{ fontSize: 11, marginTop: 3 }}>👍 {fmt(p.pos)} · 😠😢 {fmt(p.neg)} · 💬 {fmt(p.comments)}</div>
                </div>
              ))}
            </div>
          )}
          <p className="muted" style={{ fontSize: 11 }}>{d.note}</p>
        </>
      )}
    </>
  );
}
