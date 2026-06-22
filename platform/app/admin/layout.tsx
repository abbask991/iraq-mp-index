"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { isAdmin } from "@/lib/admin";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<"loading" | "ok" | "denied">("loading");
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
    <div>
      <div className="topbar" style={{ borderBottom: 0, paddingBottom: 0 }}>
        <b>لوحة الإدارة</b>
        <span style={{ display: "flex", gap: 14 }}>
          <Link href="/admin/settings" className="muted">الإعدادات</Link>
          <Link href="/admin/mps" className="muted">النواب</Link>
          <Link href="/admin/import" className="muted">استيراد</Link>
          <Link href="/" className="muted">الموقع</Link>
        </span>
      </div>
      <div style={{ marginTop: 18 }}>{children}</div>
    </div>
  );
}
