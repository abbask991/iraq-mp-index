"use client";
import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";
import { SkelCards } from "@/components/Skeleton";
import { Icon, Badge, Stat, type Tone } from "@/components/ui";

/**
 * Client Success Dashboard (admin) — adoption & value across clients, for renewals
 * and upsell. Client list, plan and status are REAL (from /api/orgs). The health
 * score derives from those real facts. Per-client ENGAGEMENT (logins, reports
 * generated, evidence opened, AI questions) needs a usage-event log that doesn't
 * exist yet, so it is shown as «قيد التتبّع» — flagged, never faked.
 */
const PLAN_AR: Record<string, string> = { trial: "تجريبي", basic: "أساسي", pro: "احترافي", professional: "احترافي", enterprise: "مؤسّسي" };
const PLAN_RANK: Record<string, number> = { trial: 1, basic: 1, pro: 2, professional: 2, enterprise: 3 };

function health(o: any): { score: number; tone: Tone } {
  let s = 15;
  const st = o.status || "active";
  s += st === "active" ? 45 : st === "trial" ? 25 : 5;
  s += (PLAN_RANK[o.plan] || 1) === 3 ? 30 : (PLAN_RANK[o.plan] || 1) === 2 ? 22 : 12;
  s = Math.min(100, s);
  return { score: s, tone: s >= 75 ? "ok" : s >= 50 ? "warn" : "danger" };
}
function renewalRisk(o: any): { ar: string; tone: Tone } {
  const st = o.status || "active";
  if (st === "expired" || st === "pending") return { ar: "خطر تجديد مرتفع", tone: "danger" };
  if (st === "trial") return { ar: "خطر متوسط", tone: "warn" };
  return { ar: "خطر منخفض", tone: "ok" };
}
const upsell = (plan: string) => ((PLAN_RANK[plan] || 1) === 1 ? "ترقية إلى الاحترافي" : (PLAN_RANK[plan] || 1) === 2 ? "ترقية إلى المؤسّسي" : "—");

export default function ClientSuccessView() {
  const [orgs, setOrgs] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet("/api/orgs").then((r) => setOrgs(Array.isArray(r?.orgs) ? r.orgs : [])).catch(() => setOrgs([])).finally(() => setLoading(false));
  }, []);

  if (loading) return <SkelCards count={3} />;
  const list = orgs || [];
  const active = list.filter((o) => (o.status || "active") === "active").length;
  const trials = list.filter((o) => o.status === "trial").length;
  const atRisk = list.filter((o) => renewalRisk(o).tone === "danger").length;

  return (
    <div>
      <h2 style={{ margin: 0 }}>نجاح العملاء</h2>
      <p className="muted" style={{ marginTop: 4 }}>تبنّي العملاء والقيمة المُقدَّمة — للتجديد والترقية. (لوحة إدارية)</p>

      <div className="u-stats" style={{ margin: "12px 0" }}>
        <Stat label="إجمالي العملاء" icon="network" value={list.length} />
        <Stat label="نشطون" icon="check" value={active} />
        <Stat label="تجارب" icon="flask" value={trials} />
        <Stat label="بخطر تجديد" icon="alert" value={atRisk} />
      </div>

      {list.length === 0 && <p className="muted">لا عملاء بعد — أنشئ عميلاً من تبويب «العملاء».</p>}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {list.map((o) => {
          const h = health(o); const rr = renewalRisk(o);
          return (
            <div key={o.id} className="cbox">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                <div>
                  <b>{o.name}</b>
                  <div className="u-fine">الباقة: {PLAN_AR[o.plan] || o.plan} · الحالة: {o.status || "نشط"}{o.created_at ? ` · منذ ${new Date(o.created_at).toLocaleDateString("ar-IQ", { dateStyle: "medium" })}` : ""}</div>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <Badge t={h.tone} dot>صحة {h.score}</Badge>
                  <Badge t={rr.tone}>{rr.ar}</Badge>
                  {upsell(o.plan) !== "—" && <span className="chip" style={{ fontSize: 11, color: "var(--accent)" }}>{upsell(o.plan)}</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="cbox" style={{ marginTop: 14, borderInlineStart: "4px solid #f59e0b" }}>
        <b>مقاييس التفاعل لكل عميل — تجميع قيد الإنشاء</b>
        <p className="muted" style={{ fontSize: 12.5, margin: "6px 0 0" }}>
          سجلّ الاستخدام مُفعَّل الآن (التقارير المولّدة، الأدلّة المفتوحة، أسئلة المحلّل تظهر فعلياً في «عائد القيمة» لكل عميل ضمن مساحته). لعرضها هنا مجمّعة لكل عميل يلزم وسم الأحداث بالمؤسسة — قيد الإنشاء. صحة العميل أعلاه مبنية على الباقة والحالة الفعليتين.
        </p>
      </div>
    </div>
  );
}
