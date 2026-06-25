"use client";
import { useEffect, useState } from "react";
import { apiGet, apiSend } from "@/lib/api";
import {
  Target, TargetType, getTargets, addTarget, removeTarget, setPrimary,
  COVERAGE_OPTIONS, getCoverage, setCoverage,
} from "@/lib/targets";

type Field = { key: string; label: string; type: string; value: any; default: any;
  options?: { v: any; l: string }[]; configured?: boolean; danger?: boolean; unit?: string };
type Cat = { category: string; label: string; icon: string; custom?: string; service?: string; fields: Field[] };

const DANGER = new Set(["data_delete", "delete_old_raw", "delete_old_alerts", "require_2fa", "admin_lock"]);

export default function Settings() {
  const [cats, setCats] = useState<Cat[]>([]);
  const [active, setActive] = useState("general");
  const [edits, setEdits] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const r = await apiGet("/api/settings").catch(() => null);
    setCats(r?.schema || []); setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const cat = cats.find((c) => c.category === active);
  const dirty = (k: string) => Object.prototype.hasOwnProperty.call(edits, `${active}.${k}`);
  const valOf = (f: Field) => (dirty(f.key) ? edits[`${active}.${f.key}`] : f.value);
  const setVal = (k: string, v: any) => setEdits((e) => ({ ...e, [`${active}.${k}`]: v }));

  const save = async () => {
    if (!cat) return;
    const changes: Record<string, any> = {};
    for (const f of cat.fields) if (dirty(f.key)) changes[f.key] = edits[`${active}.${f.key}`];
    if (!Object.keys(changes).length) { setSavedMsg("لا تغييرات"); setTimeout(() => setSavedMsg(""), 1500); return; }
    setSaving(true);
    const r = await apiSend("/api/settings", "PUT", { category: active, changes }).catch(() => null);
    setSaving(false);
    if (r && r.persisted) {
      setSavedMsg(`حُفظ ${r.saved} إعداد`);
      setEdits((e) => { const n = { ...e }; for (const k of Object.keys(changes)) delete n[`${active}.${k}`]; return n; });
      await load();
    } else if (r && (r.reason === "table_missing" || r.reason === "db_disabled")) {
      setSavedMsg("لم يُحفظ — جدول الإعدادات غير مُهيّأ بعد (شغّل migration 007). التغييرات تبقى محليّاً فقط.");
    } else setSavedMsg("تعذّر الحفظ");
    setTimeout(() => setSavedMsg(""), 5000);
  };

  const reset = async () => {
    if (!cat || !confirm(`إعادة ضبط «${cat.label}» إلى القيم الافتراضية؟`)) return;
    setSaving(true);
    await apiSend("/api/settings/reset", "POST", { category: active }).catch(() => null);
    setEdits((e) => { const n = { ...e }; Object.keys(n).forEach((k) => k.startsWith(active + ".") && delete n[k]); return n; });
    await load(); setSaving(false); setSavedMsg("أُعيد الضبط"); setTimeout(() => setSavedMsg(""), 2000);
  };

  return (
    <div>
      <h2 style={{ margin: 0 }}>مركز إعدادات النظام</h2>
      <p className="muted" style={{ marginTop: 4 }}>تحكّم كامل بالجمع، الذكاء، الإنذارات، المصادر، الباقة، والأداء — دون لمس الكود.</p>

      {loading && <p className="muted">جارٍ التحميل…</p>}

      {!loading && (
        <div style={{ display: "grid", gridTemplateColumns: "210px 1fr", gap: 16, marginTop: 14, alignItems: "start" }}>
          {/* tab rail */}
          <div className="cbox" style={{ padding: 6, position: "sticky", top: 70 }}>
            {cats.map((c) => (
              <button key={c.category} onClick={() => setActive(c.category)}
                style={{
                  display: "flex", gap: 8, width: "100%", textAlign: "start", padding: "8px 10px",
                  borderRadius: 8, border: 0, cursor: "pointer", fontSize: 13, marginBottom: 2,
                  background: active === c.category ? "var(--accent)" : "transparent",
                  color: active === c.category ? "#fff" : "var(--text)",
                }}>
                <span>{c.label}</span>
              </button>
            ))}
          </div>

          {/* panel */}
          <div className="cbox">
            {cat && (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                  <h3 style={{ margin: 0 }}>{cat.label}</h3>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    {savedMsg && <span className="muted" style={{ fontSize: 12 }}>{savedMsg}</span>}
                    {cat.service && <TestBtn service={cat.service} />}
                  </div>
                </div>

                {cat.custom === "entities" && <EntitiesPanel />}
                {cat.custom === "source_weights" && <SourceWeightsPanel />}
                {cat.custom === "users" && <UsersPanel />}
                {cat.custom === "system_health" && <HealthPanel />}
                {cat.custom === "audit" && <AuditPanel />}

                {!cat.custom && (
                  <>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 14, marginTop: 14 }}>
                      {cat.fields.map((f) => (
                        <FieldRow key={f.key} f={f} value={valOf(f)} dirty={dirty(f.key)} onChange={(v) => setVal(f.key, v)} />
                      ))}
                    </div>
                    <div style={{ display: "flex", gap: 8, marginTop: 18, borderTop: "1px solid var(--line)", paddingTop: 14 }}>
                      <button className="btn" onClick={save} disabled={saving}>{saving ? "جارٍ…" : "حفظ القسم"}</button>
                      <button className="btn ghost" onClick={reset} disabled={saving}>إعادة الافتراضي</button>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function FieldRow({ f, value, dirty, onChange }: { f: Field; value: any; dirty: boolean; onChange: (v: any) => void }) {
  const danger = f.danger || DANGER.has(f.key);
  const lbl = (
    <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 4 }}>
      {f.label} {dirty && <span style={{ color: "#fb923c" }}>•</span>}
      {danger && <span className="chip" style={{ color: "#f43f5e", fontSize: 10, marginInlineStart: 4 }}>حسّاس</span>}
    </label>
  );
  if (f.type === "toggle")
    return (
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <label style={{ fontSize: 13, fontWeight: 600 }}>{f.label} {dirty && <span style={{ color: "#fb923c" }}>•</span>}</label>
        <button onClick={() => { if (danger && !value && !confirm(`تفعيل «${f.label}» — متأكد؟`)) return; onChange(!value); }}
          style={{ width: 44, height: 24, borderRadius: 12, border: 0, cursor: "pointer", position: "relative",
            background: value ? "var(--accent)" : "var(--line)" }}>
          <span style={{ position: "absolute", top: 2, insetInlineStart: value ? 22 : 2, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: "all .15s" }} />
        </button>
      </div>
    );
  if (f.type === "select")
    return (<div>{lbl}<select value={value} onChange={(e) => onChange(isNaN(+e.target.value) || e.target.value === "" ? e.target.value : +e.target.value)} style={{ width: "100%" }}>
      {(f.options || []).map((o) => <option key={String(o.v)} value={o.v}>{o.l}</option>)}</select></div>);
  if (f.type === "number")
    return (<div>{lbl}<input type="number" value={value ?? 0} onChange={(e) => onChange(+e.target.value)} style={{ width: "100%" }} /></div>);
  if (f.type === "password")
    return (<div>{lbl}
      <div style={{ display: "flex", gap: 6 }}>
        <input placeholder="اكتب قيمة جديدة" value={dirty ? value : ""} onChange={(e) => onChange(e.target.value)} style={{ flex: 1 }} type="password" />
        <span className="chip" style={{ color: f.configured ? "#22c55e" : "#f43f5e" }}>{f.configured ? "مُعرّف" : "غير مُعرّف"}</span>
      </div>
      <span className="muted" style={{ fontSize: 11 }}>الحالية مُقنّعة: {f.value || "—"}</span></div>);
  if (f.type === "tags") {
    const arr: string[] = Array.isArray(value) ? value : [];
    return (<div>{lbl}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 4 }}>
        {arr.map((t, i) => <span key={i} className="chip">{t} <a style={{ cursor: "pointer", color: "#f43f5e" }} onClick={() => onChange(arr.filter((_, j) => j !== i))}>×</a></span>)}
      </div>
      <input placeholder="أضف ثم Enter" onKeyDown={(e: any) => { if (e.key === "Enter" && e.target.value.trim()) { onChange([...arr, e.target.value.trim()]); e.target.value = ""; } }} style={{ width: "100%" }} /></div>);
  }
  if (f.type === "info")
    return (<div>{lbl}<span className="chip" style={{ color: "#22c55e" }}>{value}</span></div>);
  return (<div>{lbl}<input value={value ?? ""} onChange={(e) => onChange(e.target.value)} style={{ width: "100%" }} /></div>);
}

function TestBtn({ service }: { service: string }) {
  const [r, setR] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const run = async () => { setBusy(true); setR(await apiSend(`/api/settings/test/${service}`, "POST").catch(() => ({ ok: false, detail: "خطأ", latency_ms: 0 }))); setBusy(false); };
  return (
    <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
      <button className="btn ghost" style={{ fontSize: 12, padding: "4px 10px" }} onClick={run} disabled={busy}>{busy ? "…" : "اختبار الاتصال"}</button>
      {r && <span className="chip" style={{ color: r.ok ? "#22c55e" : "#f43f5e" }}>{r.ok ? "✓" : "✗"} {r.detail} · {r.latency_ms}ms</span>}
    </span>
  );
}

/* ── custom panels ─────────────────────────────────────────────────────── */
function EntitiesPanel() {
  const [targets, setTargets] = useState<Target[]>([]);
  const [name, setName] = useState(""); const [aliases, setAliases] = useState("");
  const [type, setType] = useState<TargetType>("person"); const [busy, setBusy] = useState(false);
  const [cov, setCovState] = useState(1000);
  const refresh = async () => setTargets(await getTargets());
  useEffect(() => { refresh(); setCovState(getCoverage()); }, []);
  const add = async () => {
    const n = name.trim(); if (!n) return; setBusy(true);
    const kws = [n, ...aliases.split(/[,،\n]/).map((s) => s.trim()).filter(Boolean)];
    await addTarget(n, Array.from(new Set(kws)), type); setName(""); setAliases(""); await refresh(); setBusy(false);
  };
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10, alignItems: "end" }}>
        <div><label style={{ fontSize: 12 }}>الاسم</label><input value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: وزارة الكهرباء" /></div>
        <div><label style={{ fontSize: 12 }}>أسماء بديلة</label><input value={aliases} onChange={(e) => setAliases(e.target.value)} placeholder="مفصولة بفواصل" /></div>
        <div><label style={{ fontSize: 12 }}>النوع</label>
          <select value={type} onChange={(e) => setType(e.target.value as TargetType)}>
            <option value="person">شخصية</option><option value="institution">مؤسسة</option>
          </select></div>
        <button className="btn" onClick={add} disabled={busy}>إضافة كيان</button>
      </div>
      {targets.map((t) => (
        <div key={t.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderTop: "1px solid var(--line)", fontSize: 13 }}>
          <span>{t.name}{t.pinned ? " · أساسي" : ""} <span className="muted">· {t.keywords?.length || 0} كلمة</span></span>
          <span style={{ display: "flex", gap: 8 }}>
            {!t.pinned && <a style={{ cursor: "pointer" }} onClick={async () => { await setPrimary(t.id, targets); refresh(); }}>تثبيت</a>}
            <a style={{ cursor: "pointer", color: "#f43f5e" }} onClick={async () => { await removeTarget(t.id); refresh(); }}>حذف</a>
          </span>
        </div>
      ))}
      <div style={{ marginTop: 14, borderTop: "1px solid var(--line)", paddingTop: 12 }}>
        <label style={{ fontSize: 13, fontWeight: 600 }}>تغطية الجمع (عدد المنشورات لكل دورة)</label>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
          {COVERAGE_OPTIONS.map((o) => (
            <button key={o.v} title={o.hint} className={cov === o.v ? "btn" : "btn ghost"} onClick={() => { setCoverage(o.v); setCovState(o.v); }}>{o.label}</button>
          ))}
        </div>
        <span className="muted" style={{ fontSize: 11 }}>تغطية أعلى = تحليل أعمق وكلفة أكبر لحصّة X.</span>
      </div>
    </div>
  );
}

