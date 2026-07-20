"use client";
import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";
import { Icon, Badge, Stat } from "@/components/ui";
import { CLIENT_TYPES, clientType } from "@/lib/workspace";
import { buildMattersItems } from "@/components/WhatMattersNow";
import ReportGenerationButtons from "@/components/ReportGenerationButtons";

/**
 * Pilot Mode — a sales/demo pilot (7 or 14 days) for a named client. The config
 * persists client-side. The dashboard is HONEST about measurement: days-remaining,
 * signals, alerts and evidence are real (from the tenant command-center + alert
 * feed); "insights" is the count of ranked priority items derived from that data;
 * metrics that need a per-pilot event log we don't keep (reports generated over
 * the pilot) are labelled "قيد التتبّع" rather than shown as a fake number.
 */
type Pilot = {
  name: string; type: string; entities: string; issues: string;
  duration: number; startMs: number; dailyBrief: boolean; finalReport: boolean;
};
const LS = "rasd_pilot";
const readPilot = (): Pilot | null => { try { return JSON.parse(localStorage.getItem(LS) || "null"); } catch { return null; } };
const fmt = (n: number) => (n || 0).toLocaleString("en-US");

export default function PilotMode({ cc, anger }: { cc: any; anger?: any }) {
  const [pilot, setPilot] = useState<Pilot | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Pilot>({ name: "", type: "government", entities: "", issues: "", duration: 14, startMs: 0, dailyBrief: true, finalReport: true });
  const [alerts, setAlerts] = useState<number | null>(null);

  useEffect(() => { const p = readPilot(); setPilot(p); if (p) setForm(p); else setEditing(true); }, []);
  useEffect(() => { apiGet("/monitor/alerts-feed").then((r) => setAlerts((r?.alerts || []).length)).catch(() => setAlerts(null)); }, []);

  const save = () => {
    const p = { ...form, startMs: pilot?.startMs || Date.now() };
    try { localStorage.setItem(LS, JSON.stringify(p)); } catch { /* ignore */ }
    setPilot(p); setEditing(false);
  };
  const reset = () => { try { localStorage.removeItem(LS); } catch { /* ignore */ } setPilot(null); setEditing(true); };

  // ---- setup form ----
  if (editing) {
    const lbl = { display: "flex", flexDirection: "column" as const, gap: 4, fontSize: 12 };
    return (
      <div className="cbox" style={{ maxWidth: 640, display: "grid", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}><Icon name="rocket" size={16} /><b>إعداد تجربة (Pilot)</b></div>
        <label style={lbl}><span className="muted">اسم العميل</span>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="مثال: وزارة X / شركة Y / مركز Z" /></label>
        <label style={lbl}><span className="muted">نوع العميل</span>
          <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            {CLIENT_TYPES.map((c) => <option key={c.key} value={c.key}>{c.ar}</option>)}
          </select></label>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <label style={{ ...lbl, flex: 1, minWidth: 180 }}><span className="muted">كيانات مرصودة (٣–٥، سطر لكل واحد)</span>
            <textarea rows={3} value={form.entities} onChange={(e) => setForm({ ...form, entities: e.target.value })} style={{ fontFamily: "inherit", fontSize: 13 }} /></label>
          <label style={{ ...lbl, flex: 1, minWidth: 180 }}><span className="muted">قضايا مرصودة (٣–٥، سطر لكل واحد)</span>
            <textarea rows={3} value={form.issues} onChange={(e) => setForm({ ...form, issues: e.target.value })} style={{ fontFamily: "inherit", fontSize: 13 }} /></label>
        </div>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
          <label style={{ ...lbl, width: 120 }}><span className="muted">المدّة</span>
            <select value={form.duration} onChange={(e) => setForm({ ...form, duration: Number(e.target.value) })}>
              <option value={7}>٧ أيام</option><option value={14}>١٤ يوم</option>
            </select></label>
          <label className="muted" style={{ fontSize: 12, display: "flex", gap: 6, alignItems: "center" }}>
            <input type="checkbox" checked={form.dailyBrief} onChange={(e) => setForm({ ...form, dailyBrief: e.target.checked })} style={{ width: "auto" }} /> موجز يومي</label>
          <label className="muted" style={{ fontSize: 12, display: "flex", gap: 6, alignItems: "center" }}>
            <input type="checkbox" checked={form.finalReport} onChange={(e) => setForm({ ...form, finalReport: e.target.checked })} style={{ width: "auto" }} /> تقرير ختامي</label>
        </div>
        <div><button className="btn" onClick={save} disabled={!form.name.trim()}>{pilot ? "حفظ التعديلات" : "ابدأ التجربة"}</button></div>
      </div>
    );
  }

  if (!pilot) return null;
  // ---- pilot dashboard ----
  const daysElapsed = Math.floor((Date.now() - pilot.startMs) / 86400000);
  const daysLeft = Math.max(0, pilot.duration - daysElapsed);
  const cfg = clientType(pilot.type);
  const signals = cc?.coverage?.signals;
  const insights = cc ? buildMattersItems(cc, anger).length : 0;
  const topValue = cc ? (buildMattersItems(cc, anger)[0]?.title) : null;
  const pct = Math.min(100, Math.round((daysElapsed / pilot.duration) * 100));

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Icon name="rocket" size={16} />
          <b style={{ fontSize: 15 }}>تجربة: {pilot.name}</b>
          {cfg && <Badge t="info">{cfg.ar}</Badge>}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button className="btn ghost" style={{ fontSize: 12 }} onClick={() => setEditing(true)}>تعديل</button>
          <button className="btn ghost" style={{ fontSize: 12 }} onClick={reset}>إنهاء</button>
        </div>
      </div>

      {/* countdown */}
      <div className="cbox" style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <b>{daysLeft > 0 ? `باقٍ ${daysLeft} يوم من ${pilot.duration}` : "انتهت مدّة التجربة"}</b>
          <span className="muted" style={{ fontSize: 12 }}>اليوم {Math.min(daysElapsed + 1, pilot.duration)} / {pilot.duration}</span>
        </div>
        <div style={{ height: 8, borderRadius: 5, background: "var(--line)", overflow: "hidden" }}>
          <div style={{ width: `${pct}%`, height: "100%", background: "var(--accent)" }} />
        </div>
      </div>

      {/* honest metrics */}
      <div className="u-stats" style={{ marginBottom: 14 }}>
        {signals != null && <Stat label="إشارات مجموعة" icon="clip" value={fmt(signals)} />}
        {alerts != null && <Stat label="تنبيهات" icon="siren" value={fmt(alerts)} />}
        {signals != null && <Stat label="أدلّة متاحة" icon="brain" value={fmt(signals)} meta="ضمن المخزون" />}
        <Stat label="مؤشرات أولوية" icon="target" value={fmt(insights)} meta="ما يهمّك الآن" />
        <Stat label="أنواع تقارير مفعّلة" icon="clip" value={cfg?.reports.length || 0} />
        <Stat label="تقارير مولّدة" icon="refresh" value="قيد التتبّع" meta="يتطلّب سجلّ أحداث للتجربة" />
      </div>

      {topValue && (
        <div className="cbox" style={{ marginBottom: 14, borderInlineStart: "4px solid var(--accent)" }}>
          <div className="muted" style={{ fontSize: 12 }}>أبرز قيمة حتى الآن</div>
          <div style={{ fontSize: 15, fontWeight: 700, marginTop: 2 }}>{topValue}</div>
        </div>
      )}

      <div className="cbox">
        <h4 style={{ marginTop: 0 }}><Icon name="clip" size={14} /> مخرجات التجربة</h4>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
          {pilot.dailyBrief && <Badge t="ok" dot>موجز يومي مفعّل</Badge>}
          {pilot.finalReport && <Badge t="ok" dot>تقرير ختامي مفعّل</Badge>}
        </div>
        <ReportGenerationButtons only={pilot.finalReport ? ["executive", ...(cfg?.reports.filter((r) => r !== "executive").slice(0, 3) || [])] as any : cfg?.reports}
          title="ولّد تقرير التجربة" />
      </div>

      <p className="muted" style={{ fontSize: 11, marginTop: 12 }}>
        الأرقام الحيّة (الإشارات، التنبيهات، المؤشرات) من صورة مؤسستك الفعلية. «تقارير مولّدة» تتطلّب سجلّ أحداث خاصاً بالتجربة — غير مُحتسب بعد بدل عرض رقم غير حقيقي.
      </p>
    </div>
  );
}
