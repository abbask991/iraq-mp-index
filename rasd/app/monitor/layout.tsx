"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getMySub, isActive, daysLeft, PLAN_LABEL, Sub } from "@/lib/subscription";

const NAV = [
  ["📡", "الرصد الإعلامي", "/monitor"],
  ["🎯", "رصد السوشيال", "/monitor/targets"],
  ["🔔", "الإنذار المبكر", "/monitor/alerts"],
  ["💳", "اشتراكي", "/monitor/account"],
];
const SOON = [
  ["🧠", "البيانات الضخمة"],
  ["✅", "التحقق من المعلومات"],
  ["📊", "المؤشرات والدراسات"],
  ["🗳️", "استطلاعات الرأي"],
  ["🤝", "العلاقات الإعلامية"],
];

export default function DashLayout({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<"loading" | "guest" | "locked" | "ok">("loading");
  const [sub, setSub] = useState<Sub | null>(null);
  const path = usePathname();

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setState("guest"); return; }
      const s = await getMySub();
      setSub(s);
      setState(isActive(s) ? "ok" : "locked");
    })();
  }, []);

  if (state === "loading") return <p className="muted" style={{ padding: 30 }}>جارٍ التحقق…</p>;

  if (state === "guest") return (
    <div className="card" style={{ maxWidth: 460, margin: "40px auto" }}>
      <h2>📡 لوحة الرصد</h2>
      <p className="muted">هذه اللوحة للمشتركين. <Link href="/login">سجّل الدخول</Link> أو أنشئ حساباً للبدء.</p>
    </div>
  );

  if (state === "locked") return (
    <div className="card" style={{ maxWidth: 520, margin: "40px auto", textAlign: "center" }}>
      <div style={{ fontSize: 40 }}>🔒</div>
      <h2>اشتراكك غير مُفعّل</h2>
      <p className="muted">
        {sub?.status === "expired" ? "انتهت صلاحية اشتراكك." : "حسابك بانتظار التفعيل."} باقتك الحالية:
        <b> {PLAN_LABEL[sub?.plan || "trial"]}</b>.
      </p>
      <p className="muted">تواصل معنا لتفعيل أو تجديد الباقة المناسبة (فواتير B2B).</p>
      <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 14 }}>
        <a className="btn" href="https://wa.me/9647700000000" target="_blank" rel="noopener">تواصل عبر واتساب</a>
        <a className="btn ghost" href="#" onClick={async (e) => { e.preventDefault(); await supabase.auth.signOut(); location.href = "/login"; }}>خروج</a>
      </div>
    </div>
  );

  const dl = daysLeft(sub);
  return (
    <div className="admin-shell">
      <div className="admin-main">
        {sub?.plan === "trial" && (
          <div className="trial-banner">
            🎁 أنت على التجربة المجانية{dl != null ? ` — باقٍ ${dl} يوم` : ""}. للترقية تواصل معنا.
          </div>
        )}
        {children}
      </div>
      <aside className="admin-side">
        <div className="grp">الأقسام</div>
        {NAV.map(([icon, label, href]) => (
          <Link key={href} href={href} className={path === href ? "active" : ""}>
            <span>{icon}</span> {label}
          </Link>
        ))}
        {SOON.map(([icon, label]) => (
          <span key={label} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 10px", opacity: 0.45, fontSize: 13 }}>
            <span>{icon}</span> {label}
            <span style={{ marginInlineStart: "auto", fontSize: 10, background: "#1f2a3d", padding: "1px 6px", borderRadius: 6 }}>قريباً</span>
          </span>
        ))}
        <div className="grp">الحساب</div>
        <div style={{ padding: "4px 10px", fontSize: 12 }} className="muted">
          الباقة: <b style={{ color: "var(--accent)" }}>{PLAN_LABEL[sub?.plan || "trial"]}</b>
        </div>
        <a href="#" onClick={async (e) => { e.preventDefault(); await supabase.auth.signOut(); location.href = "/login"; }}>↩︎ تسجيل الخروج</a>
      </aside>
    </div>
  );
}
