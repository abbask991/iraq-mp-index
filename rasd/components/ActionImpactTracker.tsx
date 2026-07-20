"use client";
import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";
import { useDemo } from "@/components/ui/DemoContext";
import { Icon, Badge } from "@/components/ui";

/**
 * Before / After Action Impact — did a client response change the situation?
 * Honest by construction: when the analyst logs an action NOW, the current metrics
 * are captured as a real baseline; later the same metrics are read again and the
 * delta is the actual measured change between two real time points. It states
 * plainly that this is correlation, not proven causation.
 *
 * Baselines persist client-side. Metrics come from the tenant command-center +
 * public-anger, so both readings are real.
 */
type Snap = { anger?: number; crisis?: number; political?: number };
type Action = { id: string; label: string; at: number; base: Snap };
const LS = "rasd_actions";
const read = (): Action[] => { try { return JSON.parse(localStorage.getItem(LS) || "[]"); } catch { return []; } };
const write = (a: Action[]) => { try { localStorage.setItem(LS, JSON.stringify(a)); } catch { /* ignore */ } };

function ago(ms: number) {
  const h = (Date.now() - ms) / 3600000;
  if (h < 1) return `قبل ${Math.max(1, Math.round(h * 60))} دقيقة`;
  if (h < 24) return `قبل ${Math.round(h)} ساعة`;
  return `قبل ${Math.round(h / 24)} يوم`;
}

export default function ActionImpactTracker({ d, anger }: { d?: any; anger?: any }) {
  const { demo } = useDemo();
  const [cc, setCc] = useState<any>(d || null);
  const [ang, setAng] = useState<any>(anger || null);
  const [actions, setActions] = useState<Action[]>([]);
  const [label, setLabel] = useState("");

  useEffect(() => { setActions(read()); }, []);
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

  const now: Snap = { anger: ang?.score, crisis: cc?.national_risk?.crisis, political: cc?.national_risk?.political };
  const log = () => {
    if (!label.trim()) return;
    const a: Action = { id: "a" + (actions.length + 1), label: label.trim(), at: Date.now(), base: now };
    const next = [a, ...actions]; setActions(next); write(next); setLabel("");
  };
  const remove = (id: string) => { const n = actions.filter((a) => a.id !== id); setActions(n); write(n); };

  const metric = (k: keyof Snap, ar: string, goodIsDown: boolean, base?: number, cur?: number) => {
    if (base == null || cur == null) return null;
    const delta = cur - base;
    const better = goodIsDown ? delta < 0 : delta > 0;
    const col = delta === 0 ? "var(--muted)" : better ? "#22c55e" : "#f43f5e";
    return (
      <span key={k} style={{ fontSize: 12.5, marginInlineEnd: 12 }}>
        {ar}: <b className="u-num">{base}</b> <Icon name="expand" size={10} /> <b className="u-num">{cur}</b>
        <span className="u-num" style={{ color: col, marginInlineStart: 4 }}>{delta > 0 ? "+" : ""}{delta}{delta !== 0 ? (better ? " ✓" : " ⚠") : ""}</span>
      </span>
    );
  };

  return (
    <div className="cbox">
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <Icon name="refresh" size={15} /><h4 style={{ margin: 0 }}>أثر الإجراء (قبل / بعد)</h4>
      </div>
      <p className="muted" style={{ fontSize: 12.5, marginTop: 0 }}>سجّل إجراءً الآن ليُلتقط الأساس، ثم قِس التغيّر لاحقاً — ارتباط لا سببية مؤكّدة.</p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        <input placeholder="الإجراء المتّخذ (مثال: إصدار توضيح رسمي)" value={label} onChange={(e) => setLabel(e.target.value)} onKeyDown={(e) => e.key === "Enter" && log()} style={{ flex: 1, minWidth: 200 }} />
        <button className="btn" onClick={log} disabled={!label.trim() || now.anger == null}>سجّل الأساس الآن</button>
      </div>

      {actions.length === 0 && <p className="u-fine" style={{ margin: 0 }}>لا إجراءات مسجّلة — سجّل إجراءً لبدء قياس أثره.</p>}
      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {actions.map((a) => {
          const fresh = Date.now() - a.at < 3600000; // < 1h → too early to judge
          return (
            <div key={a.id} style={{ padding: "8px 10px", border: "1px solid var(--line)", borderRadius: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <b style={{ fontSize: 13.5 }}>{a.label}</b>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <span className="u-fine">{ago(a.at)}</span>
                  <button className="reco-b reco-x" title="حذف" onClick={() => remove(a.id)}>×</button>
                </div>
              </div>
              <div style={{ marginTop: 4 }}>
                {metric("anger", "الغضب", true, a.base.anger, now.anger)}
                {metric("crisis", "الأزمة", true, a.base.crisis, now.crisis)}
                {metric("political", "سياسي", true, a.base.political, now.political)}
              </div>
              {fresh && <div className="u-fine" style={{ marginTop: 3 }}>مبكّر على الحكم — أعِد القياس بعد ساعات.</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
