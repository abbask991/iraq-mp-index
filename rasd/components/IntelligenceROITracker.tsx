"use client";
import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";
import { useDemo } from "@/components/ui/DemoContext";
import { Icon, Stat, Badge } from "@/components/ui";

/**
 * Intelligence ROI Tracker — the value the platform delivered, for renewals and
 * institutional clients. Every headline count is REAL (alerts, evidence, campaigns
 * detected, cases recorded, tasks). "Analyst hours saved" is an explicit ESTIMATE
 * derived from those real counts and labelled as such — never presented as measured.
 */
const fmt = (n: number) => (n || 0).toLocaleString("en-US");

export default function IntelligenceROITracker({ period = "الفترة الحالية", compact }: { period?: string; compact?: boolean }) {
  const { demo } = useDemo();
  const [cc, setCc] = useState<any>(null);
  const [alerts, setAlerts] = useState<number | null>(null);
  const [cases, setCases] = useState<number | null>(null);
  const [tasks, setTasks] = useState<number>(0);
  const [usage, setUsage] = useState<any>(null);

  useEffect(() => {
    apiGet("/api/command-center" + (demo ? "?demo=1" : "")).then(setCc).catch(() => {});
    apiGet("/monitor/alerts-feed").then((r) => setAlerts((r?.alerts || []).length)).catch(() => setAlerts(null));
    apiGet("/api/intel-cases/list").then((r) => setCases((r?.cases || []).length)).catch(() => setCases(null));
    apiGet("/api/usage/summary?since_days=30").then(setUsage).catch(() => setUsage(null));
    try { setTasks(JSON.parse(localStorage.getItem("rasd_tasks") || "[]").length); } catch { /* ignore */ }
  }, [demo]);

  const uc = usage?.counts || {};
  const reportsGen = uc.report_generated || 0;
  const evidenceOpened = uc.evidence_opened || 0;
  const aiQuestions = uc.ai_question || 0;

  const evidence = cc?.coverage?.signals || 0;
  const campaigns = (cc?.active_campaigns || []).length;
  const earlyWarn = (cc?.top_risks || []).filter((r: any) => /حرج|مرتفع/.test(r.level || "")).length;
  // ESTIMATE only — a transparent heuristic on the real counts above.
  const hours = Math.round(evidence / 1000 * 2 + (alerts || 0) * 0.3 + campaigns * 3 + (cases || 0) * 1.5 + tasks * 0.5 + reportsGen * 0.8 + aiQuestions * 0.2);

  const summary = `خلال ${period}: ${fmt(alerts || 0)} تنبيهاً، ${fmt(earlyWarn)} إشارة إنذار مبكر، ${fmt(campaigns)} حملة مرصودة، و${fmt(evidence)} إشارة مجموعة.`;

  if (compact) {
    return (
      <div className="cbox" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <Icon name="bolt" size={15} /><b style={{ fontSize: 13.5 }}>القيمة المُقدَّمة</b>
        <span className="u-fine">{fmt(alerts || 0)} تنبيه · {fmt(campaigns)} حملة · {fmt(evidence)} دليل · ~{fmt(hours)} ساعة عمل مُوفَّرة (تقديري)</span>
      </div>
    );
  }

  return (
    <div className="cbox">
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <Icon name="bolt" size={15} /><h4 style={{ margin: 0 }}>عائد القيمة الاستخباراتية</h4>
      </div>
      <div className="u-stats" style={{ marginBottom: 10 }}>
        {alerts != null && <Stat label="تنبيهات مُولَّدة" icon="siren" value={fmt(alerts)} />}
        <Stat label="إنذار مبكر" icon="alert" value={fmt(earlyWarn)} />
        <Stat label="حملات مرصودة" icon="megaphone" value={fmt(campaigns)} />
        <Stat label="أدلّة مجموعة" icon="clip" value={fmt(evidence)} />
        {cases != null && <Stat label="حالات مرجعية" icon="refresh" value={fmt(cases)} />}
        <Stat label="مهام تشغيلية" icon="check" value={fmt(tasks)} />
        {usage && <Stat label="تقارير مولّدة" icon="clip" value={fmt(reportsGen)} meta="آخر ٣٠ يوم" />}
        {usage && <Stat label="أدلّة مفتوحة" icon="brain" value={fmt(evidenceOpened)} meta="آخر ٣٠ يوم" />}
        {usage && <Stat label="أسئلة المحلّل" icon="target" value={fmt(aiQuestions)} meta="آخر ٣٠ يوم" />}
        <Stat label="ساعات عمل مُوفَّرة" icon="brain" value={`~${fmt(hours)}`} meta="تقديري" />
      </div>
      <div className="cbox" style={{ borderInlineStart: "3px solid var(--accent)", fontSize: 13.5, lineHeight: 1.9 }}>{summary}</div>
      <p className="u-fine" style={{ marginTop: 8 }}>الأرقام مقيسة فعلاً — بما فيها التقارير المولّدة والأدلّة المفتوحة وأسئلة المحلّل من سجلّ الاستخدام. «ساعات العمل المُوفَّرة» وحدها تقدير شفّاف مبني عليها. <Badge t="warn">تقديري</Badge></p>
    </div>
  );
}
