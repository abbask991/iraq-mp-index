"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getMySub, isActive, daysLeft, PLAN_LABEL, Sub } from "@/lib/subscription";
import { getLang, setLang, applyDir, tr, Lang, getTheme, setTheme, applyTheme, Theme } from "@/lib/i18n";

type Item = { icon: string; ar: string; en: string; href?: string };
const SECTORS: { ar: string; en: string; items: Item[] }[] = [
  {
    ar: "القطاع الأول · الرصد الإعلامي", en: "Sector 1 · Media Monitoring",
    items: [
      { icon: "", ar: "الإعلام التقليدي", en: "Traditional Media", href: "/monitor" },
      { icon: "", ar: "الإعلام الرقمي", en: "Digital Media", href: "/monitor/targets" },
      { icon: "", ar: "الرصد الدولي", en: "International Monitoring" },
    ],
  },
  {
    ar: "القطاع الثاني · التحليل والبحوث", en: "Sector 2 · Analysis & Research",
    items: [
      { icon: "", ar: "تحليل المحتوى", en: "Content Analysis", href: "/monitor/content" },
      { icon: "", ar: "حصة الصوت (SOV)", en: "Share of Voice", href: "/monitor/sov" },
      { icon: "", ar: "الدراسات والبحوث", en: "Studies & Research" },
      { icon: "", ar: "استطلاعات الرأي", en: "Opinion Polls" },
    ],
  },
  {
    ar: "القطاع الثالث · البيانات والذكاء", en: "Sector 3 · Data & AI",
    items: [
      { icon: "", ar: "البيانات الضخمة والتحليلات", en: "Big Data & Analytics", href: "/monitor/network" },
      { icon: "", ar: "الحسابات الجديدة", en: "New Accounts", href: "/monitor/new-accounts" },
      { icon: "", ar: "رادار الحملات", en: "Campaign Radar", href: "/monitor/campaigns" },
      { icon: "", ar: "فحص حملة محدّدة", en: "Campaign Check", href: "/monitor/campaign" },
      { icon: "", ar: "ترندات الآن", en: "Trending Now", href: "/monitor/discover" },
      { icon: "", ar: "تحليل ترند محدّد", en: "Trend Analysis", href: "/monitor/trends" },
      { icon: "", ar: "المؤشرات والـKPIs", en: "Indices & KPIs", href: "/monitor/index-report" },
      { icon: "", ar: "الإنذار المبكر", en: "Early Warning", href: "/monitor/alerts" },
    ],
  },
  {
    ar: "القطاع الرابع · الاستخبارات السياسية", en: "Sector 4 · Political Intelligence",
    items: [
      { icon: "", ar: "التوأم الرقمي", en: "Digital Twin", href: "/monitor/intelligence" },
    ],
  },
];

const T = {
  verifying: { ar: "جارٍ التحقق…", en: "Verifying…" },
  panelTitle: { ar: " لوحة الرصد", en: " Monitoring Dashboard" },
  subscribersOnly: { ar: "هذه اللوحة للمشتركين.", en: "This dashboard is for subscribers." },
  login: { ar: "سجّل الدخول", en: "Log in" },
  orSignup: { ar: "أو أنشئ حساباً للبدء.", en: "or create an account to start." },
  notActiveT: { ar: "اشتراكك غير مُفعّل", en: "Your subscription is inactive" },
  expired: { ar: "انتهت صلاحية اشتراكك.", en: "Your subscription has expired." },
  pending: { ar: "حسابك بانتظار التفعيل.", en: "Your account is awaiting activation." },
  currentPlan: { ar: "باقتك الحالية:", en: "Current plan:" },
  contactActivate: { ar: "تواصل معنا لتفعيل أو تجديد الباقة المناسبة.", en: "Contact us to activate or renew your plan." },
  whatsapp: { ar: "تواصل عبر واتساب", en: "Contact via WhatsApp" },
  exit: { ar: "خروج", en: "Exit" },
  trial: { ar: "أنت على التجربة المجانية", en: "You're on the free trial" },
  upgrade: { ar: "للترقية تواصل معنا.", en: "Contact us to upgrade." },
  comingSoon: { ar: "قريباً", en: "Coming soon" },
  account: { ar: "الحساب", en: "Account" },
  mySub: { ar: "اشتراكي", en: "My Subscription" },
  plan: { ar: "الباقة", en: "Plan" },
  logout: { ar: "تسجيل الخروج", en: "Log out" },
};

