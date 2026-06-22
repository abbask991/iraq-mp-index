"use client";
import Link from "next/link";

const CARDS = [
  ["⚙️ الإعدادات", "مصادر الأخبار، الكلمات، الهاشتاغات", "/admin/settings"],
  ["👤 النواب", "تعديل الصور وروابط السوشيال والاسم البحثي", "/admin/mps"],
  ["📤 استيراد", "ربط Google Sheet لرفع الأسماء/الإحصاءات", "/admin/import"],
];

export default function AdminHome() {
  return (
    <div>
      <p className="muted">أدر الموقع من هنا — كل تغيير يُحفظ مباشرةً في قاعدة البيانات.</p>
      <div className="grid" style={{ marginTop: 14 }}>
        {CARDS.map(([t, d, href]) => (
          <Link key={href} href={href} className="mpcard">
            <div className="n">{t}</div>
            <div className="m">{d}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
