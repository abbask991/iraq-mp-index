import "./globals.css";
import Link from "next/link";
import DirInit from "@/components/DirInit";

export const metadata = {
  title: "Sentinel Intelligence — منصّة الاستخبارات الإعلامية",
  description: "Sentinel Intelligence by Integrate Dynamics — استخبارات إعلامية وسياسية ومؤسسية: رصد متعدّد المنصّات، تحليل الرأي العام، الإنذار المبكر، وتقارير ذكية.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
 <html lang="ar" dir="rtl">
 <body>
 <DirInit />
 <div className="wrap">
 <div className="topbar">
 <Link href="/" style={{ fontWeight: 800, color: "var(--text)" }}> مركز الرصد</Link>
 <span style={{ display: "flex", gap: 14 }}>
 <Link href="/monitor" className="muted">لوحتي</Link>
 <Link href="/#pricing" className="muted">الباقات</Link>
 <Link href="/login" className="muted">دخول</Link>
 </span>
 </div>
          {children}
 </div>
 </body>
 </html>
  );
}
