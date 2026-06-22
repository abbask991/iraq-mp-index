"use client";
import { useEffect, useState } from "react";
import { supabase, MP } from "@/lib/supabaseClient";

const FIELDS: [keyof MP | "search_name", string][] = [
  ["name", "الاسم"], ["governorate", "المحافظة"], ["bloc", "الكتلة"],
  ["committee", "اللجنة"], ["search_name", "الاسم البحثي (للأخبار)"],
  ["photo", "رابط الصورة"], ["facebook", "فيسبوك"], ["x", "X / تويتر"],
  ["instagram", "إنستغرام"], ["telegram", "تليغرام"], ["website", "الموقع"],
];

export default function AdminMPs() {
  const [mps, setMps] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<any | null>(null);
  const [msg, setMsg] = useState("");

  async function load() {
    const { data } = await supabase.from("mps").select("*").order("id");
    setMps(data ?? []);
  }
  useEffect(() => { load(); }, []);

  async function save() {
    if (!sel) return;
    setMsg("جارٍ الحفظ…");
    const { id, ...fields } = sel;
    const { error } = await supabase.from("mps").update(fields).eq("id", id);
    setMsg(error ? `خطأ: ${error.message}` : "✅ تم الحفظ");
    if (!error) load();
  }

  async function uploadPhoto(file: File) {
    if (!sel) return;
    const path = `mp-${sel.id}-${Date.now()}.${file.name.split(".").pop()}`;
    const { error } = await supabase.storage.from("photos").upload(path, file, { upsert: true });
    if (error) { setMsg(`خطأ رفع: ${error.message}`); return; }
    const { data } = supabase.storage.from("photos").getPublicUrl(path);
    setSel({ ...sel, photo: data.publicUrl });
    setMsg("✅ رُفعت الصورة — اضغط حفظ");
  }

  const shown = mps.filter((m) => !q || m.name.includes(q));

  return (
    <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 16 }}>
      <div className="card" style={{ maxHeight: 520, overflow: "auto" }}>
        <input placeholder="بحث…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div style={{ marginTop: 10 }}>
          {shown.map((m) => (
            <div key={m.id} onClick={() => { setSel(m); setMsg(""); }}
              style={{ padding: "8px 6px", cursor: "pointer", borderBottom: "1px solid var(--line)",
                color: sel?.id === m.id ? "var(--accent)" : "var(--text)" }}>
              {m.name}
            </div>
          ))}
        </div>
      </div>
      <div className="card">
        {!sel ? <p className="muted">اختر نائباً للتعديل.</p> : (
          <div>
            <h3 style={{ marginTop: 0 }}>{sel.name}</h3>
            {FIELDS.map(([k, label]) => (
              <div key={k as string} style={{ marginBottom: 10 }}>
                <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>{label}</div>
                <input value={sel[k] ?? ""} onChange={(e) => setSel({ ...sel, [k]: e.target.value })} />
              </div>
            ))}
            <div style={{ marginBottom: 10 }}>
              <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>أو ارفع صورة</div>
              <input type="file" accept="image/*"
                onChange={(e) => e.target.files?.[0] && uploadPhoto(e.target.files[0])} />
            </div>
            <button className="btn" onClick={save}>حفظ</button>
            {msg && <span className="muted" style={{ marginRight: 12 }}>{msg}</span>}
          </div>
        )}
      </div>
    </div>
  );
}
