"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function RatingForm({ mpId, onRated }: { mpId: number; onRated: () => void }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [stars, setStars] = useState(0);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
    // preload this user's existing rating for this MP
  }, []);
  useEffect(() => {
    if (!userId) return;
    supabase.from("ratings").select("stars").eq("mp_id", mpId).eq("user_id", userId)
      .maybeSingle().then(({ data }) => { if (data) setStars(data.stars); });
  }, [userId, mpId]);

  async function submit(value: number) {
    setStars(value);
    if (!userId) { setMsg("سجّل الدخول أولاً لإضافة تقييم."); return; }
    // one rating per user per MP (unique constraint) → upsert
    const { error } = await supabase.from("ratings")
      .upsert({ mp_id: mpId, user_id: userId, stars: value }, { onConflict: "mp_id,user_id" });
    setMsg(error ? error.message : "✅ تم تسجيل تقييمك.");
    if (!error) onRated();
  }

  return (
    <div className="card" style={{ margin: "16px 0" }}>
      <b>قيّم هذا النائب</b>
      <div style={{ margin: "8px 0" }}>
        {[1, 2, 3, 4, 5].map((v) => (
          <button key={v} className={"star" + (v <= stars ? " on" : "")} onClick={() => submit(v)}>★</button>
        ))}
      </div>
      {!userId && <a href="/login" className="muted">سجّل الدخول للتقييم</a>}
      {msg && <p className="muted">{msg}</p>}
    </div>
  );
}