function SourceWeightsPanel() {
  const SRC = ["X", "Telegram", "RSS", "Google News", "GDELT", "Reddit"];
  return (
    <div style={{ marginTop: 14 }}>
      <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
        <thead><tr style={{ color: "var(--muted)" }}><th style={{ textAlign: "start" }}>المصدر</th><th>الوزن (1-10)</th><th>المصداقية</th><th>الحالة</th></tr></thead>
        <tbody>{SRC.map((s) => (
          <tr key={s} style={{ borderTop: "1px solid var(--line)" }}>
            <td style={{ padding: "8px 0" }}>{s}</td>
            <td style={{ textAlign: "center" }}><input type="number" min={1} max={10} defaultValue={s === "X" ? 8 : 6} style={{ width: 60 }} /></td>
            <td style={{ textAlign: "center" }}><input type="number" min={0} max={100} defaultValue={70} style={{ width: 60 }} /></td>
            <td style={{ textAlign: "center" }}><span className="chip" style={{ color: "#22c55e" }}>نشط</span></td>
          </tr>))}</tbody>
      </table>
      <p className="muted" style={{ fontSize: 11, marginTop: 8 }}>أوزان المصادر تتحكّم بأهمية كل مصدر في الدرجات المركّبة. الإدارة الكاملة للمصادر المخصّصة قيد التطوير.</p>
    </div>
  );
}

