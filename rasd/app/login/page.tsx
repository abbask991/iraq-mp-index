"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function Login() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [company, setCompany] = useState("");
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setErr(""); setMsg(""); setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) { setErr(error.message); return; }
        if (company && data.user) {
          await supabase.from("subscriptions").update({ company }).eq("user_id", data.user.id);
        }
        if (!data.session) { setMsg("✅ تم إنشاء الحساب. تحقّق من بريدك لتأكيد الحساب ثم سجّل الدخول."); return; }
        router.push("/monitor");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) { setErr(error.message); return; }
        router.push("/monitor");
      }
    } finally { setBusy(false); }
  }

  return (
    <div className="card" style={{ maxWidth: 440, margin: "40px auto" }}>
      <div className="auth-tabs">
        <button className={mode === "login" ? "on" : ""} onClick={() => setMode("login")}>تسجيل الدخول</button>
        <button className={mode === "signup" ? "on" : ""} onClick={() => setMode("signup")}>حساب جديد</button>
      </div>
      <p className="muted" style={{ marginTop: 10 }}>
        {mode === "signup" ? "أنشئ حسابك وابدأ بتجربة مجانية ٧ أيام." : "ادخل لمتابعة لوحة الرصد."}
      </p>

      {mode === "signup" && (
        <input placeholder="اسم الجهة / الشركة (اختياري)" value={company}
          onChange={(e) => setCompany(e.target.value)} style={{ margin: "8px 0" }} />
      )}
      <input type="email" placeholder="البريد الإلكتروني" value={email}
        onChange={(e) => setEmail(e.target.value)} style={{ margin: "8px 0" }} />
      <input type="password" placeholder="كلمة السر" value={password}
        onChange={(e) => setPassword(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()} style={{ margin: "8px 0" }} />
      <button className="btn" onClick={submit} disabled={busy} style={{ width: "100%" }}>
        {busy ? "…" : mode === "signup" ? "إنشاء الحساب" : "دخول"}
      </button>

      {err && <p style={{ color: "#f43f5e", marginTop: 12 }}>{err}</p>}
      {msg && <p style={{ color: "#22c55e", marginTop: 12 }}>{msg}</p>}
    </div>
  );
}