export default function DashLayout({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<"loading" | "guest" | "locked" | "ok">("loading");
  const [sub, setSub] = useState<Sub | null>(null);
  const [lang, setLangState] = useState<Lang>("ar");
  const [theme, setThemeState] = useState<Theme>("dark");
  const path = usePathname();

  useEffect(() => {
    setLangState(getLang());
    setThemeState(getTheme());
    applyDir();
    applyTheme();
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setState("guest"); return; }
      const s = await getMySub();
      setSub(s);
      setState(isActive(s) ? "ok" : "locked");
    })();
  }, []);

  const t = (s: { ar: string; en: string }) => tr(s, lang);
  const toggleTheme = () => { const n: Theme = theme === "dark" ? "light" : "dark"; setTheme(n); setThemeState(n); };
  const Controls = (
 <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
 <button className="btn ghost" style={{ flex: 1, fontSize: 12 }}
        onClick={() => setLang(lang === "ar" ? "en" : "ar")}> {lang === "ar" ? "EN" : "ع"}</button>
 <button className="btn ghost" style={{ flex: 1, fontSize: 12 }}
        onClick={toggleTheme}>{theme === "dark" ? " Light" : " Dark"}</button>
 </div>
  );
  const LangBtn = Controls;

  if (state === "loading") return <p className="muted" style={{ padding: 30 }}>{t(T.verifying)}</p>;

  if (state === "guest") return (
 <div className="card" style={{ maxWidth: 460, margin: "40px auto" }}>
 <h2>{t(T.panelTitle)}</h2>
 <p className="muted">{t(T.subscribersOnly)} <Link href="/login">{t(T.login)}</Link> {t(T.orSignup)}</p>
 </div>
  );

  if (state === "locked") return (
 <div className="card" style={{ maxWidth: 520, margin: "40px auto", textAlign: "center" }}>
 <div style={{ fontSize: 40 }}></div>
 <h2>{t(T.notActiveT)}</h2>
 <p className="muted">
        {sub?.status === "expired" ? t(T.expired) : t(T.pending)} {t(T.currentPlan)}
 <b> {PLAN_LABEL[sub?.plan || "trial"]}</b>.
 </p>
 <p className="muted">{t(T.contactActivate)}</p>
 <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 14 }}>
 <a className="btn" href="https://wa.me/9647700000000" target="_blank" rel="noopener">{t(T.whatsapp)}</a>
 <a className="btn ghost" href="#" onClick={async (e) => { e.preventDefault(); await supabase.auth.signOut(); location.href = "/login"; }}>{t(T.exit)}</a>
 </div>
 <div style={{ maxWidth: 160, margin: "16px auto 0" }}>{LangBtn}</div>
 </div>
  );

  const dl = daysLeft(sub);
  const soon = SECTORS.flatMap((s) => s.items.filter((it) => !it.href));

  return (
 <div className="admin-shell">
 <aside className="admin-side">
        {LangBtn}
 <Link href="/monitor/overview" className={path === "/monitor/overview" ? "active" : ""}>
          {lang === "ar" ? "لوحة القيادة" : "Command Center"}
 </Link>
 <Link href="/monitor/dossier" className={path === "/monitor/dossier" ? "active" : ""}>
          {lang === "ar" ? "التقرير الشامل" : "Full Dossier"}
 </Link>
        {SECTORS.map((sec) => {
          const live = sec.items.filter((it) => it.href);
          if (!live.length) return null;
          return (
 <div key={sec.en}>
 <div className="grp">{t(sec)}</div>
              {live.map((it) => (
 <Link key={it.en + (it.href || "")} href={it.href!} className={path === it.href ? "active" : ""}>
 {t(it)}
 </Link>
              ))}
 </div>
          );
        })}

 <div className="grp">{t(T.account)}</div>
 <Link href="/monitor/account" className={path === "/monitor/account" ? "active" : ""}>{t(T.mySub)}</Link>
 <div style={{ padding: "4px 10px", fontSize: 12 }} className="muted">
          {t(T.plan)}: <b style={{ color: "var(--accent)" }}>{PLAN_LABEL[sub?.plan || "trial"]}</b>
 </div>
 <a href="#" onClick={async (e) => { e.preventDefault(); await supabase.auth.signOut(); location.href = "/login"; }}>{t(T.logout)}</a>

        {/* not-yet-working sections, moved to the bottom */}
 <div className="grp">{t(T.comingSoon)}</div>
        {soon.map((it) => (
 <span key={it.en} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 10px", opacity: 0.4, fontSize: 13 }}>
 {t(it)}
 <span style={{ marginInlineStart: "auto", fontSize: 10, background: "#1f2a3d", padding: "1px 6px", borderRadius: 6 }}>{t(T.comingSoon)}</span>
 </span>
        ))}
 </aside>

 <div className="admin-main">
        {sub?.plan === "trial" && (
 <div className="trial-banner">
             {t(T.trial)}{dl != null ? (lang === "ar" ? ` — باقٍ ${dl} يوم` : ` — ${dl} days left`) : ""}. {t(T.upgrade)}
 </div>
        )}
        {children}
 </div>
 </div>
  );
}
