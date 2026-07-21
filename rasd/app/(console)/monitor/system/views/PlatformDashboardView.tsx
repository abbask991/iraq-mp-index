"use client";
/**
 * Platform Administration — Dashboard (spec §20). The fleet home for the
 * Sentinel/Rasad operator: client counts, breakdowns, a clients table, and
 * recent platform activity (audit). Admin-only.
 */
import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";
import { ORG_TYPE_AR } from "@/lib/sector";

const PLAN_AR: Record<string, string> = { trial: "تجريبي", basic: "أساسي", pro: "احترافي", enterprise: "مؤسّسي" };
const STATUS_AR: Record<string, string> = { active: "نشط", suspended: "موقوف", draft: "مسودة", onboarding: "تهيئة", pilot: "تجربة", expired: "منتهٍ", archived: "مؤرشف" };
const ACTION_AR: Record<string, string> = {
  "workspace.create": "إنشاء مساحة عمل", "workspace.update": "تعديل مساحة", "workspace.delete": "حذف مساحة",
  "project.create": "إنشاء مشروع", "project.delete": "حذف مشروع",
  "user.add": "إضافة مستخدم", "user.update": "تعديل مستخدم", "user.remove": "إزالة مستخدم",
  "user.set_password": "تغيير باسورد", "user.reset_link": "رابط إعادة تعيين",
  "source.assign": "تخصيص مصدر",
};

type Overview = {
  total: number; active: number; paying: number; with_domain: number;
  by_status: Record<string, number>; by_plan: Record<string, number>; by_type: Record<string, number>;
  recent_audit: any[];
};
type Org = { id: string; name: string; plan: string; org_type?: string; status?: string; domain?: string; created_at?: string };

export default function PlatformDashboardView() {
  const [ov, setOv] = useState<Overview | null>(null);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiGet("/api/orgs/overview").catch(() => null),
      apiGet("/api/orgs").catch(() => null),
    ]).then(([o, list]) => {
      setOv(o);
      setOrgs(Array.isArray(list?.orgs) ? list.orgs : []);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <span className="muted" style={{ fontSize: 12 }}>…تحميل</span>;
  if (!ov) return <div className="cbox" style={{ borderInlineStart: "4px solid #f59e0b" }}>تحتاج صلاحية مشرف منصّة، أو طبّق هجرات المؤسسات.</div>;

  return (
    <div>
      <h2 style={{ margin: 0 }}>لوحة المنصّة</h2>
      <p className="muted">نظرة شاملة على كل العملاء — الأعداد، الباقات، القطاعات، والنشاط الأخير.</p>

      {/* stat tiles */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10, marginBottom: 16 }}>
        <Stat label="إجمالي العملاء" value={ov.total} />
        <Stat label="نشط" value={ov.active} />
        <Stat label="مدفوع" value={ov.paying} />
        <Stat label="بنطاق مخصّص" value={ov.with_domain} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12, marginBottom: 16 }}>
        <Breakdown title="حسب الباقة" data={ov.by_plan} labels={PLAN_AR} />
        <Breakdown title="حسب القطاع" data={ov.by_type} labels={ORG_TYPE_AR} />
        <Breakdown title="حسب الحالة" data={ov.by_status} labels={STATUS_AR} />
      </div>

      {/* clients table */}
      <div className="cbox" style={{ marginBottom: 16 }}>
        <h4 style={{ marginTop: 0 }}>العملاء ({orgs.length})</h4>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: "right", color: "var(--muted)", fontSize: 12 }}>
                <th style={{ padding: "6px 8px" }}>المؤسسة</th>
                <th style={{ padding: "6px 8px" }}>القطاع</th>
                <th style={{ padding: "6px 8px" }}>الباقة</th>
                <th style={{ padding: "6px 8px" }}>الحالة</th>
                <th style={{ padding: "6px 8px" }}>النطاق</th>
              </tr>
            </thead>
            <tbody>
              {orgs.map((o) => (
                <tr key={o.id} style={{ borderTop: "1px solid var(--line)" }}>
                  <td style={{ padding: "6px 8px", fontWeight: 700 }}>{o.name}</td>
                  <td style={{ padding: "6px 8px" }}>{ORG_TYPE_AR[o.org_type || "general"] || o.org_type || "—"}</td>
                  <td style={{ padding: "6px 8px" }}>{PLAN_AR[o.plan] || o.plan}</td>
                  <td style={{ padding: "6px 8px" }}>
                    <span className="chip" style={{ fontSize: 11, color: o.status === "suspended" ? "#f87171" : undefined }}>{STATUS_AR[o.status || "active"] || o.status}</span>
                  </td>
                  <td style={{ padding: "6px 8px", direction: "ltr", textAlign: "right", color: o.domain ? undefined : "var(--muted)" }}>{o.domain || "—"}</td>
                </tr>
              ))}
              {orgs.length === 0 && <tr><td colSpan={5} style={{ padding: 10, color: "var(--muted)" }}>لا عملاء بعد — استخدم «معالج الإنشاء».</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* recent activity (audit) */}
      <div className="cbox">
        <h4 style={{ marginTop: 0 }}>النشاط الأخير</h4>
        {(!ov.recent_audit || ov.recent_audit.length === 0)
          ? <p className="muted" style={{ fontSize: 12 }}>لا نشاط مسجّل بعد.</p>
          : (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {ov.recent_audit.slice(0, 25).map((e, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "3px 0", borderBottom: "1px solid var(--line)" }}>
                  <span><b>{ACTION_AR[e.action] || e.action}</b>{e.actor_email && <span className="muted"> · {e.actor_email}</span>}</span>
                  <span className="muted" style={{ direction: "ltr" }}>{e.ts ? new Date(e.ts).toLocaleString("ar-IQ") : ""}</span>
                </div>
              ))}
            </div>
          )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="cbox" style={{ padding: 14 }}>
      <div style={{ fontSize: 28, fontWeight: 900, lineHeight: 1 }}>{value}</div>
      <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{label}</div>
    </div>
  );
}

function Breakdown({ title, data, labels }: { title: string; data: Record<string, number>; labels: Record<string, string> }) {
  const entries = Object.entries(data || {}).sort((a, b) => b[1] - a[1]);
  return (
    <div className="cbox">
      <h4 style={{ marginTop: 0, fontSize: 13 }}>{title}</h4>
      {entries.length === 0 ? <span className="muted" style={{ fontSize: 12 }}>—</span> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {entries.map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
              <span>{labels[k] || k}</span><b>{v}</b>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
