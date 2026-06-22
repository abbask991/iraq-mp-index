"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function Login() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState("");

  async function send() {
    setErr("");
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined },
    });
    if (error) setErr(error.message);
    else setSent(true);
  }

  return (
    <div className="card" style={{ maxWidth: 420, margin: "30px auto" }}>
      <h2>تسجيل الدخول</h2>
      <p className="muted">سنرسل لك رابط دخول على بريدك (Phase 1). لاحقاً نضيف التحقق برقم الهاتف.</p>
      {sent ? (
        <p>✅ تحقق من بريدك واضغط رابط الدخول.</p>
      ) : (
        <>
          <input type="email" placeholder="بريدك الإلكتروني" value={email}
            onChange={(e) => setEmail(e.target.value)} style={{ margin: "10px 0" }} />
          <button className="btn" onClick={send}>إرسال رابط الدخول</button>
          {err && <p style={{ color: "#f43f5e" }}>{err}</p>}
        </>
      )}
    </div>
  );
}
