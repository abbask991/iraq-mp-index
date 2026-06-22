"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Comment = { id: number; body: string; created_at: string; status: string };

export default function Comments({ mpId }: { mpId: number }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [items, setItems] = useState<Comment[]>([]);
  const [body, setBody] = useState("");
  const [msg, setMsg] = useState("");

  async function load() {
    // RLS returns approved comments + the viewer's own (any status)
    const { data } = await supabase.from("comments").select("id,body,created_at,status")
      .eq("mp_id", mpId).order("created_at", { ascending: false });
    setItems(data ?? []);
  }
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
    load();
  }, [mpId]);

  async function submit() {
    if (!userId) { setMsg("سجّل الدخول لإضافة تعليق."); return; }
    if (body.trim().length < 2) return;
    const { error } = await supabase.from("comments")
      .insert({ mp_id: mpId, user_id: userId, body: body.trim() });
    if (error) setMsg(error.message);
    else { setBody(""); setMsg("✅ أُرسل تعليقك وهو بانتظار المراجعة."); load(); }
  }

  return (
    <div className="card" style={{ margin: "16px 0" }}>
      <b>التعليقات</b>
      <p className="muted" style={{ fontSize: 12 }}>التعليقات تُراجَع قبل النشر ولا تؤثر على الدرجة.</p>
      <textarea rows={3} placeholder="اكتب رأيك…" value={body}
        onChange={(e) => setBody(e.target.value)} style={{ margin: "8px 0" }} />
      <button className="btn" onClick={submit}>إرسال</button>
      {msg && <p className="muted">{msg}</p>}
      <div style={{ marginTop: 14 }}>
        {items.map((c) => (
          <div key={c.id} style={{ borderTop: "1px solid var(--line)", padding: "10px 0" }}>
            <div>{c.body}</div>
            <div className="muted" style={{ fontSize: 11 }}>
              {new Date(c.created_at).toLocaleDateString("ar")} {c.status !== "approved" ? "· بانتظار المراجعة" : ""}
            </div>
          </div>
        ))}
        {!items.length && <p className="muted">لا تعليقات بعد.</p>}
      </div>
    </div>
  );
}
