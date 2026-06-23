"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { PLAN_LABEL } from "@/lib/subscription";

const PLANS = ["trial", "basic", "pro", "enterprise"];
const STATUSES = ["active", "pending", "expired", "disabled"];

export default function AdminSubs() {
  const [subs, setSubs] = useState<any[]>([]);
  const [msg, setMsg] = useState("");

  const load = async () => {
    const { data } = await supabase.from("subscriptions").select("*").order("created_at", { ascending: false });
    setSubs(data || []);
  };
  useEffect(() => { load(); }, []);

  const update = async (user_id: string, patch: any) => {
    setSubs((s) => s.map((x) => x.user_id === user_id ? { ...x, ...patch } : x));
    const { error } = await supabase.from("subscriptions").update(patch).eq("user_id", user_id);
    setMsg(error ? `خطأ: ${error.message}` : "✅ حُفظ");
    setTimeout(() => setMsg(""), 2000);
  };
  const extend = (s: any, days: number) => {
    const base = s.expires_at && new Date(s.expires_at) > new Date() ? new Date(s.expires_at) : new Date();
    base.setDate(base.getDate() + days);
    update(s.user_id, { expires_at: base.toISOString(), status: "active" });
  };

  const active = subs.filter((s) => s.status === "active").length;

  return (
    <div>
      <h2>👥 العملاء والاشتراكات</h2>
      <p className="muted">فعّل أو جدّد اشتراكات العملاء يدوياً. {msg && <b style={{ color: "var(--accent)" }}>{msg}</b>}</p>

      <div className="stat-grid" style={{ marginBottom: 14 }}>
        <div className="stat"><div className="v">{subs.length}</div><div className="l">إجمالي العملاء</div></div>
        <div className="stat"><div className="v" style={{ color: "#22c55e" }}>{active}</div><div className="l">اشتراكات فعّالة</div></div>
        <div className="stat"><div className="v">{subs.filter((s) => s.plan !== "trial" && s.status === "active").length}</div><div className="l">مدفوعة فعّالة</div></div>
      </div>

      {subs.length === 0 && <p className="muted">لا عملاء بعد.</p>}
      {subs.map((s) => (
        <div className="card" key={s.user_id} style={{ marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
            <div>
              <b>{s.company || s.email || s.user_id.slice(0, 8)}</b>
              <div className="muted" style={{ fontSize: 12 }}>
                {s.email} {s.expires_at ? `· ينتهي ${s.expires_at.slice(0, 10)}` : "· بدون انتهاء"}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <select value={s.plan} onChange={(e) => update(s.user_id, { plan: e.target.value })}
                style={{ padding: 6, minWidth: 110 }}>
                {PLANS.map((p) => <option key={p} value={p}>{PLAN_LABEL[p]}</option>)}
              </select>
              <select value={s.status} onChange={(e) => update(s.user_id, { status: e.target.value })}
                style={{ padding: 6, minWidth: 100 }}>
                {STATUSES.map((st) => <option key={st} value={st}>{st}</option>)}
              </select>
              <button className="btn ghost" onClick={() => extend(s, 30)}>+شهر</button>
              <button className="btn ghost" onClick={() => extend(s, 365)}>+سنة</button>
              <button className="btn ghost" onClick={() => update(s.user_id, { expires_at: null, status: "active" })}>دائم</button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
