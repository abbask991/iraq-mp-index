"use client";
import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";
import { useDemo } from "@/components/ui/DemoContext";
import Gauge from "@/components/Gauge";
import { Icon, Badge, type Tone } from "@/components/ui";

/**
 * Intelligence Maturity Score — is this workspace SET UP to produce reliable
 * intelligence? Distinct from the Readiness Score (which asks "enough evidence to
 * decide *this issue*"): maturity measures configuration completeness. Every input
 * is real — watchlist size, active platforms, source health, data volume — and
 * missing items are named so onboarding has a concrete next step.
 */
const col = (v: number) => (v >= 76 ? "#22c55e" : v >= 51 ? "#34d6c6" : v >= 26 ? "#f59e0b" : "#f43f5e");
function levelOf(v: number): { ar: string; tone: Tone } {
  if (v >= 76) return { ar: "جاهزية استخبارية استراتيجية", tone: "ok" };
  if (v >= 51) return { ar: "جاهزية استخبارية", tone: "ok" };
  if (v >= 26) return { ar: "رصد أساسي", tone: "warn" };
  return { ar: "غير جاهز", tone: "danger" };
}

export default function IntelligenceMaturityScore({ compact }: { compact?: boolean }) {
  const { demo } = useDemo();
  const [wl, setWl] = useState<any>(null);
  const [cc, setCc] = useState<any>(null);
  const [health, setHealth] = useState<any>(null);

  useEffect(() => {
    apiGet("/api/workspace/watchlist").then(setWl).catch(() => setWl(null));
    apiGet("/api/command-center" + (demo ? "?demo=1" : "")).then(setCc).catch(() => setCc(null));
    apiGet("/api/settings/health").then(setHealth).catch(() => setHealth(null));
  }, [demo]);

  if (!cc && !wl) return null;
  const w = wl?.watchlist || {};
  const entities = (w.entities || []).length + (w.brands || []).length;
  const issues = (w.keywords || []).length;
  const platforms = (cc?.platform_activity || []).length;
  const signals = cc?.coverage?.signals || 0;
  const crit = (health?.blockers || []).filter((b: any) => b.severity === "crit").length;
  const stale = (health?.metrics?.last_collection_age_hours || 0) > 48;

  const checks = [
    { label: "الكيانات المرصودة", ok: entities >= 3, part: Math.min(1, entities / 5), miss: `أضِف كيانات (${entities}/٥ على الأقل)`, rec: "أضِف مزيداً من الكيانات المرصودة" },
    { label: "القضايا المرصودة", ok: issues >= 3, part: Math.min(1, issues / 5), miss: `أضِف قضايا/كلمات (${issues})`, rec: "أضِف قضايا للمتابعة" },
    { label: "تنوّع المنصّات", ok: platforms >= 3, part: Math.min(1, platforms / 3), miss: "منصّات نشطة قليلة", rec: "فعِّل منصّات جمع إضافية" },
    { label: "حجم البيانات", ok: signals >= 1000, part: Math.min(1, signals / 3000), miss: "حجم بيانات منخفض", rec: "وسّع الرصد لبناء حجم كافٍ" },
    { label: "صحة المصادر", ok: crit === 0 && !stale, part: crit === 0 && !stale ? 1 : 0.3, miss: crit ? "معوّقات جمع حرجة" : stale ? "لا جمع حديث" : "", rec: "عالِج معوّقات الجمع في صحة المصادر" },
    { label: "خط أساس تاريخي (٣٠ يوم)", ok: signals >= 3000, part: Math.min(1, signals / 5000), miss: "لا خط أساس ٣٠ يوماً بعد", rec: "ابنِ خط أساس عبر ٣٠ يوماً من الرصد" },
  ];
  const weights = [0.2, 0.15, 0.2, 0.15, 0.15, 0.15];
  const score = Math.round(checks.reduce((a, c, i) => a + weights[i] * c.part, 0) * 100);
  const lvl = levelOf(score);
  const missing = checks.filter((c) => !c.ok).map((c) => c.miss).filter(Boolean);
  const recs = checks.filter((c) => !c.ok).map((c) => c.rec);

  if (compact) {
    return (
      <div className="cbox" style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <Gauge value={score} size={58} stroke={7} color={col(score)} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 13.5, display: "flex", alignItems: "center", gap: 8 }}>نضج المساحة <Badge t={lvl.tone} dot>{lvl.ar}</Badge></div>
          <div className="u-fine">{missing.length ? `ينقص: ${missing.slice(0, 2).join("، ")}` : "الإعداد مكتمل."}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="cbox">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontWeight: 700, fontSize: 14, display: "inline-flex", alignItems: "center", gap: 7 }}><Icon name="target" size={15} /> نضج الاستخبارات (جاهزية المساحة)</span>
        <Badge t={lvl.tone} dot>{lvl.ar}</Badge>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
        <Gauge value={score} size={120} stroke={11} color={col(score)} sub="النضج" />
        <div style={{ flex: 1, minWidth: 220 }}>
          {checks.map((c) => (
            <div key={c.label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, padding: "3px 0" }}>
              <Icon name={c.ok ? "check" : "alert"} size={13} />
              <span style={{ flex: 1, color: c.ok ? "var(--text)" : "var(--muted)" }}>{c.label}</span>
              <span style={{ flex: "0 0 90px", height: 6, background: "var(--line)", borderRadius: 4, overflow: "hidden" }}><i style={{ display: "block", height: "100%", width: `${Math.round(c.part * 100)}%`, background: col(c.part * 100) }} /></span>
            </div>
          ))}
        </div>
      </div>
      {recs.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <div className="u-fine" style={{ marginBottom: 4 }}>لرفع النضج:</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{recs.map((r, i) => <span key={i} className="chip" style={{ fontSize: 11 }}>{r}</span>)}</div>
        </div>
      )}
    </div>
  );
}
