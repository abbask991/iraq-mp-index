import "./globals.css";
import Link from "next/link";

export const metadata = {
  title: "تقييم النواب — منصة المجتمع",
  description: "منصة المجتمع لتقييم أداء نواب مجلس النواب العراقي",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body>
        <div className="wrap">
          <div className="topbar">
            <Link href="/" style={{ fontWeight: 800, color: "var(--text)" }}>🏛️ تقييم النواب</Link>
            <span style={{ display: "flex", gap: 14 }}>
              <Link href="/admin" className="muted">الإدارة</Link>
              <Link href="/login" className="muted">تسجيل الدخول</Link>
            </span>
          </div>
          <div className="banner">
            ⚠️ نموذج أوّلي — تقييمات الجمهور هنا <b>للعرض فقط ولا تؤثر على الترتيب الرسمي</b> في هذه المرحلة.
          </div>
          {children}
        </div>
      </body>
    </html>
  );
}