function UsersPanel() {
  return (
    <div style={{ marginTop: 14 }}>
      <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
        <thead><tr style={{ color: "var(--muted)" }}><th style={{ textAlign: "start" }}>المستخدم</th><th>الدور</th><th>الباقة</th><th>الحالة</th></tr></thead>
        <tbody>
          <tr style={{ borderTop: "1px solid var(--line)" }}>
            <td style={{ padding: "8px 0" }}>abbaskareemsaddam@gmail.com</td>
            <td style={{ textAlign: "center" }}><span className="chip">مدير</span></td>
            <td style={{ textAlign: "center" }}>مؤسسية</td>
            <td style={{ textAlign: "center" }}><span className="chip" style={{ color: "#22c55e" }}>مُفعّل</span></td>
          </tr>
        </tbody>
      </table>
      <p className="muted" style={{ fontSize: 11, marginTop: 8 }}>إدارة المستخدمين والأدوار عبر Supabase Auth — إضافة/حذف المستخدمين من لوحة Supabase حالياً، وتكامل CRUD الكامل قيد التطوير.</p>
    </div>
  );
}

const SVC_AR: Record<string, string> = { backend: "الخادم الخلفي", database: "قاعدة البيانات", redis: "Redis (التخزين)", queue: "طابور المهام", ai_provider: "مزوّد الذكاء", x_api: "X API", telegram: "Telegram", rss: "RSS" };
function HealthPanel() {
  const [h, setH] = useState<any>(null);
  const [col, setCol] = useState<any>(null);
  useEffect(() => {
    apiGet("/api/settings/health").then(setH).catch(() => {});
    apiGet("/api/settings/collector?limit=20").then(setCol).catch(() => {});
  }, []);
  if (!h) return <p className="muted" style={{ marginTop: 14 }}>جارٍ فحص النظام…</p>;
  return (
    <div style={{ marginTop: 14 }}>
      {h.data_provider && (
        <div className="card" style={{ marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>مزوّد بيانات X</span>
          <span className="chip" style={{ color: h.data_provider === "twitterapi_io" ? "#22c55e" : "#fb923c" }}>
            {h.data_provider === "twitterapi_io" ? "TwitterAPI.io (أرشيف كامل)" : "X الرسمي"}
          </span>
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", gap: 10 }}>
        {Object.entries(h.services || {}).map(([k, v]: any) => (
          <div className="card" key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 13 }}>{SVC_AR[k] || k}</span>
            <span className="chip" style={{ color: v ? "#22c55e" : "#f43f5e" }}>{v ? "● يعمل" : "● متوقّف"}</span>
          </div>
        ))}
      </div>
      <h4 style={{ marginTop: 16 }}>مقاييس التشغيل</h4>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", gap: 10 }}>
        <Metric l="آخر جمع ناجح" v={h.metrics?.last_collection ? new Date(h.metrics.last_collection).toLocaleString("ar") : "—"} />
        <Metric l="مهام فاشلة" v={h.metrics?.failed_jobs ?? 0} />
        <Metric l="منشورات اليوم" v={h.metrics?.posts_today ?? "—"} />
        <Metric l="نداءات ذكاء اليوم" v={h.metrics?.ai_calls_today ?? "—"} />
      </div>
      <p className="muted" style={{ fontSize: 11, marginTop: 8 }}>بعض المقاييس التفصيلية (الكلفة، استهلاك التخزين) تُضاف مع تفعيل عدّادات الاستخدام.</p>

      <h4 style={{ marginTop: 16 }}>محرّك الجمع الذكي (AICE)</h4>
      {col?.budget && (
        <div className="card" style={{ marginBottom: 10, borderInlineStart: `4px solid ${col.budget.capped ? "#f43f5e" : (col.budget.pct ?? 0) > 80 ? "#fb923c" : "#22c55e"}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
            <b>سقف الإنفاق الشهري ({col.budget.month})</b>
            <span className="chip" style={{ color: col.budget.capped ? "#f43f5e" : "#22c55e" }}>
              {col.budget.capped ? "بلغ السقف — توقّف الجمع" : col.budget.cap > 0 ? `${col.budget.pct}% مُستهلك` : "بلا حد"}
            </span>
          </div>
          <div style={{ height: 8, background: "var(--line)", borderRadius: 4, overflow: "hidden", margin: "8px 0" }}>
            <div style={{ width: `${Math.min(100, col.budget.pct || 0)}%`, height: "100%", background: col.budget.capped ? "#f43f5e" : (col.budget.pct ?? 0) > 80 ? "#fb923c" : "#22c55e" }} />
          </div>
          <div className="muted" style={{ fontSize: 12 }}>
            {Number(col.budget.used).toLocaleString()} / {col.budget.cap > 0 ? Number(col.budget.cap).toLocaleString() : "∞"} تغريدة ·
            ≈ ${col.budget.est_cost_usd}{col.budget.cap_cost_usd ? ` من $${col.budget.cap_cost_usd}` : ""} هذا الشهر
          </div>
        </div>
      )}
      {!col && <p className="muted" style={{ fontSize: 12 }}>جارٍ التحميل…</p>}
      {col && (col.totals?.runs ? (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 10 }}>
            <Metric l="دورات الجمع" v={col.totals.runs} />
            <Metric l="منشورات مجموعة" v={Number(col.totals.fetched).toLocaleString()} />
            <Metric l="نداءات ذكاء موفّرة" v={Number(col.totals.ai_calls_saved).toLocaleString()} />
            <Metric l="مكرّرات مُزالة" v={Number(col.totals.duplicates).toLocaleString()} />
          </div>
          <p className="muted" style={{ fontSize: 11, marginTop: 6 }}>
            التجميع-قبل-الذكاء وفّر {col.totals.fetched ? Math.round((col.totals.ai_calls_saved / col.totals.fetched) * 100) : 0}% من نداءات Claude في آخر {col.totals.runs} دورة.
          </p>
        </>
      ) : (
        <p className="muted" style={{ fontSize: 12 }}>لا سجلّات جمع بعد — ستظهر بعد تشغيل migration 008 وأول دورة جمع.</p>
      ))}
    </div>
  );
}
function Metric({ l, v }: { l: string; v: any }) {
  return <div className="card" style={{ textAlign: "center" }}><div style={{ fontWeight: 800, fontSize: 16 }}>{v}</div><div className="muted" style={{ fontSize: 11 }}>{l}</div></div>;
}

function AuditPanel() {
  const [logs, setLogs] = useState<any[]>([]);
  useEffect(() => { apiGet("/api/settings/audit?limit=80").then((r) => setLogs(r?.logs || [])).catch(() => {}); }, []);
  return (
    <div style={{ marginTop: 14 }}>
      {!logs.length && <p className="muted">لا سجلّات بعد — ستظهر هنا كل تغييرات الإعدادات.</p>}
      {logs.map((l, i) => (
        <div key={i} style={{ display: "flex", gap: 10, fontSize: 12.5, padding: "6px 0", borderTop: i ? "1px solid var(--line)" : 0, flexWrap: "wrap" }}>
          <span className="muted" style={{ minWidth: 130 }}>{l.created_at ? new Date(l.created_at).toLocaleString("ar") : ""}</span>
          <span className="chip">{l.action}</span>
          <span>{l.category} · <b>{(l.key || "").split(".").pop()}</b></span>
          <span className="muted">{JSON.stringify(l.old_value?.v)} → {JSON.stringify(l.new_value?.v)}</span>
        </div>
      ))}
    </div>
  );
}
