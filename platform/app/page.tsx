"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase, MP } from "@/lib/supabaseClient";

export default function Home() {
  const [mps, setMps] = useState<MP[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("mps").select("*").order("id").then(({ data }) => {
      setMps(data ?? []);
      setLoading(false);
    });
  }, []);

  const shown = mps.filter((m) => !q || m.name.includes(q));

  return (
    <div>
      <h1>نواب مجلس النواب</h1>
      <p className="muted">اختر نائباً لعرض ملفه وإضافة تقييمك وتعليقك.</p>
      <input placeholder="بحث باسم النائب…" value={q} onChange={(e) => setQ(e.target.value)}
        style={{ margin: "12px 0 18px", maxWidth: 360 }} />
      {loading ? <p className="muted">جارٍ التحميل…</p> : (
        <div className="grid">
          {shown.map((m) => (
            <Link key={m.id} href={`/mp/${m.id}`} className="mpcard">
              <div className="n">{m.name}</div>
              <div className="m">{m.governorate} · {m.bloc}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
