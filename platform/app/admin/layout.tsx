"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { isAdmin } from "@/lib/admin";
import { supabase } from "@/lib/supabaseClient";

const NAV = [
  { grp: "عام", items: [["🏠", "لوحة التحكم", "/admin"]] },
  { grp: "المحتوى", items: [
    ["👤", "النواب", "/admin/mps"],
    ["⚙️", "الإعدادات", "/admin/settings"],
    ["📤", "استيراد", "/admin/import"],
  ] },
  { grp: "الرصد", items: [["📡", "رصد X/يوتيوب", "/admin/x"]] },
  { grp: "المجتمع", items: [["💬", "التعليقات", "/admin/comments"]] },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<"loading" | "ok" | "denied">("loading");
  const path = usePathname();
  useEffect(() => { isAdmin().then((ok) => setState(ok ? "ok" : "denied")); }, []);

  if (state === "loading") return <p className="muted">جارٍ التحقق…</p>;
  if (state === "denied")
    return (
      <div className="card">
        <h2>لوحة الإدارة</h2>
        <p className="muted">هذه الصفحة للمشرفين فقط. <Link href="/login">سجّل الدخول</Link> بحساب مشرف.</p>
      </div>
    );

  return (
    <div className="admin-shell">
      <div className="admin-main">{children}</div>
      <aside className="admin-side">
        {NAV.map((g) => (
          <div key={g.grp}>
            <div className="grp">{g.grp}</div>
            {g.items.map(([icon, label, href]) => (
              <Link key={href} href={href} className={path === href ? "active" : ""}>
                <span>{icon}</span> {label}
              </Link>
            ))}
          </div>
        ))}
        <div className="grp">أخرى</div>
        <Link href="/">🌐 الموقع العام</Link>
        <a href="#" onClick={async (e) => { e.preventDefault(); await supabase.auth.signOut(); location.href = "/login"; }}>
          ↩︎ تسجيل الخروج
        </a>
      </aside>
    </div>
  );
}
