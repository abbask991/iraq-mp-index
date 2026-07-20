"use client";
import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";
import { useDemo } from "@/components/ui/DemoContext";
import Gauge from "@/components/Gauge";
import { Icon, Badge, type Tone } from "@/components/ui";

/**
 * Intelligence Readiness Score — is there enough evidence to decide, or should we
 * collect more first? A composite of the real coverage the platform actually has:
 * evidence volume, platform diversity, source diversity, freshness, and the
 * anger-model confidence. Weights renormalize over present inputs. Sometimes the
 * honest answer is "needs more evidence" — this says so.
 */
const col = (v: number) => (v >= 75 ? "#22c55e" : v >= 55 ? "#f59e0b" : v >= 35 ? "#fb923c" : "#f43f5e");

function statusOf(score: number, review: boolean): { ar: string; tone: Tone } {
  if (review) return { ar: "يتطلّب مراجعة بشرية", tone: "warn" };
  if (score >= 80) return { ar: "جاهز للقرار", tone: "ok" };
  if (score >= 60) return { ar: "جاهز للمراقبة", tone: "ok" };
  if (score >= 40) return { ar: "يحتاج أدلّة إضافية", tone: "warn" };
  return { ar: "غير كافٍ للتصرّف بعد", tone: "danger" };
}

function ageHours(gen?: number) {
  if (!gen) return null;
  return Math.max(0, (Date.now() / 1000 - gen) / 3600);
}

export default function IntelligenceReadinessScore({ d, anger, compact }: { d?: any; anger?: any; compact?: boolean }) {
  const { demo } = useDemo();
  const [cc, setCc] = useState<any>(d || null);
  const [ang, setAng] = useState<any>(anger || null);

  useEffect(() => {
    if (d) { setCc(d); return; }
    apiGet("/api/command-center" + (demo ? "?demo=1" : "")).then(setCc).catch(() => setCc(null));
  }, [d, demo]);
  useEffect(() => {
    if (anger != null) { setAng(anger); return; }
    if (d) return;
    const q = `scope_type=country&scope_id=${encodeURIComponent("العراق")}&scope_name=${encodeURIComponent("العراق")}&period=week${demo ? "&demo=1" : ""}`;
    apiGet(`/api/indices/public-anger?${q}`).then(setAng).catch(() => setAng(null));
  }, [anger, d, demo]);

  if (!cc) return null;
  const cov = cc.coverage || {};
  const parts: { label: string; v: number; w: number }[] = [];
  if (cov.signals != null) parts.push({ label: "حجم الأدلّة", v: Math.min(100, Math.round((cov.signals / 5000) * 100)), w: 0.3 });
  const platforms = (cc.platform_activity || []).length;
  if (platforms > 0) parts.push({ label: "تنوّع المنصّات", v: Math.min(100, platforms * 33), w: 0.25 });
  if (cov.sources != null) parts.push({ label: "تنوّع المصادر", v: Math.min(100, Math.round((cov.sources / 40) * 100)), w: 0.2 });
  const age = ageHours(cc.generated_at);
  if (age != null) parts.push({ label: "حداثة البيانات", v: age <= 3 ? 100 : age <= 6 ? 80 : age <= 24 ? 55 : 25, w: 0.1 });
  if (ang?.confidence_score != null) parts.push({ label: "ثقة النموذج", v: ang.confidence_score, w: 0.15 });
  if (!parts.length) return null;

  const wsum = parts.reduce((a, p) => a + p.w, 0) || 1;
  const score = Math.round(parts.reduce((a, p) => a + p.w * p.v, 0) / wsum);
  const review = !!ang?.needs_review || score < 40;
  const st = statusOf(score, review);
  const missing = parts.filter((p) => p.v < 45).map((p) => p.label);

  if (compact) {
    return (
      <div className="cbox" style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <Gauge value={score} size={58} stroke={7} color={col(score)} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 13.5, display: "flex", alignItems: "center", gap: 8 }}>جاهزية اتخاذ القرار <Badge t={st.tone} dot>{st.ar}</Badge></div>
          <div className="u-fine">{missing.length ? `ينقص: ${missing.join("، ")}` : "التغطية كافية عبر الأبعاد المقيسة."}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="cbox">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontWeight: 700, fontSize: 14, display: "inline-flex", alignItems: "center", gap: 7 }}><Icon name="check" size={15} /> جاهزية القرار الاستخباراتي</span>
        <Badge t={st.tone} dot>{st.ar}</Badge>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
        <Gauge value={score} size={120} stroke={11} color={col(score)} sub="الجاهزية" />
        <div style={{ flex: 1, minWidth: 220 }}>
          {parts.map((p) => (
            <div key={p.label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, padding: "3px 0" }}>
              <span style={{ flex: 1 }}>{p.label}</span>
              <span style={{ flex: "0 0 110px", height: 6, background: "var(--line)", borderRadius: 4, overflow: "hidden" }}><i style={{ display: "block", height: "100%", width: `${p.v}%`, background: col(p.v) }} /></span>
              <span className="u-num" style={{ minWidth: 28, textAlign: "left" }}>{p.v}</span>
            </div>
          ))}
        </div>
      </div>
      {missing.length > 0 && <p className="u-fine" style={{ marginTop: 8 }}>الخطوة التالية: عزّز {missing.join("، ")} قبل قرار حاسم.</p>}
      <p className="u-fine" style={{ marginTop: 6 }}>مؤشّر مركّب لكفاية الأدلّة — أحياناً القرار الصحيح هو «اجمع أدلّة أكثر» لا «تصرّف الآن».</p>
    </div>
  );
}
