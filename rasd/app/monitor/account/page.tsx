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

export default function Account() {
  const [sub, setSub] = useState<Sub | null>(null);
  const [email, setEmail] = useState("");

  useEffect(() => {
    getMySub().then(setSub);
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email || ""));
  }, []);

  const dl = daysLeft(sub);
  return (
    <div>
      <h2>💳 اشتراكي</h2>
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

      <div className="card">
        <b>ترقية أو تجديد</b>
        <p className="muted" style={{ marginTop: 6 }}>الاشتراك بالتفعيل المباشر — تواصل معنا لترقية باقتك أو تجديدها (فواتير B2B).</p>
        <a className="btn" href="https://wa.me/9647700000000" target="_blank" rel="noopener">تواصل للترقية</a>
      </div>
    </div>
  );
}
