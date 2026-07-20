"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { apiGet } from "@/lib/api";
import { useDemo } from "@/components/ui/DemoContext";
import Gauge from "@/components/Gauge";
import { Icon, Badge, type Tone } from "@/components/ui";

/**
 * Crisis Probability Meter — a COMPOSITE, probabilistic escalation estimate built
 * only from signals the pipeline really produces: the national crisis index, the
 * peak entity risk, the public-anger score, coordinated-campaign intensity, and
 * trend velocity. Weights renormalize over whatever signals are present, so a
 * missing input never silently deflates the score. It is labelled a composite
 * estimate (not a measured probability) and lists its drivers so it's explainable.
 *
 * `compact` renders the Command-Center summary card; full renders the Risk view.
 * Pass `d`/`anger` to reuse a page's payload, or omit to self-fetch.
 */
const riskColor = (v: number) => (v >= 70 ? "#f43f5e" : v >= 50 ? "#fb923c" : v >= 30 ? "#f59e0b" : "#22c55e");
const levelOf = (v: number): { ar: string; tone: Tone } =>
  v >= 70 ? { ar: "حرج", tone: "crit" } : v >= 50 ? { ar: "مرتفع", tone: "danger" } : v >= 30 ? { ar: "متوسط", tone: "warn" } : { ar: "منخفض", tone: "ok" };

type Driver = { label: string; value: number; weight: number };

function compute(d: any, anger: any): { prob: number; drivers: Driver[] } | null {
  if (!d) return null;
  const parts: Driver[] = [];
  const nr = d.national_risk || {};
  if (nr.crisis != null) parts.push({ label: "مؤشر الأزمة", value: Number(nr.crisis) || 0, weight: 0.35 });
  const peak = (d.top_risks || []).reduce((m: number, r: any) => Math.max(m, Number(r.risk) || 0), 0);
  if (peak > 0) parts.push({ label: "أعلى خطر كيان", value: peak, weight: 0.25 });
  if (anger?.score != null) parts.push({ label: "الغضب العام", value: Number(anger.score) || 0, weight: 0.2 });
  const coord = (d.active_campaigns || []).reduce((m: number, c: any) => Math.max(m, Number(c.coordination) || 0), 0);
  if (coord > 0) parts.push({ label: "تنسيق الحملات", value: coord, weight: 0.1 });
  const vel = (d.trending || []).reduce((m: number, t: any) => Math.max(m, Number(t.velocity) || 0), 0);
  if (vel > 0) parts.push({ label: "سرعة الترند", value: Math.min(100, vel), weight: 0.1 });
  if (!parts.length) return null;
  const wsum = parts.reduce((a, p) => a + p.weight, 0) || 1;
  const prob = Math.round(parts.reduce((a, p) => a + p.weight * p.value, 0) / wsum);
  const drivers = [...parts].sort((a, b) => b.weight * b.value - a.weight * a.value);
  return { prob, drivers };
}

export default function CrisisProbabilityMeter({ d, anger, compact }: { d?: any; anger?: any; compact?: boolean }) {
  const { demo } = useDemo();
  const [cc, setCc] = useState<any>(d || null);
  const [ang, setAng] = useState<any>(anger || null);

  useEffect(() => {
    if (d) { setCc(d); return; }
    apiGet("/api/command-center" + (demo ? "?demo=1" : "")).then(setCc).catch(() => setCc(null));
  }, [d, demo]);
  useEffect(() => {
    if (anger !== undefined && anger !== null) { setAng(anger); return; }
    if (d) return; // page owns the data
    const q = `scope_type=country&scope_id=${encodeURIComponent("العراق")}&scope_name=${encodeURIComponent("العراق")}&period=week${demo ? "&demo=1" : ""}`;
    apiGet(`/api/indices/public-anger?${q}`).then(setAng).catch(() => setAng(null));
  }, [anger, d, demo]);

  const res = compute(cc, ang);
  if (!res) return null;
  const { prob, drivers } = res;
  const lvl = levelOf(prob);

  if (compact) {
    return (
      <Link href="/monitor/risk" className="cpm cpm-compact" style={{ ["--pc" as any]: riskColor(prob) }}>
        <Gauge value={prob} size={64} stroke={7} color={riskColor(prob)} />
        <div style={{ flex: 1 }}>
          <div className="cpm-lead">احتمال تصعيد أزمة <Badge t={lvl.tone} dot>{lvl.ar}</Badge></div>
          <div className="u-fine">مؤشّر مركّب — المحرّك الأبرز: {drivers[0]?.label} ({drivers[0]?.value})</div>
        </div>
        <Icon name="expand" size={14} />
      </Link>
    );
  }

  return (
    <div className="cpm" style={{ ["--pc" as any]: riskColor(prob) }}>
      <div className="cpm-head">
        <span className="cpm-title"><Icon name="siren" size={15} /> مقياس احتمال الأزمة</span>
        <Badge t={lvl.tone} dot>{lvl.ar}</Badge>
      </div>
      <div className="cpm-main">
        <Gauge value={prob} size={132} stroke={11} color={riskColor(prob)} sub="احتمال التصعيد" />
        <div style={{ flex: 1, minWidth: 220 }}>
          <div className="u-fine" style={{ marginBottom: 6 }}>المحرّكات (وزن × قيمة) — مرتّبة حسب المساهمة</div>
          {drivers.map((dr) => (
            <div key={dr.label} className="cpm-driver">
              <span style={{ flex: 1 }}>{dr.label}</span>
              <span className="cpm-bar"><i style={{ width: `${dr.value}%`, background: riskColor(dr.value) }} /></span>
              <span className="u-num" style={{ minWidth: 30, textAlign: "left" }}>{dr.value}</span>
              <span className="u-fine" style={{ minWidth: 34, textAlign: "left" }}>{Math.round(dr.weight * 100)}%</span>
            </div>
          ))}
        </div>
      </div>
      <p className="u-fine" style={{ marginTop: 10 }}>
        مؤشّر مركّب احتمالي — يجمع مؤشر الأزمة، أعلى خطر كيان، الغضب العام، تنسيق الحملات، وسرعة الترند من بياناتك الفعلية.
        ليس احتمالاً مقيساً، ويتطلّب قراءة بشرية قبل أي قرار تصعيد.
      </p>
    </div>
  );
}
