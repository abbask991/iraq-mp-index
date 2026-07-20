"use client";
import { useState } from "react";
import { apiSend } from "@/lib/api";
import { Icon, Badge } from "@/components/ui";
import { CLIENT_TYPES, TEMPLATES, setClientType } from "@/lib/workspace";

/**
 * Client Onboarding Wizard — walk a new client from empty to a usable workspace in
 * one guided flow. It configures REAL state: the client type, the tenant watchlist
 * (/api/workspace/watchlist), and output preferences. Platform choices are honest —
 * it marks which sources are actually collected today vs provider-gated.
 */
const PLATFORMS: [string, string, boolean][] = [
  ["x", "إكس / تويتر", true], ["news", "أخبار / RSS", true], ["facebook", "فيسبوك", true],
  ["telegram", "تيليجرام", false], ["tiktok", "تيك توك", false], ["instagram", "إنستغرام", false],
];
const OUTPUTS: [string, string][] = [
  ["daily", "التقرير اليومي"], ["weekly", "تقرير أسبوعي"], ["crisis", "تنبيهات الأزمات"],
  ["board", "موجز المجلس"], ["dossier", "ملف كيان"], ["campaign", "تقرير الحملات"], ["anger", "تقرير الغضب العام"],
];
const STEPS = ["نوع العميل", "حالة الاستخدام", "الكيانات", "القضايا", "المنصّات", "المخرجات", "إنشاء"];

export default function OnboardingWizard({ onDone }: { onDone?: () => void }) {
  const [step, setStep] = useState(0);
  const [ctype, setCtype] = useState("");
  const [tmpl, setTmpl] = useState("");
  const [entities, setEntities] = useState("");
  const [issues, setIssues] = useState("");
  const [platforms, setPlatforms] = useState<string[]>(["x", "news", "facebook"]);
  const [outputs, setOutputs] = useState<string[]>(["daily", "crisis", "board"]);
  const [msg, setMsg] = useState("");

  const pickTemplate = (key: string) => {
    setTmpl(key);
    const t = TEMPLATES.find((x) => x.key === key);
    if (t) {
      if (t.patch.keywords?.length) setIssues((prev) => Array.from(new Set([...(prev.split("\n").filter(Boolean)), ...t.patch.keywords!])).join("\n"));
      if (t.patch.brands?.length) setEntities((prev) => Array.from(new Set([...(prev.split("\n").filter(Boolean)), ...t.patch.brands!])).join("\n"));
      if (!ctype) setCtype(t.clientType);
    }
  };

  const toggle = (arr: string[], set: (v: string[]) => void, v: string) => set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const create = async () => {
    setMsg("جارٍ إنشاء المساحة…");
    if (ctype) setClientType(ctype);
    try { localStorage.setItem("rasd_outputs", JSON.stringify(outputs)); } catch { /* ignore */ }
    const body = {
      entities: entities.split("\n").map((s) => s.trim()).filter(Boolean),
      keywords: issues.split("\n").map((s) => s.trim()).filter(Boolean),
      brands: [], fb_pages: [],
    };
    const r = await apiSend("/api/workspace/watchlist", "POST", body).catch(() => null);
    setMsg(r?.saved ? "✅ جهّزت مساحتك — يمكنك البدء الآن." : "✅ ضُبط الإعداد (سجّل الدخول لحفظ القائمة).");
    setTimeout(() => onDone?.(), 1400);
  };

  const canNext = step === 0 ? !!ctype : step === 2 ? !!entities.trim() || !!issues.trim() : true;

  return (
    <div className="cbox">
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <Icon name="rocket" size={16} /><b style={{ fontSize: 15 }}>إعداد المساحة الموجّه</b>
        <span className="u-fine" style={{ marginInlineStart: "auto" }}>خطوة {step + 1} / {STEPS.length} — {STEPS[step]}</span>
      </div>
      <div style={{ height: 6, background: "var(--line)", borderRadius: 4, overflow: "hidden", marginBottom: 14 }}>
        <div style={{ width: `${((step + 1) / STEPS.length) * 100}%`, height: "100%", background: "var(--accent)" }} />
      </div>

      {step === 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 8 }}>
          {CLIENT_TYPES.map((c) => (
            <button key={c.key} className={"btn" + (ctype === c.key ? "" : " ghost")} style={{ textAlign: "start", padding: "10px 12px", height: "auto" }} onClick={() => setCtype(c.key)}>
              <div style={{ fontWeight: 700 }}>{c.ar}</div><div className="u-fine">{c.desc}</div>
            </button>
          ))}
        </div>
      )}
      {step === 1 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {TEMPLATES.filter((t) => !ctype || t.clientType === ctype || true).map((t) => (
            <button key={t.key} className={"btn" + (tmpl === t.key ? "" : " ghost")} style={{ fontSize: 12.5, padding: "6px 12px" }} title={t.desc} onClick={() => pickTemplate(t.key)}>{t.ar}</button>
          ))}
        </div>
      )}
      {step === 2 && (
        <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13 }}><span className="muted">الكيانات المرصودة (سطر لكل كيان)</span>
          <textarea rows={5} value={entities} onChange={(e) => setEntities(e.target.value)} placeholder="شخصية / حزب / مؤسسة / شركة / منافس" style={{ fontFamily: "inherit", fontSize: 13 }} /></label>
      )}
      {step === 3 && (
        <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13 }}><span className="muted">القضايا المرصودة (سطر لكل قضية)</span>
          <textarea rows={5} value={issues} onChange={(e) => setIssues(e.target.value)} placeholder="كهرباء / رواتب / فساد / خدمات / أسعار / انتخابات / شكاوى" style={{ fontFamily: "inherit", fontSize: 13 }} /></label>
      )}
      {step === 4 && (
        <div style={{ display: "grid", gap: 8 }}>
          {PLATFORMS.map(([k, ar, real]) => (
            <label key={k} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
              <input type="checkbox" checked={platforms.includes(k)} onChange={() => toggle(platforms, setPlatforms, k)} style={{ width: "auto" }} />
              {ar} {real ? <Badge t="ok">مجموعة</Badge> : <Badge t="warn">تتطلّب تفعيل مزوّد</Badge>}
            </label>
          ))}
        </div>
      )}
      {step === 5 && (
        <div style={{ display: "grid", gap: 8 }}>
          {OUTPUTS.map(([k, ar]) => (
            <label key={k} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
              <input type="checkbox" checked={outputs.includes(k)} onChange={() => toggle(outputs, setOutputs, k)} style={{ width: "auto" }} /> {ar}
            </label>
          ))}
        </div>
      )}
      {step === 6 && (
        <div style={{ fontSize: 13, lineHeight: 1.9 }}>
          <div><b>نوع العميل:</b> {CLIENT_TYPES.find((c) => c.key === ctype)?.ar || "—"}</div>
          <div><b>الكيانات:</b> {entities.split("\n").filter(Boolean).length} · <b>القضايا:</b> {issues.split("\n").filter(Boolean).length}</div>
          <div><b>المنصّات:</b> {platforms.length} · <b>المخرجات:</b> {outputs.length}</div>
          {msg && <p className="u-fine" style={{ marginTop: 8 }}>{msg}</p>}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14 }}>
        <button className="btn ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>السابق</button>
        {step < STEPS.length - 1
          ? <button className="btn" onClick={() => setStep((s) => s + 1)} disabled={!canNext}>التالي</button>
          : <button className="btn" onClick={create}>أنشئ المساحة</button>}
      </div>
    </div>
  );
}
