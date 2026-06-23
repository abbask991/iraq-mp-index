import "./globals.css";
import Link from "next/link";

export const metadata = {
  title: "مركز الرصد — الرصد والتحليل الإعلامي",
  description: "مركز الرصد: رصد وتحليل إعلامي احترافي — أخبار، منصّات التواصل، تحليل المشاعر، الإنذار المبكر، وتقارير ذكية.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body>
        <div className="wrap">
          <div className="topbar">
            <Link href="/" style={{ fontWeight: 800, color: "var(--text)" }}>📡 مركز الرصد</Link>
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
