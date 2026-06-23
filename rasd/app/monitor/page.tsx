"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

export default function Monitors() {
  const [items, setItems] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [kw, setKw] = useState("");
  const [authed, setAuthed] = useState<boolean | null>(null);

  async function load() {
    const { data } = await supabase.from("monitors").select("*").order("created_at", { ascending: false });
    setItems(data ?? []);
  }
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setAuthed(!!data.user));
    load();
  }, []);

  async function create() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { location.href = "/login"; return; }
    const keywords = kw.split(",").map((s) => s.trim()).filter(Boolean);
    if (!name || !keywords.length) return;
    await supabase.from("monitors").insert({ owner: user.id, name, keywords });
    setName(""); setKw(""); load();
  }
  async function del(id: number) {
    await supabase.from("monitors").delete().eq("id", id);
    load();
  }

  if (authed === false)
    return <div className="card"><h2>📡 مركز الرصد</h2><p className="muted"><Link href="/login">سجّل الدخول</Link> لإنشاء رصد إعلامي.</p></div>;

  return (
    <div>
      <h2>📡 مركز الرصد الإعلامي</h2>
      <p className="muted">أنشئ رصداً (اسم + كلمات تتابعها) وافتح لوحته لتشوف التغطية والنبرة والمصادر.</p>
      <div className="card" style={{ marginBottom: 14 }}>
        <input placeholder="اسم الرصد (مثال: النائب فلان / شركة س)" value={name}
          onChange={(e) => setName(e.target.value)} style={{ marginBottom: 8 }} />
        <input placeholder="الكلمات مفصولة بفاصلة (مثال: عالية نصيف, الموازنة, التعليم)" value={kw}
          onChange={(e) => setKw(e.target.value)} style={{ marginBottom: 8 }} />
        <button className="btn" onClick={create}>إنشاء رصد</button>
      </div>
      <div className="grid">
        {items.map((m) => (
          <div key={m.id} className="mpcard">
            <Link href={`/monitor/${m.id}`}>
              <div className="n">📡 {m.name}</div>
              <div className="m">{(m.keywords || []).join(" · ")}</div>
            </Link>
            <button onClick={() => del(m.id)} style={{ background: "none", border: 0, color: "#f43f5e", cursor: "pointer", marginTop: 8, fontSize: 12 }}>حذف</button>
          </div>
        ))}
        {items.length === 0 && <p className="muted">لا عمليات رصد بعد — أنشئ أول واحدة فوق.</p>}
      </div>
    </div>
  );
}
