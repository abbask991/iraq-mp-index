"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getMySub, daysLeft, PLAN_LABEL, Sub } from "@/lib/subscription";

const PLAN_FEATURES: Record<string, string[]> = {
  trial: ["رصد محدود للتجربة", "أخبار + X", "تقارير PDF"],
  basic: ["رصد حتى ٣ أهداف", "أخبار + X", "تقارير PDF", "تحليل النبرة"],
  pro: ["أهداف غير محدودة", "تحليل التعليقات والردود", "إنذار مبكر", "تقارير دورية"],
  enterprise: ["كل ميزات الاحترافي", "وحدات مخصّصة", "تحليل الحملات وشبكات التأثير", "دعم وتدريب"],
};

export default function AccountView() {
  const [sub, setSub] = useState<Sub | null>(null);
  const [email, setEmail] = useState("");
  const [uid, setUid] = useState("");
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [chatId, setChatId] = useState("");
  const [saved, setSaved] = useState("");

  useEffect(() => {
    getMySub().then(setSub);
    supabase.auth.getUser().then(async ({ data }) => {
      setEmail(data.user?.email || ""); setUid(data.user?.id || "");
      const { data: p } = await supabase.from("notify_prefs").select("*").eq("user_id", data.user?.id).maybeSingle();
      if (p) { setNotifyEmail(p.notify_email ?? true); setChatId(p.telegram_chat_id || ""); }
    });
  }, []);

  const saveNotify = async () => {
    setSaved("جارٍ الحفظ…");
    const { error } = await supabase.from("notify_prefs").upsert(
      { user_id: uid, email, notify_email: notifyEmail, telegram_chat_id: chatId || null, updated_at: new Date().toISOString() },
      { onConflict: "user_id" });
    setSaved(error ? `خطأ: ${error.message}` : "تم الحفظ");
    setTimeout(() => setSaved(""), 2500);
  };

  const dl = daysLeft(sub);
  return (
 <div>
 <h2> اشتراكي</h2>
 <p className="muted">تفاصيل حسابك وباقتك الحالية.</p>

 <div className="card" style={{ marginBottom: 14 }}>
 <div className="stat-grid">
 <div className="stat"><div className="v" style={{ color: "var(--accent)" }}>{PLAN_LABEL[sub?.plan || "trial"]}</div><div className="l">الباقة</div></div>
 <div className="stat"><div className="v" style={{ color: sub?.status === "active" ? "#22c55e" : "#f43f5e" }}>{sub?.status === "active" ? "فعّال" : "غير فعّال"}</div><div className="l">الحالة</div></div>
 <div className="stat"><div className="v">{dl != null ? dl : "∞"}</div><div className="l">{dl != null ? "يوم متبقٍّ" : "بدون انتهاء"}</div></div>
 </div>
 <div className="muted" style={{ marginTop: 10, fontSize: 13 }}>
          البريد: {email}{sub?.company ? ` · الجهة: ${sub.company}` : ""}
          {sub?.expires_at ? ` · ينتهي: ${sub.expires_at.slice(0, 10)}` : ""}
 </div>
 </div>

 <div className="card" style={{ marginBottom: 14 }}>
 <b>ميزات باقتك</b>
 <ul style={{ margin: "10px 0 0", paddingInlineStart: 18, lineHeight: 2 }}>
          {(PLAN_FEATURES[sub?.plan || "trial"] || []).map((f) => <li key={f}>{f}</li>)}
 </ul>
 </div>

 <div className="card" style={{ marginBottom: 14 }}>
 <b>إعدادات التنبيهات</b>
 <p className="muted" style={{ marginTop: 6, fontSize: 13 }}>وين توصلك التنبيهات لمّا يكتشف النظام صعوداً سلبياً أو حملة (يفحص كل ٦ ساعات).</p>
 <label style={{ display: "flex", alignItems: "center", gap: 8, margin: "10px 0", fontSize: 14 }}>
 <input type="checkbox" checked={notifyEmail} onChange={(e) => setNotifyEmail(e.target.checked)} style={{ width: "auto" }} />
            تنبيهات بالبريد ({email})
 </label>
 <div className="field" style={{ marginTop: 6 }}>
 <label>معرّف تيليغرام (Chat ID) — اختياري</label>
 <input placeholder="مثال: 123456789 (من بوت @userinfobot)" value={chatId} onChange={(e) => setChatId(e.target.value)} />
 </div>
 <button className="btn" onClick={saveNotify}>حفظ</button>
          {saved && <span className="muted" style={{ marginInlineStart: 12 }}>{saved}</span>}
 <p className="muted" style={{ fontSize: 11, marginTop: 8 }}>
            للتيليغرام: ابدأ محادثة مع بوت المركز، وخذ Chat ID من <b>@userinfobot</b> وحطّه هنا.
 </p>
 </div>

 <div className="card">
 <b>ترقية أو تجديد</b>
 <p className="muted" style={{ marginTop: 6 }}>الاشتراك بالتفعيل المباشر — تواصل معنا لترقية باقتك أو تجديدها (فواتير B2B).</p>
 <a className="btn" href="https://wa.me/9647700000000" target="_blank" rel="noopener">تواصل للترقية</a>
 </div>
 </div>
  );
}
