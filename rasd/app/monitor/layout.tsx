"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getMySub, isActive, daysLeft, PLAN_LABEL, Sub } from "@/lib/subscription";
import { getLang, setLang, applyDir, tr, Lang, getTheme, setTheme, applyTheme, Theme } from "@/lib/i18n";
import CommandPalette from "@/components/CommandPalette";
import Logo from "@/components/Logo";

type Item = { ar: string; en: string; href?: string; matchPrefix?: string; soon?: boolean; action?: "logout"; plan?: boolean; danger?: boolean };
type Group = { key: string; icon: string; ar: string; en: string; defaultOpen?: boolean; items: Item[] };

// Data-driven navigation — an intelligence OS, not a flat tool list. Every existing
// route is preserved; routeless items render as "قريباً". Labels are executive-tuned.
const NAV_GROUPS: Group[] = [
  {
    key: "ops", icon: "🎯", ar: "مركز العمليات", en: "Operations Center", defaultOpen: true,
    items: [
      { ar: "🔴 غرفة الحرب (مباشر)", en: "🔴 Live War Room", href: "/monitor/warroom", danger: true },
      { ar: "مركز القيادة (ابدأ هنا)", en: "Command Center (start here)", href: "/monitor/command" },
      { ar: "لوحة القيادة التنفيذية", en: "Executive Dashboard", href: "/monitor/overview" },
      { ar: "ماذا تغيّر خلال 24 ساعة؟", en: "What Changed in 24h?", href: "/monitor/changes" },
      { ar: "التقرير اليومي", en: "Daily Brief", href: "/monitor/brief" },
      { ar: "التقرير الشامل", en: "Full Dossier", href: "/monitor/dossier" },
      { ar: "ضابط الاستخبارات", en: "Chief Intelligence", href: "/monitor/chief" },
      { ar: "المحلّل الذكي (اسأل أي سؤال)", en: "AI Analyst", href: "/monitor/analyst" },
    ],
  },
  {
    key: "media", icon: "📡", ar: "الرصد الإعلامي", en: "Media Monitoring",
    items: [
      { ar: "الإعلام التقليدي", en: "Traditional Media", href: "/monitor" },
      { ar: "الإعلام الرقمي", en: "Digital Media", href: "/monitor/targets" },
      { ar: "الرصد عبر المنصّات", en: "Cross-Platform", href: "/monitor/cross-platform" },
      { ar: "الصورة الاستخباراتية الموحّدة", en: "Unified Intelligence Picture", href: "/monitor/fusion" },
      { ar: "استخبارات فيسبوك", en: "Facebook Intelligence", href: "/monitor/facebook" },
      { ar: "أرشيف X (يكبر يومياً)", en: "X Archive (grows daily)", href: "/monitor/archive" },
      { ar: "الإعدادات: قائمة المتابعة", en: "Settings: Watchlist", href: "/monitor/settings" },
    ],
  },
  {
    key: "analysis", icon: "📊", ar: "التحليل والبحوث", en: "Analysis & Research",
    items: [
      { ar: "تحليل المحتوى", en: "Content Analysis", href: "/monitor/content" },
      { ar: "حصة الصوت (SOV)", en: "Share of Voice", href: "/monitor/sov" },
      { ar: "المؤشرات والـKPIs", en: "Indices & KPIs", href: "/monitor/index-report" },
      { ar: "التحليلات المتقدمة", en: "Advanced Analytics", href: "/monitor/network" },
      { ar: "استطلاع الرأي الاجتماعي", en: "Social Opinion Poll", href: "/monitor/polling" },
      { ar: "الدراسات والبحوث", en: "Studies & Research", soon: true },
      { ar: "استطلاعات الرأي", en: "Opinion Polls", soon: true },
    ],
  },
  {
    key: "trends", icon: "📈", ar: "الترندات والإنذار", en: "Trends & Early Warning",
    items: [
      { ar: "ترندات الآن", en: "Trending Now", href: "/monitor/discover" },
      { ar: "تحليل ترند محدّد", en: "Trend Analysis", href: "/monitor/trends" },
      { ar: "الإنذار المبكر", en: "Early Warning", href: "/monitor/alerts" },
      { ar: "التنبّؤ والإنذار المبكر", en: "Predictive Engine", href: "/monitor/predictive" },
    ],
  },
  {
    key: "campaigns", icon: "🛡️", ar: "الحملات والتضليل", en: "Campaigns & Disinformation",
    items: [
      { ar: "رادار الحملات", en: "Campaign Radar", href: "/monitor/campaigns" },
      { ar: "فحص حملة محدّدة", en: "Campaign Check", href: "/monitor/campaign" },
      { ar: "كشف الشبكات المنسّقة", en: "Coordinated Networks", href: "/monitor/coordination" },
      { ar: "كشف التضليل والتزييف", en: "Disinformation", href: "/monitor/disinfo" },
      { ar: "تتبّع المصدر (Patient Zero)", en: "Patient Zero", href: "/monitor/patient-zero" },
      { ar: "رادار الحسابات الجديدة", en: "New Accounts Radar", href: "/monitor/new-accounts" },
    ],
  },
  {
    key: "narratives", icon: "🧵", ar: "السرديات والمعركة الإعلامية", en: "Narratives & Battlefield",
    items: [
      { ar: "غرفة حرب السرديات", en: "Narrative War Room", href: "/monitor/narratives" },
      { ar: "ساحة المعركة الإعلامية", en: "Media Battlefield", href: "/monitor/battlefield" },
      { ar: "التأثير الإقليمي (العراق ← الجوار)", en: "Regional Influence", href: "/monitor/regional-influence" },
    ],
  },
  {
    key: "entities", icon: "🏛️", ar: "الكيانات والتأثير", en: "Entities & Influence",
    items: [
      { ar: "مساحة عمل الكيان", en: "Entity Workspace", href: "/monitor/entities/%D9%88%D8%B2%D8%A7%D8%B1%D8%A9%20%D8%A7%D9%84%D9%83%D9%87%D8%B1%D8%A8%D8%A7%D8%A1/workspace", matchPrefix: "/monitor/entities" },
      { ar: "التوأم الرقمي", en: "Digital Twin", href: "/monitor/intelligence" },
      { ar: "المقارنة (كيان مقابل كيان)", en: "Compare Entities", href: "/monitor/compare" },
      { ar: "تحليل الحسابات والمؤثرين", en: "Account & Influencer Analysis", href: "/monitor/profiler" },
      { ar: "رادار المؤثّرين", en: "Influencer Radar", href: "/monitor/influencers" },
      { ar: "مؤشر الرأي العام الرقمي (PPOI)", en: "Public Opinion Index (PPOI)", href: "/monitor/opinion" },
    ],
  },
  {
    key: "corporate", icon: "🏢", ar: "استخبارات الشركات والمؤسسات", en: "Corporate Intelligence",
    items: [
      { ar: "مركز الاستخبارات المؤسسية", en: "Corporate Intelligence Center", href: "/monitor/corporate" },
      { ar: "سمعة الشركة", en: "Brand Reputation", soon: true },
      { ar: "شكاوى العملاء", en: "Customer Complaints", soon: true },
      { ar: "مراقبة المنافسين", en: "Competitor Monitoring", soon: true },
      { ar: "مراقبة الاحتيال والصفحات المزيفة", en: "Fraud & Fake Pages", soon: true },
      { ar: "مؤشر المخاطر المؤسسية", en: "Corporate Risk Index", soon: true },
    ],
  },
  {
    key: "reports", icon: "📄", ar: "التقارير والمخرجات", en: "Reports & Deliverables",
    items: [
      { ar: "التقرير اليومي", en: "Daily Brief", href: "/monitor/brief" },
      { ar: "التقرير الشامل", en: "Full Dossier", href: "/monitor/dossier" },
      { ar: "تقارير الحملات", en: "Campaign Reports", soon: true },
      { ar: "تقارير الكيانات", en: "Entity Reports", soon: true },
      { ar: "تقارير الأزمات", en: "Crisis Reports", soon: true },
      { ar: "تقارير PDF / PowerPoint", en: "PDF / PowerPoint Reports", soon: true },
    ],
  },
  {
    key: "system", icon: "⚙️", ar: "النظام والإعدادات", en: "System & Settings",
    items: [
      { ar: "الحساب واشتراكي", en: "Account & Subscription", href: "/monitor/account" },
      { ar: "الباقة الحالية", en: "Current Plan", plan: true },
      { ar: "الإعدادات: قائمة المتابعة", en: "Settings: Watchlist", href: "/monitor/settings" },
      { ar: "مركز التحكّم بالتكلفة", en: "Cost Control Center", href: "/monitor/system/cost-center" },
      { ar: "الاستهلاك والكلفة", en: "Usage & Cost", href: "/monitor/usage" },
      { ar: "إدارة المستخدمين", en: "User Management", soon: true },
      { ar: "حالة النظام", en: "System Status", soon: true },
      { ar: "سجل النشاط", en: "Activity Log", soon: true },
      { ar: "تسجيل الخروج", en: "Log out", action: "logout" },
    ],
  },
  {
    key: "soon", icon: "🔜", ar: "قريباً", en: "Coming Soon",
    items: [
      { ar: "الرصد الدولي", en: "International Monitoring", soon: true },
      { ar: "الدراسات والبحوث", en: "Studies & Research", soon: true },
      { ar: "استطلاعات الرأي", en: "Opinion Polls", soon: true },
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

  const [clock, setClock] = useState("");
  const [navOpen, setNavOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  useEffect(() => {
    const f = () => setClock(new Date().toLocaleTimeString("ar-IQ", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }));
    f(); const id = setInterval(f, 1000); return () => clearInterval(id);
  }, []);
  const itemActive = (it: Item) => !!it.href && (path === it.href || (!!it.matchPrefix && !!path?.startsWith(it.matchPrefix)));
  // open the default group on first mount + auto-open whichever group holds the active route
  useEffect(() => {
    setOpenGroups((prev) => {
      const fresh = Object.keys(prev).length === 0;
      const next = { ...prev };
      for (const g of NAV_GROUPS) {
        if (fresh && g.defaultOpen) next[g.key] = true;
        if (g.items.some(itemActive)) next[g.key] = true;
      }
      return next;
    });
  }, [path]);

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
  const allItems = NAV_GROUPS.flatMap((g) => g.items.filter((it) => it.href));
  const cur = allItems.find((it) => it.href === path);
  const sectionTitle = cur ? t(cur) : (lang === "ar" ? "مركز العمليات" : "Operations Center");
  const paletteItems = NAV_GROUPS.flatMap((g) => g.items.filter((it) => it.href && !it.soon).map((it) => ({ label: t(it), href: it.href!, group: t(g) })));

  return (
 <>
 <div className="console-bar">
 <div className="cb-left">
 <button className="cb-burger" aria-label="menu" onClick={() => setNavOpen((v) => !v)}>{navOpen ? "✕" : "☰"}</button>
 <Logo size={24} />
 <span className="cb-brand">Sentinel<span className="cb-brand-2"> Intelligence</span></span>
 <span className="cb-chev">›</span>
 <span className="cb-section">{sectionTitle}</span>
 </div>
 <div className="cb-right">
 <CommandPalette items={paletteItems} />
 <span className="cb-clock"><span className="cb-dot" />{clock}</span>
 <button className="cb-btn" onClick={() => setLang(lang === "ar" ? "en" : "ar")}>{lang === "ar" ? "EN" : "ع"}</button>
 <button className="cb-btn" onClick={toggleTheme}>{theme === "dark" ? "☀" : "☾"}</button>
 </div>
 </div>
 {navOpen && <div className="nav-overlay" onClick={() => setNavOpen(false)} />}
 <div className="admin-shell">
 <aside className={"admin-side" + (navOpen ? " open" : "")} onClick={(e) => { if ((e.target as HTMLElement).closest("a")) setNavOpen(false); }}>
        {LangBtn}
        {NAV_GROUPS.map((g) => {
          const isOpen = !!openGroups[g.key];
          return (
 <div key={g.key} className="nav-group">
 <button className="nav-grp-h" onClick={() => setOpenGroups((p) => ({ ...p, [g.key]: !p[g.key] }))}
                aria-expanded={isOpen}
                style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", background: "transparent",
                         border: "none", color: "var(--muted)", padding: "9px 10px", cursor: "pointer",
                         fontSize: 12, fontWeight: 800, letterSpacing: 0.2 }}>
 <span style={{ fontSize: 14 }}>{g.icon}</span>
 <span style={{ flex: 1, textAlign: "start" }}>{t(g)}</span>
 <span style={{ display: "inline-block", transition: "transform .15s", transform: isOpen ? "rotate(90deg)" : "none", opacity: 0.7 }}>›</span>
 </button>
              {isOpen && g.items.map((it) => {
                if (it.plan) return (
 <div key="plan" style={{ padding: "4px 12px", fontSize: 12 }} className="muted">
                    {lang === "ar" ? "الباقة" : "Plan"}: <b style={{ color: "var(--accent)" }}>{PLAN_LABEL[sub?.plan || "trial"]}</b>
 </div>
                );
                if (it.action === "logout") return (
 <a key="logout" href="#" onClick={async (e) => { e.preventDefault(); await supabase.auth.signOut(); location.href = "/login"; }}>{t(it)}</a>
                );
                if (it.soon || !it.href) return (
 <span key={it.en} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", opacity: 0.4, fontSize: 13 }}>
 {t(it)}
 <span style={{ marginInlineStart: "auto", fontSize: 10, background: "#1f2a3d", padding: "1px 6px", borderRadius: 6 }}>{t(T.comingSoon)}</span>
 </span>
                );
                return (
 <Link key={it.en + it.href} href={it.href} className={itemActive(it) ? "active" : ""}
                    style={it.danger && !itemActive(it) ? { background: "color-mix(in srgb, #f43f5e 12%, transparent)", fontWeight: 800 } : undefined}>
 {t(it)}
 </Link>
                );
              })}
 </div>
          );
        })}

 <div className="side-brand">
 <Logo size={22} />
 <span className="t"><b>Sentinel Intelligence</b><br />by Integrate Dynamics</span>
 </div>
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
 </>
  );
}
