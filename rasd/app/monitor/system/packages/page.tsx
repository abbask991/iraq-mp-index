"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { apiGet, apiSend } from "@/lib/api";
import { featureRegistry, PLANS, isAdminEmail } from "@/lib/nav";
import { SkelCards } from "@/components/Skeleton";
import EmptyState from "@/components/EmptyState";

export default function PackagesAdmin() {
  const [gate, setGate] = useState<"loading" | "denied" | "ok">("loading");
  const [plan, setPlan] = useState("basic");
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState("");
  const reg = featureRegistry();

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setGate(isAdminEmail(user?.email) ? "ok" : "denied");
    })();
  }, []);

  const loadPlan = (p: string) => {
    setLoading(true); setSaved("");
    apiGet(`/api/entitlements?plan=${p}`).then((r) => setHidden(new Set(r?.hidden || []))).finally(() => setLoading(false));
  };
  useEffect(() => { if (gate === "ok") loadPlan(plan); /* eslint-disable-next-line */ }, [gate, plan]);

  const toggle = (key: string) => {
    const n = new Set(hidden);
    n.has(key) ? n.delete(key) : n.add(key);
    setHidden(n); setSaved("");
  };
  const save = async () => {
    setSaved("…");
    const r = await apiSend("/api/entitlements", "POST", { plan, hidden: Array.from(hidden) }).catch(() => null);
    setSaved(r?.saved ? "✅ حُفظ" : "⚠️ تعذّر الحفظ (تأكّد من قاعدة البيانات)");
  };
  const bulk = (show: boolean) => {
    if (show) { setHidden(new Set()); return; }
    const all = new Set<string>(); reg.forEach((g) => g.items.forEach((it) => all.add(it.key)));
    setHidden(all);
  };

  if (gate === "loading") return <p className="muted" style={{ padding: 20 }}>…</p>;
  if (gate === "denied") return <EmptyState tone="error" title="غير مصرّح" subtitle="هذه الصفحة للمشرفين فقط." />;

  const total = reg.reduce((n, g) => n + g.items.length, 0);
  const visibleCount = total - hidden.size;

  return (
    <div>
      <h2 style={{ margin: 0 }}>إدارة الباقات والصلاحيات</h2>
      <p className="muted">اختر الباقة، ثم فعّل/أطفئ الميزات التي تظهر لعملاء هذه الباقة. الإطفاء يُخفي الميزة من القائمة الجانبية لكل مستخدم على هذه الباقة (المشرف يرى كل شيء دائماً).</p>

      {/* plan selector */}
      <div className="card" style={{ marginBottom: 14, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <span className="muted" style={{ fontSize: 12 }}>الباقة:</span>
        {PLANS.map((p) => (
          <button key={p.key} className={`btn ${plan === p.key ? "" : "ghost"}`} onClick={() => setPlan(p.key)}>{p.ar}</button>
        ))}
        <span style={{ flex: 1 }} />
        <button className="btn ghost" onClick={() => bulk(true)}>إظهار الكل</button>
        <button className="btn ghost" onClick={() => bulk(false)}>إخفاء الكل</button>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
        <span className="muted" style={{ fontSize: 12.5 }}>ظاهرة <b style={{ color: "#22c55e" }}>{visibleCount}</b> / {total} ميزة لباقة «{PLANS.find((p) => p.key === plan)?.ar}»</span>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {saved && <span className="muted" style={{ fontSize: 12 }}>{saved}</span>}
          <button className="btn" onClick={save}>حفظ</button>
        </div>
      </div>

      {loading && <SkelCards count={4} />}
      {!loading && reg.map((g) => (
        <div key={g.group} className="cbox" style={{ marginBottom: 12 }}>
          <h4 style={{ marginTop: 0 }}>{g.group}</h4>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            {g.items.map((it) => {
              const on = !hidden.has(it.key);
              return (
                <label key={it.key} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, padding: "6px 8px", borderRadius: 8, cursor: "pointer",
                  border: "1px solid var(--line)", background: on ? "color-mix(in srgb,#22c55e 8%,transparent)" : "color-mix(in srgb,#f43f5e 8%,transparent)" }}>
                  <input type="checkbox" checked={on} onChange={() => toggle(it.key)} />
                  <span style={{ flex: 1 }}>{it.ar}</span>
                  <span className="chip" style={{ fontSize: 10, color: on ? "#22c55e" : "#f43f5e" }}>{on ? "ظاهرة" : "مخفيّة"}</span>
                </label>
              );
            })}
          </div>
        </div>
      ))}
      <p className="muted" style={{ fontSize: 11 }}>ملاحظة: التطبيق على مستوى الواجهة (إخفاء من القائمة). لحماية كاملة على مستوى المسارات لاحقاً يُنصح بإضافة تحقّق في الخادم.</p>
    </div>
  );
}
