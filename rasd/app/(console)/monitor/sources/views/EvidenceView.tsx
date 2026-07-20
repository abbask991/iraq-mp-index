"use client";
import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";
import { Badge, Icon } from "@/components/ui";

/**
 * Raw Evidence Explorer — the analyst's free-text search over the normalized
 * signal store (`mentions`: X + Google News today). Filters map to real columns;
 * the platform facet shows honestly which sources the result actually spans, so
 * nobody mistakes an X-heavy corpus for full multi-platform coverage.
 */
const PLAT_AR: Record<string, string> = { x: "إكس", news: "أخبار", telegram: "تيليجرام", reddit: "ريديت", facebook: "فيسبوك", youtube: "يوتيوب" };
const SENT = [["", "كل النبرات"], ["سلبي", "سلبي"], ["إيجابي", "إيجابي"], ["محايد", "محايد"]];
const PERIODS = [["1", "٢٤ ساعة"], ["7", "٧ أيام"], ["30", "٣٠ يوم"], ["90", "٩٠ يوم"], ["0", "كل الفترة"]];
const fmt = (n: number) => (n || 0).toLocaleString("en-US");

export default function EvidenceView() {
  const [q, setQ] = useState("");
  const [platform, setPlatform] = useState("");
  const [sentiment, setSentiment] = useState("");
  const [since, setSince] = useState("30");
  const [hasLink, setHasLink] = useState(false);
  const [d, setD] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true); setD(null);
    const p = new URLSearchParams();
    if (q.trim()) p.set("q", q.trim());
    if (platform) p.set("platform", platform);
    if (sentiment) p.set("sentiment", sentiment);
    if (hasLink) p.set("has_link", "1");
    p.set("since_days", since);
    p.set("limit", "80");
    const entity = new URLSearchParams(window.location.search).get("entity_id");
    if (entity) p.set("entity_id", entity);
    const r = await apiGet(`/api/evidence/search?${p.toString()}`).catch(() => null);
    setD(r); setLoading(false);
  };
  useEffect(() => { run(); /* eslint-disable-next-line */ }, []);

  const items = d?.items || [];
  const facets = d?.platform_facets || {};

  return (
    <div>
      <h2 style={{ margin: 0 }}>مستكشف الأدلّة الخام</h2>
      <p className="muted" style={{ marginTop: 4 }}>بحث حرّ في الإشارات المرصودة والمخزّنة — للمحلّل الذي يريد الدليل الأصلي وراء أي مؤشّر. ليست الواجهة الأولى؛ ابدأ من الملخّص الاستخباراتي.</p>

      {/* filters */}
      <div className="card" style={{ margin: "12px 0", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <input placeholder="نص حرّ (مثال: الكهرباء)" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && run()} style={{ flex: 2, minWidth: 200 }} />
        <select value={platform} onChange={(e) => setPlatform(e.target.value)} style={{ width: 130 }}>
          <option value="">كل المنصّات</option>
          {["x", "news", "telegram", "reddit", "facebook", "youtube"].map((p) => <option key={p} value={p}>{PLAT_AR[p]}</option>)}
        </select>
        <select value={sentiment} onChange={(e) => setSentiment(e.target.value)} style={{ width: 120 }}>
          {SENT.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select value={since} onChange={(e) => setSince(e.target.value)} style={{ width: 110 }}>
          {PERIODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <label className="muted" style={{ fontSize: 12, display: "flex", gap: 5, alignItems: "center" }}>
          <input type="checkbox" checked={hasLink} onChange={(e) => setHasLink(e.target.checked)} style={{ width: "auto" }} /> فيه رابط
        </label>
        <button className="btn" onClick={run} disabled={loading}>{loading ? "…" : "بحث"}</button>
      </div>

      {loading && <div><span className="spinner" /> يبحث في المخزون…</div>}

      {d && !loading && (
        <>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
            <span className="muted" style={{ fontSize: 13 }}>{fmt(d.count)} نتيجة</span>
            {Object.keys(facets).length > 0 && <span className="muted" style={{ fontSize: 12 }}>·</span>}
            {Object.entries(facets).map(([p, n]: any) => (
              <span key={p} className="chip" style={{ fontSize: 11 }}>{PLAT_AR[p] || p} {fmt(n)}</span>
            ))}
          </div>

          {d.note && <p className="muted">{d.note}</p>}
          {!items.length && !d.note && <p className="muted">لا نتائج مطابقة. جرّب توسيع الفترة أو إزالة المرشّحات.</p>}

          <div style={{ display: "grid", gap: 10 }}>
            {items.map((it: any, i: number) => (
              <div key={it.external_id || i} className="cbox" style={{ borderInlineStart: `3px solid ${it.sentiment === "سلبي" ? "#f43f5e" : it.sentiment === "إيجابي" ? "#22c55e" : "var(--line)"}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
                  <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                    <Badge t="neutral">{PLAT_AR[it.platform] || it.platform}</Badge>
                    {it.source && <span className="muted" style={{ fontSize: 12 }}>{it.source}</span>}
                    {it.author && <span className="muted" style={{ fontSize: 12 }}>· {it.author}</span>}
                  </div>
                  <span className="muted u-num" style={{ fontSize: 11 }}>{it.created_at ? new Date(it.created_at).toLocaleString("ar-IQ", { dateStyle: "short", timeStyle: "short" }) : ""}</span>
                </div>
                <p style={{ fontSize: 13.5, lineHeight: 1.9, margin: "0 0 6px" }}>{(it.text || "").slice(0, 400) || "—"}</p>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                  {it.sentiment && <span className="chip" style={{ fontSize: 10.5 }}>{it.sentiment}</span>}
                  {it.emotion && <span className="chip" style={{ fontSize: 10.5, color: "#fb923c" }}>{it.emotion}</span>}
                  {it.engagement != null && <span className="muted u-num" style={{ fontSize: 11 }}><Icon name="bolt" size={11} /> {fmt(typeof it.engagement === "object" ? (it.engagement.likes || 0) : it.engagement)}</span>}
                  {(it.links || []).length > 0 && <a href={it.links[0]} target="_blank" rel="noopener" style={{ color: "var(--accent)", fontSize: 12 }}>المصدر ↗</a>}
                  {(it.hashtags || []).slice(0, 4).map((h: string) => <span key={h} className="muted" style={{ fontSize: 11 }}>#{h}</span>)}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
