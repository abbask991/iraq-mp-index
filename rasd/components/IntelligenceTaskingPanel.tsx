"use client";
import { useEffect, useState } from "react";
import { Icon, Badge, type Tone } from "@/components/ui";

/**
 * Intelligence Tasking — turn an insight into a tracked task, so the platform is
 * an operational workflow, not passive monitoring. Tasks persist client-side.
 * `seed` lets a card elsewhere pre-open the form linked to a specific insight.
 */
export type Task = {
  id: string; title: string; type: string; priority: "high" | "medium" | "low";
  due: string; linked: string; status: "new" | "in_progress" | "completed" | "dismissed"; created: number;
};
const TYPES: [string, string][] = [
  ["monitor", "مراقبة قضية"], ["verify", "تحقّق من ادّعاء"], ["collect", "جمع أدلّة إضافية"],
  ["report", "توليد تقرير"], ["review_campaign", "مراجعة حملة مشبوهة"], ["track_entity", "تتبّع كيان"],
  ["monitor_platform", "مراقبة منصّة"], ["prepare_brief", "إعداد موجز ردّ"], ["human_review", "مراجعة بشرية"], ["escalate", "تصعيد للإدارة"],
];
const PRIO: Record<string, { ar: string; tone: Tone }> = { high: { ar: "عاجل", tone: "danger" }, medium: { ar: "متوسط", tone: "warn" }, low: { ar: "منخفض", tone: "ok" } };
const ST: Record<string, { ar: string; tone: Tone }> = { new: { ar: "جديدة", tone: "info" }, in_progress: { ar: "قيد التنفيذ", tone: "warn" }, completed: { ar: "منجزة", tone: "ok" }, dismissed: { ar: "متجاهَلة", tone: "neutral" } };
const LS = "rasd_tasks";
const read = (): Task[] => { try { return JSON.parse(localStorage.getItem(LS) || "[]"); } catch { return []; } };
const write = (t: Task[]) => { try { localStorage.setItem(LS, JSON.stringify(t)); } catch { /* ignore */ } };

export default function IntelligenceTaskingPanel({ seedTitle, seedLinked }: { seedTitle?: string; seedLinked?: string }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [form, setForm] = useState({ title: seedTitle || "", type: "monitor", priority: "medium" as Task["priority"], due: "", linked: seedLinked || "" });
  const [filter, setFilter] = useState<"open" | "all">("open");

  useEffect(() => { setTasks(read()); }, []);
  const save = (next: Task[]) => { setTasks(next); write(next); };

  const add = () => {
    if (!form.title.trim()) return;
    const t: Task = { id: "t" + (tasks.length + 1) + "_" + form.title.slice(0, 4), title: form.title.trim(), type: form.type, priority: form.priority, due: form.due, linked: form.linked, status: "new", created: 0 };
    save([t, ...tasks]);
    setForm({ title: "", type: "monitor", priority: "medium", due: "", linked: "" });
  };
  const setStatus = (id: string, status: Task["status"]) => save(tasks.map((t) => (t.id === id ? { ...t, status } : t)));

  const visible = tasks.filter((t) => (filter === "all" ? true : t.status === "new" || t.status === "in_progress"));
  const typeAr = (k: string) => TYPES.find((x) => x[0] === k)?.[1] || k;
  const lbl = { display: "flex", flexDirection: "column" as const, gap: 3, fontSize: 12 };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <div>
          <h2 style={{ margin: 0 }}>مهام الاستخبارات</h2>
          <p className="muted" style={{ marginTop: 4 }}>حوّل الرؤية إلى إجراء متتبَّع — من الرصد السلبي إلى سير عمل تشغيلي.</p>
        </div>
        <div className="auth-tabs" style={{ maxWidth: 220 }}>
          <button className={filter === "open" ? "on" : ""} onClick={() => setFilter("open")}>المفتوحة</button>
          <button className={filter === "all" ? "on" : ""} onClick={() => setFilter("all")}>الكل ({tasks.length})</button>
        </div>
      </div>

      {/* add task */}
      <div className="cbox" style={{ margin: "12px 0", display: "grid", gap: 10 }}>
        <input placeholder="عنوان المهمة (مثال: تحقّق من مصدر ادّعاء فساد الكهرباء)" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} onKeyDown={(e) => e.key === "Enter" && add()} />
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <label style={lbl}><span className="muted">النوع</span><select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>{TYPES.map(([k, ar]) => <option key={k} value={k}>{ar}</option>)}</select></label>
          <label style={lbl}><span className="muted">الأولوية</span><select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as Task["priority"] })}><option value="high">عاجل</option><option value="medium">متوسط</option><option value="low">منخفض</option></select></label>
          <label style={lbl}><span className="muted">الاستحقاق</span><input type="date" value={form.due} onChange={(e) => setForm({ ...form, due: e.target.value })} style={{ width: 150 }} /></label>
          <button className="btn" style={{ alignSelf: "flex-end" }} onClick={add}>أضِف مهمة</button>
        </div>
        {form.linked && <div className="u-fine">مرتبطة بـ: {form.linked}</div>}
      </div>

      {visible.length === 0 && <p className="muted" style={{ fontSize: 13 }}>لا مهام {filter === "open" ? "مفتوحة" : ""} — أضِف مهمة أو حوّل توصية إلى مهمة.</p>}
      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {visible.map((t) => (
          <div key={t.id} className="cbox" style={{ display: "flex", gap: 10, alignItems: "flex-start", opacity: t.status === "completed" ? 0.6 : 1 }}>
            <Badge t={PRIO[t.priority].tone} dot>{PRIO[t.priority].ar}</Badge>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 13.5 }}>{t.title}</div>
              <div className="u-fine">{typeAr(t.type)}{t.due ? ` · يُنجز ${t.due}` : ""}{t.linked ? ` · ${t.linked}` : ""} · <Badge t={ST[t.status].tone}>{ST[t.status].ar}</Badge></div>
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              {t.status === "new" && <button className="reco-b" title="بدء" onClick={() => setStatus(t.id, "in_progress")}><Icon name="bolt" size={13} /></button>}
              {t.status === "in_progress" && <button className="reco-b" title="إنجاز" onClick={() => setStatus(t.id, "completed")}><Icon name="check" size={13} /></button>}
              {t.status !== "completed" && <button className="reco-b reco-x" title="تجاهل" onClick={() => setStatus(t.id, "dismissed")}>×</button>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
