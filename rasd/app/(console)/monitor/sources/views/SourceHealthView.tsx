"use client";
import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";
import { SkelCards } from "@/components/Skeleton";
import { Card, Badge, Stat, Icon, Section, Row } from "@/components/ui";
import BlindSpotsPanel from "@/components/BlindSpotsPanel";

/**
 * Source Health — the operations & cost view for the Monitoring Hub.
 *
 * Everything here is real ops data: /api/settings/health (subsystem status +
 * honest blockers + last-collection age) and /api/settings/collector (collector
 * run history + aggregate savings + budget). No fabricated reliability scores —
 * a subsystem is shown up/down by what it actually reports, and "configured" is
 * never rendered as "working".
 */
const SERVICE_AR: Record<string, string> = {
  backend: "الخادم", database: "قاعدة البيانات", redis: "الكاش (Redis)", queue: "قائمة المهام",
  ai_provider: "مزوّد الذكاء الاصطناعي", x_api: "منصّة X", telegram: "تيليجرام (تنبيهات)", rss: "RSS / الأخبار",
};

const fmt = (n: number) => (n || 0).toLocaleString("en-US");
function ageLabel(hours?: number) {
  if (hours == null) return null;
  if (hours < 1) return "قبل أقل من ساعة";
  if (hours < 24) return `قبل ${Math.round(hours)} ساعة`;
  return `قبل ${Math.round(hours / 24)} يوم`;
}

export default function SourceHealthView() {
  const [h, setH] = useState<any>(null);
  const [c, setC] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    Promise.all([
      apiGet("/api/settings/health").catch(() => null),
      apiGet("/api/settings/collector?limit=12").catch(() => null),
    ]).then(([hh, cc]) => { setH(hh); setC(cc); }).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const services = h?.services || {};
  const metrics = h?.metrics || {};
  const blockers = h?.blockers || [];
  const totals = c?.totals || {};
  const runs = c?.runs || [];
  const budget = c?.budget || h?.budget || {};

  const crit = blockers.filter((b: any) => b.severity === "crit");
  const warn = blockers.filter((b: any) => b.severity !== "crit");

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <div>
          <h2 style={{ margin: 0 }}>صحة المصادر والتشغيل</h2>
          <p className="muted" style={{ marginTop: 4 }}>حالة كل مصدر ومزوّد، آخر جمع، الحصص والكلفة، والأعطال — للعمليات والتحكّم بالتكلفة.</p>
        </div>
        <button className="btn ghost" onClick={load} disabled={loading}><Icon name="refresh" size={13} /> تحديث</button>
      </div>

      {loading && <SkelCards count={4} />}

      {!loading && h && (
        <>
          {/* blockers first — the honest "why is nothing arriving" answer */}
          {crit.length > 0 && (
            <div className="cbox" style={{ margin: "12px 0", borderInlineStart: "4px solid var(--danger)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <Icon name="siren" size={16} /><b>الجمع متوقّف أو معطّل</b>
              </div>
              {crit.map((b: any) => (
                <div key={b.key} style={{ padding: "5px 0" }}>
                  <div style={{ fontWeight: "var(--w-med)" }}>{b.label}</div>
                  <div className="u-fine">الحل: {b.fix}</div>
                </div>
              ))}
            </div>
          )}

          {/* blind spots — what we don't know yet */}
          <div className="u-section"><BlindSpotsPanel /></div>

          {/* subsystem status grid */}
          <Section title="حالة المصادر والمزوّدين" icon="network">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 10 }}>
              {Object.keys(SERVICE_AR).map((k) => {
                const up = !!services[k];
                return (
                  <div className="card" key={k} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "12px 14px" }}>
                    <span style={{ fontSize: 13.5, fontWeight: 600 }}>{SERVICE_AR[k]}</span>
                    <Badge t={up ? "ok" : "danger"} dot>{up ? "يعمل" : "متوقّف"}</Badge>
                  </div>
                );
              })}
            </div>
            <div className="u-fine" style={{ marginTop: 8 }}>
              مزوّد البيانات: <b>{h.data_provider || "—"}</b> · «يعمل» تعني استجابة فعلية، لا مجرّد وجود مفتاح.
            </div>
          </Section>

          {/* operational metrics */}
          <Section title="مؤشّرات التشغيل" icon="bolt">
            <div className="u-stats">
              <Stat label="آخر جمع" icon="refresh" value={ageLabel(metrics.last_collection_age_hours) || (metrics.last_collection ? new Date(metrics.last_collection).toLocaleDateString("ar-IQ") : "—")}
                meta={metrics.last_collection ? new Date(metrics.last_collection).toLocaleString("ar-IQ", { dateStyle: "short", timeStyle: "short" }) : undefined} />
              <Stat label="مهام فاشلة (آخر ٥٠)" icon="alert" value={fmt(metrics.failed_jobs || 0)} />
              {totals.fetched != null && <Stat label="عناصر مجموعة (آخر التشغيلات)" icon="clip" value={fmt(totals.fetched)} />}
              {totals.ai_calls_saved != null && <Stat label="نداءات ذكاء موفّرة" icon="brain" value={fmt(totals.ai_calls_saved)} meta="بفضل إزالة التكرار" />}
              {budget?.spent != null && <Stat label="الإنفاق" icon="bolt" value={`$${budget.spent}`} meta={budget.cap ? `من سقف $${budget.cap}` : undefined} />}
              {budget?.x_quota_used != null && <Stat label="حصّة X المستخدمة" icon="network" value={fmt(budget.x_quota_used)} />}
            </div>
            {warn.length > 0 && (
              <Card style={{ marginTop: "var(--s-3)" }}>
                {warn.map((b: any) => (
                  <Row key={b.key} icon="alert" iconTone="warn" title={b.label} meta={b.fix} />
                ))}
              </Card>
            )}
          </Section>

          {/* collector run history */}
          {runs.length > 0 && (
            <Section title="سجلّ عمليات الجمع" icon="clip" count={runs.length}>
              <Card>
                <div style={{ overflowX: "auto" }}>
                  <table className="brief-tbl" style={{ minWidth: 520 }}>
                    <thead><tr><th>الوقت</th><th>الحالة</th><th>مجموعة</th><th>مكرّرة</th><th>عناقيد</th><th>أخطاء</th></tr></thead>
                    <tbody>
                      {runs.slice(0, 12).map((r: any, i: number) => (
                        <tr key={i}>
                          <td className="u-num">{r.created_at ? new Date(r.created_at).toLocaleString("ar-IQ", { dateStyle: "short", timeStyle: "short" }) : "—"}</td>
                          <td><Badge t={r.status === "failed" ? "danger" : r.status === "ok" || r.status === "done" ? "ok" : "neutral"}>{r.status || "—"}</Badge></td>
                          <td className="u-num">{fmt(r.fetched_count || 0)}</td>
                          <td className="u-num">{fmt(r.duplicate_count || 0)}</td>
                          <td className="u-num">{fmt(r.cluster_count || 0)}</td>
                          <td className="u-num" style={{ color: (r.errors || 0) > 0 ? "var(--danger)" : undefined }}>{fmt(r.errors || 0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </Section>
          )}

          <p className="u-fine" style={{ marginTop: 12 }}>
            بيانات تشغيلية حيّة من الخادم. الحقول غير المتاحة تُحذف ولا تُصفّر — ما يظهر هنا مقيس فعلاً.
          </p>
        </>
      )}

      {!loading && !h && <div className="cbox">تعذّر تحميل بيانات الصحة. <button className="btn ghost" onClick={load}>إعادة</button></div>}
    </div>
  );
}
