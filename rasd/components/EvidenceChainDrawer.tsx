"use client";
import { useState } from "react";
import { apiGet } from "@/lib/api";
import { Icon, Badge, type Tone } from "@/components/ui";

/**
 * "Show Me Why" — a reusable evidence-chain drawer. Drop next to any insight,
 * score, alert, risk, campaign, narrative or recommendation; it opens a panel
 * that pulls the REAL evidence behind the subject from the normalized signal
 * store (/api/evidence/search) and shows the confidence picture honestly:
 * evidence count, source diversity, platform diversity, sample evidence, and the
 * limitations. Confidence is derived from volume + diversity; low says so.
 */
const PLAT_AR: Record<string, string> = { x: "إكس", news: "أخبار", telegram: "تيليجرام", reddit: "ريديت", facebook: "فيسبوك", youtube: "يوتيوب" };
const fmt = (n: number) => (n || 0).toLocaleString("en-US");

function confidence(count: number, platforms: number, sources: number): { label: string; tone: Tone; review: boolean } {
  // volume drives it; diversity nudges it up; a single-source thin corpus stays low
  let score = count >= 150 ? 3 : count >= 50 ? 2 : count >= 12 ? 1 : 0;
  if (platforms >= 3) score += 1;
  if (sources >= 5 && score < 3) score += 1;
  if (score >= 3) return { label: "ثقة عالية جداً", tone: "ok", review: false };
  if (score === 2) return { label: "ثقة عالية", tone: "ok", review: false };
  if (score === 1) return { label: "ثقة متوسطة", tone: "warn", review: false };
  return { label: "ثقة منخفضة", tone: "danger", review: true };
}

export default function EvidenceChainDrawer({ subject, context, label = "أرني السبب", compact }:
  { subject: string; context?: string; label?: string; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [d, setD] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const clean = (subject || "").replace(/^#/, "").trim();
  const show = async () => {
    setOpen(true);
    if (!d && clean) {
      setLoading(true);
      const r = await apiGet(`/api/evidence/search?q=${encodeURIComponent(clean)}&since_days=60&limit=50`).catch(() => null);
      setD(r); setLoading(false);
    }
  };

  const items = d?.items || [];
  const facets = d?.platform_facets || {};
  const platforms = Object.keys(facets).length;
  const sources = new Set(items.map((i: any) => i.source).filter(Boolean)).size;
  const conf = confidence(d?.count || 0, platforms, sources);
  const latest = items[0]?.created_at;

  return (
    <>
      <button className="btn ghost" style={{ fontSize: compact ? 10.5 : 11.5, padding: compact ? "2px 7px" : "3px 9px", display: "inline-flex", alignItems: "center", gap: 4 }} onClick={(e) => { e.preventDefault(); e.stopPropagation(); show(); }}>
        <Icon name="brain" size={compact ? 11 : 12} /> {label}
      </button>
      {open && (
        <div className="ecd-overlay" onClick={() => setOpen(false)}>
          <div className="ecd" onClick={(e) => e.stopPropagation()}>
            <div className="ecd-head">
              <div>
                <div className="u-fine">سلسلة الأدلّة{context ? ` · ${context}` : ""}</div>
                <h3 style={{ margin: "2px 0 0" }}>{clean || "—"}</h3>
              </div>
              <button className="btn ghost" onClick={() => setOpen(false)}>✕</button>
            </div>

            {loading && <p className="muted" style={{ padding: 16 }}><span className="spinner" /> يجمع الأدلّة…</p>}

            {!loading && d && (
              <div className="ecd-body">
                {/* confidence picture */}
                <div className="ecd-conf">
                  <Badge t={conf.tone} dot>{conf.label}</Badge>
                  {conf.review && <span className="u-fine" style={{ color: "var(--danger)" }}>يتطلّب مراجعة بشرية.</span>}
                </div>
                <div className="ecd-stats">
                  <div><b>{fmt(d.count || 0)}</b><span>دليل</span></div>
                  <div><b>{platforms}</b><span>تنوّع المنصّات</span></div>
                  <div><b>{sources}</b><span>تنوّع المصادر</span></div>
                  <div><b style={{ fontSize: 12 }}>{latest ? new Date(latest).toLocaleDateString("ar-IQ", { dateStyle: "short" }) : "—"}</b><span>آخر تحديث</span></div>
                </div>
                {platforms > 0 && (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                    {Object.entries(facets).map(([p, n]: any) => <span key={p} className="chip" style={{ fontSize: 11 }}>{PLAT_AR[p] || p} {fmt(n)}</span>)}
                  </div>
                )}

                {items.length === 0 && <p className="muted">لا أدلّة كافية في المخزون لهذا الموضوع — قد يتطلّب توسيع الرصد.</p>}

                {items.length > 0 && (
                  <>
                    <div className="u-fine" style={{ margin: "4px 0 8px" }}>عيّنة الأدلّة ({Math.min(items.length, 15)})</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {items.slice(0, 15).map((it: any, i: number) => (
                        <div key={it.external_id || i} className="ecd-item">
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 3 }}>
                            <span className="u-fine">{PLAT_AR[it.platform] || it.platform}{it.source ? ` · ${it.source}` : ""}</span>
                            <span className="u-fine u-num">{it.created_at ? new Date(it.created_at).toLocaleDateString("ar-IQ", { dateStyle: "short" }) : ""}</span>
                          </div>
                          <div style={{ fontSize: 13, lineHeight: 1.7 }}>{(it.text || "").slice(0, 240) || "—"}</div>
                          {(it.links || []).length > 0 && <a href={it.links[0]} target="_blank" rel="noopener" style={{ color: "var(--accent)", fontSize: 12 }}>المصدر ↗</a>}
                        </div>
                      ))}
                    </div>
                  </>
                )}

                <p className="u-fine" style={{ marginTop: 12 }}>
                  الأدلّة من المخزون الموحّد (X + أخبار غالباً). محدوديات: التغطية تعتمد على المصادر المفعّلة، والغياب لا يعني عدم الوجود.
                  <a href={`/monitor/sources?src=evidence`} style={{ color: "var(--accent)", marginInlineStart: 6 }}>المستكشف الكامل ↗</a>
                </p>
              </div>
            )}
            {!loading && !d && <p className="muted" style={{ padding: 16 }}>تعذّر جلب الأدلّة.</p>}
          </div>
        </div>
      )}
    </>
  );
}
