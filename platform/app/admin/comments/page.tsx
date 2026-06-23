"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type C = { id: number; mp_id: number; body: string; status: string; created_at: string; author_name: string | null };

export default function AdminComments() {
  const [items, setItems] = useState<C[]>([]);
  const [filter, setFilter] = useState<"pending" | "all">("pending");
  const [msg, setMsg] = useState("");

  async function load() {
    let q = supabase.from("comments").select("*").order("created_at", { ascending: false }).limit(200);
    if (filter === "pending") q = supabase.from("comments").select("*").eq("status", "pending")
      .order("created_at", { ascending: false }).limit(200);
    const { data, error } = await q;
    setItems(data ?? []);
    if (error) setMsg(error.message);
  }
  useEffect(() => { load(); }, [filter]);

  async function setStatus(id: number, status: string) {
    await supabase.from("comments").update({ status }).eq("id", id);
    load();
  }

  return (
    <div>
      <h2>الإشراف على التعليقات</h2>
      <div style={{ display: "flex", gap: 8, margin: "10px 0" }}>
        <button className="btn" style={{ background: filter === "pending" ? undefined : "#1f2a3d", color: filter === "pending" ? undefined : "var(--text)" }}
          onClick={() => setFilter("pending")}>بانتظار المراجعة</button>
        <button className="btn" style={{ background: filter === "all" ? undefined : "#1f2a3d", color: filter === "all" ? undefined : "var(--text)" }}
          onClick={() => setFilter("all")}>الكل</button>
      </div>
      {msg && <p className="muted">{msg}</p>}
      {items.length === 0 && <p className="muted">لا تعليقات.</p>}
      {items.map((c) => (
        <div key={c.id} className="card" style={{ marginBottom: 10 }}>
          <div><b>{c.author_name || "مجهول"}</b>: {c.body}</div>
          <div className="muted" style={{ fontSize: 12, margin: "6px 0" }}>
            نائب #{c.mp_id} · {new Date(c.created_at).toLocaleString("ar")} · الحالة: {c.status}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn" onClick={() => setStatus(c.id, "approved")}>✅ موافقة</button>
            <button className="btn" style={{ background: "#7f1d1d", color: "#fee" }}
              onClick={() => setStatus(c.id, "rejected")}>❌ رفض</button>
          </div>
        </div>
      ))}
    </div>
  );
}
