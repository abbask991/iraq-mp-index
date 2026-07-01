"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getMySub, isActive, daysLeft, PLAN_LABEL, Sub } from "@/lib/subscription";
import { getLang, setLang, applyDir, tr, Lang, getTheme, setTheme, applyTheme, Theme } from "@/lib/i18n";
import CommandPalette from "@/components/CommandPalette";
import Logo from "@/components/Logo";
import { NAV_GROUPS, isAdminEmail, type NavItem } from "@/lib/nav";
import { apiGet } from "@/lib/api";

type Item = NavItem;

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
  const [hidden, setHidden] = useState<Set<string>>(new Set());   // features hidden for this plan
  const [isAdmin, setIsAdmin] = useState(false);
  const [preview, setPreview] = useState(false);   // admin previewing a client's hidden set
  const path = usePathname();

  useEffect(() => {
    setLangState(getLang());
    setThemeState(getTheme());
    applyDir();
    applyTheme();
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setState("guest"); return; }
      setIsAdmin(isAdminEmail(user.email));
      const s = await getMySub();
      setSub(s);
      setState(isActive(s) ? "ok" : "locked");
      // feature visibility. Admins see everything UNLESS a preview is active (so they
      // can verify a client's experience). Non-admins: per-USER override wins, else plan.
      if (isAdminEmail(user.email)) {
        try {
          const pv = window.localStorage.getItem("sentinel_preview");
          if (pv) { setHidden(new Set(JSON.parse(pv))); setPreview(true); }
        } catch { /* ignore */ }
      } else {
        try {
          const u = await apiGet(`/api/entitlements/user?uid=${user.id}`);
          if (u?.has_override) {
            setHidden(new Set(u.hidden || []));
          } else if (s?.plan) {
            const r = await apiGet(`/api/entitlements?plan=${s.plan}`);
            setHidden(new Set(r?.hidden || []));
          }
        } catch { /* default: show all */ }
      }
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
          // per-package visibility: drop hidden features + admin-only items for non-admins
          const vis = g.items.filter((it) => !(it.href && hidden.has(it.href)) && !(it.adminOnly && !isAdmin));
          if (!vis.length) return null;
          const isOpen = !!openGroups[g.key];
          return (
 <div key={g.key} className="nav-group">
 <button className="nav-grp-h" onClick={() => setOpenGroups((p) => ({ ...p, [g.key]: !p[g.key] }))}
                aria-expanded={isOpen}
                style={{ display: "flex", alignItems: "center", gap: 8, width: "100%",
                         background: vis.some(itemActive) ? "color-mix(in srgb, var(--accent) 10%, transparent)" : "transparent",
                         border: "none", color: "var(--accent)", padding: "11px 13px", cursor: "pointer",
                         fontSize: 14.5, fontWeight: 800, fontFamily: "inherit", marginTop: 4, borderRadius: 10 }}>
 <span style={{ flex: 1, textAlign: "start" }}>{t(g)}</span>
 <span style={{ display: "inline-block", transition: "transform .15s", transform: isOpen ? "rotate(90deg)" : "none", opacity: 0.7 }}>›</span>
 </button>
              {isOpen && <div style={{ borderInlineStart: "2px solid var(--line)", marginInlineStart: 16, paddingInlineStart: 2, marginBottom: 6 }}>
              {vis.map((it) => {
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
 </div>}
 </div>
          );
        })}

 <div className="side-brand">
 <Logo size={22} />
 <span className="t"><b>Sentinel Intelligence</b><br />by Integrate Dynamics</span>
 </div>
 </aside>

 <div className="admin-main">
        {preview && (
 <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", background: "color-mix(in srgb,#6366f1 16%,transparent)", border: "1px solid #6366f1", borderRadius: 10, padding: "8px 12px", marginBottom: 12, fontSize: 13 }}>
 <span>👁️ <b>وضع المعاينة مفعّل</b> — تشاهد القائمة كما يراها العميل (بعض الميزات مخفيّة).</span>
 <button className="btn ghost" style={{ marginInlineStart: "auto", fontSize: 12 }}
              onClick={() => { window.localStorage.removeItem("sentinel_preview"); window.location.reload(); }}>إيقاف المعاينة</button>
 </div>
        )}
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
