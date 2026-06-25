"use client";
import { useEffect, useState } from "react";
import {
  Target, TargetType, getTargets, addTarget, removeTarget, setPrimary, savePref,
} from "@/lib/targets";

export default function Settings() {
  const [targets, setTargets] = useState<Target[]>([]);
  const [name, setName] = useState("");
  const [aliases, setAliases] = useState("");
  const [type, setType] = useState<TargetType>("person");
  const [busy, setBusy] = useState(false);

  const refresh = async () => setTargets(await getTargets());
  useEffect(() => { refresh(); }, []);

  const add = async () => {
    const n = name.trim();
    if (!n) return;
    setBusy(true);
    const kws = [n, ...aliases.split(/[,،\n]/).map((s) => s.trim()).filter(Boolean)];
    await addTarget(n, Array.from(new Set(kws)), type);
    setName(""); setAliases(""); setType("person");
    await refresh(); setBusy(false);
  };
  const remove = async (id: string) => { await removeTarget(id); await refresh(); };
  const pin = async (id: string) => { await setPrimary(id, targets); await refresh(); };
  const changeType = async (id: string, t: TargetType) => { savePref(id, { type: t }); await refresh(); };

  const TYPES: { v: TargetType; ar: string }[] = [
    { v: "person", ar: "شخص" }, { v: "institution", ar: "مؤسسة" },
  ];

  return (
    <div>
      <h2>الإعدادات — قائمة المتابعة</h2>
      <p className="muted">عرّف الأشخاص والمؤسسات الذين تريد متابعتهم. يظهرون تلقائياً في <b>كل أقسام المنصّة</b>،
        والهدف <b>الأساسي</b> (المثبّت) هو الذي تفتح به الأقسام افتراضياً.</p>

      <div className="card" style={{ marginBottom: 16 }}>
        <b>إضافة هدف جديد</b>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
          <input placeholder="الاسم (مثال: محمد شياع السوداني)" value={name}
            onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()}
            style={{ flex: 2, minWidth: 200 }} />
          <select value={type} onChange={(e) => setType(e.target.value as TargetType)}
            style={{ background: "var(--input)", color: "var(--text)", border: "1px solid var(--line)", borderRadius: 10, padding: 10 }}>
            {TYPES.map((t) => <option key={t.v} value={t.v}>{t.ar}</option>)}
          </select>
          <button className="btn" onClick={add} disabled={busy}>{busy ? "…" : "أضِف"}</button>
        </div>
        <input placeholder="أسماء بديلة / كلمات مفتاحية (اختياري، افصلها بفاصلة)" value={aliases}
          onChange={(e) => setAliases(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()}
          style={{ marginTop: 8 }} />
      </div>

      <div className="card">
        <b>أهدافك ({targets.length})</b>
        {targets.length === 0 && <p className="muted" style={{ marginTop: 8 }}>لا أهداف بعد — أضِف أعلاه.</p>}
        {targets.map((t) => (
          <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: "1px solid var(--line)", flexWrap: "wrap" }}>
            <button onClick={() => pin(t.id)} title="اجعله الأساسي"
              className="star" style={{ fontSize: 20, color: t.pinned ? "#facc15" : "var(--muted)" }}>★</button>
            <div style={{ flex: 1, minWidth: 160 }}>
              <div style={{ fontWeight: 700 }}>{t.name} {t.pinned && <span style={{ color: "#facc15", fontSize: 11 }}>· أساسي</span>}</div>
              <div className="muted" style={{ fontSize: 12 }}>{(t.keywords || []).join(" · ")}</div>
            </div>
            <select value={t.type} onChange={(e) => changeType(t.id, e.target.value as TargetType)}
              style={{ background: "var(--input)", color: "var(--text)", border: "1px solid var(--line)", borderRadius: 8, padding: "5px 8px", fontSize: 12 }}>
              {TYPES.map((x) => <option key={x.v} value={x.v}>{x.ar}</option>)}
            </select>
            <button className="btn ghost" style={{ padding: "4px 10px", fontSize: 12 }} onClick={() => remove(t.id)}>حذف</button>
          </div>
        ))}
        {targets.length > 0 && (
          <p className="muted" style={{ fontSize: 11, marginTop: 10 }}>
            النجمة ★ = الهدف الأساسي الذي تفتح به كل الأقسام · يظهرون جميعاً كأزرار سريعة داخل كل قسم.
          </p>
        )}
      </div>
    </div>
  );
}
