"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState("");

  async function loginPassword() {
    setErr("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setErr(error.message);
    else router.push("/admin");
  }

  async function loginMagic() {
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
      <p className="muted">سجّل دخولك بالبريد وكلمة السر.</p>

      <input type="email" placeholder="البريد الإلكتروني" value={email}
        onChange={(e) => setEmail(e.target.value)} style={{ margin: "8px 0" }} />
      <input type="password" placeholder="كلمة السر" value={password}
        onChange={(e) => setPassword(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && loginPassword()} style={{ margin: "8px 0" }} />
      <button className="btn" onClick={loginPassword}>دخول</button>

      <hr style={{ borderColor: "var(--line)", margin: "18px 0" }} />
      <p className="muted" style={{ fontSize: 13 }}>أو رابط دخول بالبريد:</p>
      {sent ? <p>✅ تحقق من بريدك.</p> : (
        <button className="btn" style={{ background: "#1f2a3d", color: "var(--text)" }}
          onClick={loginMagic}>إرسال رابط الدخول</button>
      )}

      {err && <p style={{ color: "#f43f5e", marginTop: 12 }}>{err}</p>}
    </div>
  );
}
