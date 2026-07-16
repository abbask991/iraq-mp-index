// Order matters: tokens.css declares the layer order (tokens < legacy < ui).
import "./styles/tokens.css";
import "./globals.css";
import "./styles/primitives.css";
import { Tajawal } from "next/font/google";
import DirInit from "@/components/DirInit";

// Self-hosted via next/font — replaces the render-blocking @import that used to
// sit at the top of globals.css.
const tajawal = Tajawal({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "700", "800", "900"],
  display: "swap",
  variable: "--font-tajawal",
});

export const metadata = {
  title: "Sentinel Intelligence — منصّة الاستخبارات الإعلامية",
  description: "Sentinel Intelligence by Integrate Dynamics — استخبارات إعلامية وسياسية ومؤسسية: رصد متعدّد المنصّات، تحليل الرأي العام، الإنذار المبكر، وتقارير ذكية.",
};

// Root owns <html>/<body> only. Each route group supplies its own chrome:
// (site) → landing/login, (console) → the app shell.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={tajawal.variable}>
      <body>
        <DirInit />
        {children}
      </body>
    </html>
  );
}
