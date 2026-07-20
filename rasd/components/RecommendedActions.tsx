"use client";
import { useEffect, useState } from "react";
import { Icon, Badge, type Tone, type IconName } from "@/components/ui";

/**
 * Recommended Actions — a structured recommendation layer. Items are built from
 * real structured signals (risks, anger drivers, campaign findings), never from
 * free AI speculation. The analyst can accept / dismiss / complete each; state
 * persists client-side (localStorage) so a workspace remembers its decisions.
 */
export type RecoType =
  | "monitor" | "verify" | "escalate" | "prepare_statement" | "generate_report"
  | "contact_media" | "counter_narrative" | "investigate_source" | "watch_entity"
  | "watch_platform" | "human_review";
export type Reco = {
  id: string;
  title: string;
  type: RecoType;
  priority?: "high" | "medium" | "low";
  reason?: string;
  confidence?: number;   // 0–100
  href?: string;
};
type Status = "new" | "accepted" | "dismissed" | "completed";

const TYPE_AR: Record<RecoType, { ar: string; icon: IconName }> = {
  monitor: { ar: "مراقبة", icon: "target" },
  verify: { ar: "تحقّق", icon: "check" },
  escalate: { ar: "تصعيد", icon: "siren" },
  prepare_statement: { ar: "إعداد بيان", icon: "clip" },
  generate_report: { ar: "توليد تقرير", icon: "clip" },
  contact_media: { ar: "تواصل إعلامي", icon: "megaphone" },
  counter_narrative: { ar: "سردية مضادّة", icon: "refresh" },
  investigate_source: { ar: "تقصّي المصدر", icon: "network" },
  watch_entity: { ar: "مراقبة كيان", icon: "target" },
  watch_platform: { ar: "مراقبة منصّة", icon: "network" },
  human_review: { ar: "مراجعة بشرية", icon: "brain" },
};
const PRIO: Record<string, { ar: string; tone: Tone }> = {
  high: { ar: "عاجل", tone: "danger" }, medium: { ar: "متوسط", tone: "warn" }, low: { ar: "منخفض", tone: "ok" },
};
const LS = "rasd_reco_status";
const readAll = (): Record<string, Status> => { try { return JSON.parse(localStorage.getItem(LS) || "{}"); } catch { return {}; } };

export default function RecommendedActions({ actions, title = "إجراءات موصى بها" }: { actions: Reco[]; title?: string }) {
  const [status, setStatus] = useState<Record<string, Status>>({});
  useEffect(() => { setStatus(readAll()); }, []);
  const set = (id: string, s: Status) => {
    setStatus((prev) => { const next = { ...prev, [id]: s }; try { localStorage.setItem(LS, JSON.stringify(next)); } catch { /* ignore */ } return next; });
  };
  if (!actions.length) return null;
  const visible = actions.filter((a) => status[a.id] !== "dismissed");
  const openCount = visible.filter((a) => (status[a.id] || "new") === "new").length;

  return (
    <div className="reco">
      <div className="reco-head">
        <span className="reco-title"><Icon name="check" size={14} /> {title}</span>
        {openCount > 0 && <Badge t="warn">{openCount} مفتوحة</Badge>}
      </div>
      {visible.length === 0 && <p className="u-fine" style={{ margin: 0 }}>لا إجراءات مفتوحة — عولجت كلّها.</p>}
      <div className="reco-list">
        {visible.map((a) => {
          const st = status[a.id] || "new";
          const meta = TYPE_AR[a.type] || TYPE_AR.monitor;
          const prio = a.priority ? PRIO[a.priority] : null;
          return (
            <div className={"reco-item" + (st === "completed" ? " done" : "")} key={a.id}>
              <span className="reco-ic"><Icon name={meta.icon} size={15} /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="reco-item-h">
                  {prio && <Badge t={prio.tone} dot>{prio.ar}</Badge>}
                  <b>{a.title}</b>
                  <span className="u-fine">{meta.ar}</span>
                  {st === "accepted" && <Badge t="info">مقبولة</Badge>}
                  {st === "completed" && <Badge t="ok">منجزة</Badge>}
                </div>
                {a.reason && <div className="u-fine">{a.reason}</div>}
              </div>
              <div className="reco-btns">
                {a.href && <a href={a.href} className="reco-b" title="افتح"><Icon name="expand" size={13} /></a>}
                {st === "new" && <button className="reco-b" title="قبول" onClick={() => set(a.id, "accepted")}><Icon name="check" size={13} /></button>}
                {st === "accepted" && <button className="reco-b" title="إنجاز" onClick={() => set(a.id, "completed")}><Icon name="check" size={13} /></button>}
                {st !== "completed" && <button className="reco-b reco-x" title="تجاهل" onClick={() => set(a.id, "dismissed")}>×</button>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
