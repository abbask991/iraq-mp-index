"use client";
import { useEffect, useState } from "react";
import { apiGet, apiSend } from "@/lib/api";
import { SkelCards } from "@/components/Skeleton";
import { HBars, Spark } from "@/components/MiniCharts";
import { Icon, Badge } from "@/components/ui";
import { useDemo } from "@/components/ui/DemoContext";
import WhatMattersNow, { buildMattersItems } from "@/components/WhatMattersNow";
import RecommendedActions, { type Reco, type RecoType } from "@/components/RecommendedActions";
import ReportGenerationButtons from "@/components/ReportGenerationButtons";
import PlatformContributionCard from "@/components/PlatformContributionCard";
import { CLIENT_TYPES, TEMPLATES, clientType, getClientType, setClientType, type Template } from "@/lib/workspace";

const FIELDS: [string, string, string][] = [
  ["entities", "الكيانات المرصودة", "شخصيات/أحزاب/مؤسسات تريد مراقبتها — واحد بكل سطر"],
  ["keywords", "الكلمات المفتاحية", "كلمات/مواضيع لتتبّعها — واحد بكل سطر"],
  ["brands", "العلامات التجارية", "أسماء الشركات/البراندات — واحد بكل سطر"],
  ["fb_pages", "صفحات فيسبوك", "slug أو رابط صفحة — واحد بكل سطر (facebook.com/الاسم)"],
];

/** Simple structured recommendations from the tenant command-center payload. */
function recosFrom(d: any): Reco[] {
  const out: Reco[] = [];
  (d?.top_risks || []).slice(0, 4).forEach((r: any) => {
    if (!r.recommended_action) return;
    const t: RecoType = /حرج|مرتفع/.test(r.level || "") ? "escalate" : "watch_entity";
    out.push({ id: `risk:${r.entity}`, title: r.recommended_action, type: t,
      priority: /حرج|مرتفع/.test(r.level || "") ? "high" : "medium",
      reason: `${r.entity} · ${r.level} (${r.risk})`, confidence: Math.min(99, r.evidence_count || 0), href: "/monitor/risk?tab=alerts" });
  });
  (d?.recommended_actions || []).forEach((a: string, i: number) => {
    if (out.some((x) => x.title === a)) return;
    out.push({ id: `rec:${i}`, title: a, type: "monitor", priority: "low" });
  });
  return out.slice(0, 8);
}

export default function Workspace() {
  const { demo } = useDemo();
  const [tab, setTab] = useState<"value" | "feed" | "list">("value");
  const [d, setD] = useState<any>(null);
  const [wl, setWl] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState("");
  const [dirty, setDirty] = useState(false);
  const [feed, setFeed] = useState<any>(null);
  const [feedLoading, setFeedLoading] = useState(false);
  // value layer
  const [ct, setCt] = useState("");
  const [cc, setCc] = useState<any>(null);
  const [anger, setAnger] = useState<any>(null);
  const [applyMsg, setApplyMsg] = useState("");

  const load = () => {
    setLoading(true);
    apiGet("/api/workspace/watchlist").then((r) => {
      setD(r);
      const w = r?.watchlist || {};
      setWl(Object.fromEntries(FIELDS.map(([k]) => [k, (w[k] || []).join("\n")])));
    }).finally(() => setLoading(false));
  };
  const loadFeed = () => {
    setFeedLoading(true);
    apiGet("/api/workspace/feed").then(setFeed).catch(() => setFeed(null)).finally(() => setFeedLoading(false));
  };
  const loadValue = () => {
    apiGet("/api/command-center" + (demo ? "?demo=1" : "")).then(setCc).catch(() => setCc(null));
    const q = `scope_type=country&scope_id=${encodeURIComponent("العراق")}&scope_name=${encodeURIComponent("العراق")}&period=week${demo ? "&demo=1" : ""}`;
    apiGet(`/api/indices/public-anger?${q}`).then(setAnger).catch(() => setAnger(null));
  };
  useEffect(() => { load(); setCt(getClientType()); }, []);
  useEffect(() => { loadValue(); /* eslint-disable-next-line */ }, [demo]);
  useEffect(() => { if (tab === "feed" && !feed && d?.workspace) loadFeed(); }, [tab, d]);

  const save = async () => {
    setSaved("…"); setDirty(false);
    const body: any = {};
    FIELDS.forEach(([k]) => { body[k] = (wl[k] || "").split("\n").map((x) => x.trim()).filter(Boolean); });
    const r = await apiSend("/api/workspace/watchlist", "POST", body).catch(() => null);
    setSaved(r?.saved ? "✅ حُفظت قائمتك" : "⚠️ سجّل الدخول أو تعذّر الحفظ");
    setFeed(null);
  };

  const applyTemplate = async (t: Template) => {
    setApplyMsg("جارٍ تطبيق القالب…");
    setClientType(t.clientType); setCt(t.clientType);
    // merge template patch into the watchlist (append unique), then persist
    const next = { ...wl };
    (Object.keys(t.patch) as (keyof typeof t.patch)[]).forEach((k) => {
      const cur = (next[k] || "").split("\n").map((x) => x.trim()).filter(Boolean);
      const add = (t.patch[k] || []).filter((x) => !cur.includes(x));
      next[k] = [...cur, ...add].join("\n");
    });
    setWl(next);
    const body: any = {};
    FIELDS.forEach(([k]) => { body[k] = (next[k] || "").split("\n").map((x) => x.trim()).filter(Boolean); });
    const r = await apiSend("/api/workspace/watchlist", "POST", body).catch(() => null);
    setApplyMsg(r?.saved ? `✅ طُبّق قالب «${t.ar}» — حُدّثت قائمتك ونوع العميل` : `✅ ضُبط نوع العميل «${t.ar}» (سجّل الدخول لحفظ القائمة)`);
    setFeed(null);
    setTimeout(() => setApplyMsg(""), 6000);
  };

  const totalItems = FIELDS.reduce((n, [k]) => n + (wl[k] || "").split("\n").filter((x) => x.trim()).length, 0);
  const cfg = clientType(ct);
  const items = cc ? buildMattersItems(cc, anger) : [];
  const recos = cc ? recosFrom(cc) : [];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
        <div>
          <h2 style={{ margin: 0 }}>مساحة العمل — استخبارات العميل</h2>
          <p className="muted" style={{ marginTop: 4 }}>لوحة قيمة مخصّصة حسب نوع العميل: ما يهمّك الآن، الإجراءات، والتقارير — فوق قائمتك المعزولة.</p>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          {cfg && <Badge t="info" dot>{cfg.ar}</Badge>}
          <select value={ct} onChange={(e) => { setClientType(e.target.value); setCt(e.target.value); }} style={{ width: 170 }}>
            <option value="">— نوع العميل —</option>
            {CLIENT_TYPES.map((c) => <option key={c.key} value={c.key}>{c.ar}</option>)}
          </select>
        </div>
      </div>

      {/* tabs */}
      <div className="auth-tabs" style={{ maxWidth: 460, margin: "12px 0" }}>
        <button className={tab === "value" ? "on" : ""} onClick={() => setTab("value")}>لوحة القيمة</button>
        <button className={tab === "feed" ? "on" : ""} onClick={() => setTab("feed")}>بياناتي الحيّة</button>
        <button className={tab === "list" ? "on" : ""} onClick={() => setTab("list")}>قائمتي ({totalItems})</button>
      </div>

      {applyMsg && <div className="cbox" style={{ marginBottom: 12, borderInlineStart: "4px solid var(--accent)", fontSize: 13 }}>{applyMsg}</div>}

      {/* ---- VALUE DASHBOARD ---- */}
      {tab === "value" && (
        <>
          {!ct && (
            <div className="cbox" style={{ marginBottom: 14, borderInlineStart: "4px solid #f59e0b" }}>
              <b>اختر نوع العميل أو ابدأ بقالب جاهز</b>
              <p className="muted" style={{ fontSize: 13, margin: "6px 0 0" }}>سيُخصّص هذا لوحة القيمة والتقارير الأنسب — ويمكن لقالب أن يهيّئ قائمتك تلقائياً.</p>
            </div>
          )}

          {/* use-case templates */}
          <div className="cbox" style={{ marginBottom: 14 }}>
            <h4 style={{ marginTop: 0 }}><Icon name="clip" size={14} /> قوالب حالات الاستخدام</h4>
            <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>اختر قالباً ليهيّئ نوع العميل + قائمة المتابعة + التقارير الموصى بها.</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {TEMPLATES.map((t) => (
                <button key={t.key} className="btn ghost" style={{ fontSize: 12, padding: "6px 12px" }} title={t.desc} onClick={() => applyTemplate(t)}>
                  {t.ar}
                </button>
              ))}
            </div>
          </div>

          {cc && items.length > 0 && (
            <div style={{ marginBottom: 14 }}><WhatMattersNow items={items} /></div>
          )}

          {cfg && (
            <div className="cbox" style={{ marginBottom: 14 }}>
              <ReportGenerationButtons only={cfg.reports} title={`تقارير مقترحة لـ«${cfg.ar}»`} />
            </div>
          )}

          <div className="cc-grid" style={{ marginBottom: 14 }}>
            {recos.length > 0 && <RecommendedActions actions={recos} />}
            <PlatformContributionCard platforms={cc?.platform_activity} title="مساهمة المنصّات" />
          </div>

          {!cc && <SkelCards count={3} />}
          <p className="muted" style={{ fontSize: 11 }}>لوحة القيمة تعرض صورة مؤسستك (معزولة لكل عميل). التفاصيل الكاملة في الوحدات المختصّة.</p>
        </>
      )}

      {loading && tab !== "value" && <SkelCards count={2} />}
      {!loading && d && !d.workspace && tab !== "value" && (
        <div className="cbox" style={{ borderInlineStart: "4px solid #f59e0b" }}>يجب تسجيل الدخول لعرض مساحتك.</div>
      )}

      {/* ---- WATCHLIST EDITOR ---- */}
      {tab === "list" && !loading && d?.workspace && (
        <>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, alignItems: "center", marginBottom: 10 }}>
            {dirty && <span style={{ fontSize: 12, color: "#f59e0b", fontWeight: 700 }}>● غير محفوظة</span>}
            {saved && <span className="muted" style={{ fontSize: 12 }}>{saved}</span>}
            <button className="btn" onClick={save} style={dirty ? { boxShadow: "0 0 0 2px #f59e0b" } : {}}>حفظ قائمتي</button>
          </div>
          <div className="grid">
            {FIELDS.map(([k, title, hint]) => (
              <div key={k} className="cbox">
                <h4>{title}</h4>
                <textarea rows={6} value={wl[k] || ""} onChange={(e) => { setWl({ ...wl, [k]: e.target.value }); setDirty(true); setSaved(""); }}
                  placeholder={hint} style={{ width: "100%", fontFamily: "inherit", fontSize: 13, resize: "vertical" }} />
                <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>{(wl[k] || "").split("\n").filter((x) => x.trim()).length} عنصر</div>
              </div>
            ))}
          </div>
          <p className="muted" style={{ fontSize: 11, marginTop: 10 }}>الأخبار الحيّة تُجلب مجاناً من Google News لكياناتك. الإثراء بالذكاء الاصطناعي (اختياري) يُحسب على مؤسستك.</p>
        </>
      )}

      {/* ---- LIVE FEED ---- */}
      {tab === "feed" && !loading && d?.workspace && (
        <>
          {feedLoading && <SkelCards count={3} />}
          {!feedLoading && feed?.empty && (
            <div className="cbox" style={{ borderInlineStart: "4px solid #4f9dff" }}>
              {feed.note || "أضف كيانات لقائمتك لعرض بياناتك."}
              <div style={{ marginTop: 10 }}><button className="btn ghost" onClick={() => setTab("list")}>← عدّل قائمتي</button></div>
            </div>
          )}
          {!feedLoading && feed && !feed.empty && (
            <>
              <div className="cc-kpis">
                <div className="cc-kpi"><div className="ic">📰</div><div className="v">{feed.total}</div><div className="l">خبر حديث</div></div>
                <div className="cc-kpi"><div className="ic">🎯</div><div className="v">{feed.terms?.length || 0}</div><div className="l">هدف مرصود</div></div>
                <div className="cc-kpi"><div className="ic">📡</div><div className="v">{feed.by_source?.length || 0}</div><div className="l">مصدر</div></div>
                <div className="cc-kpi"><div className="ic">📈</div><div className="v">{feed.by_day?.length || 0}</div><div className="l">يوم نشِط</div></div>
              </div>
              <div className="cc-grid">
                <div className="cbox">
                  <h4>التغطية حسب الهدف</h4>
                  <HBars data={(feed.by_term || []).slice(0, 8).map((t: any) => ({ label: t.term, value: t.count }))} />
                  {feed.by_day?.length > 1 && (
                    <div style={{ marginTop: 14 }}>
                      <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>النشاط عبر الأيام</div>
                      <Spark data={(feed.by_day || []).map((x: any) => x.count)} color="#34d6c6" />
                    </div>
                  )}
                </div>
                <div className="cbox">
                  <h4>أبرز المصادر</h4>
                  <HBars data={(feed.by_source || []).slice(0, 8).map((s: any) => ({ label: s.source, value: s.count, color: "#4f9dff" }))} />
                </div>
              </div>
              <div className="cbox" style={{ marginTop: 14 }}>
                <h4>آخر الأخبار عن كياناتك ({feed.total})</h4>
                {(feed.items || []).slice(0, 40).map((it: any, i: number) => (
                  <div key={i} className="newsitem">
                    <a href={it.link} target="_blank" rel="noopener">{it.title}</a>
                    <div className="meta">
                      <span className="chip">{it.term}</span>
                      {it.source && <span>{it.source}</span>}
                      {it.date && <span>· {it.date}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
          {!feedLoading && !feed && (
            <div className="cbox">تعذّر تحميل البيانات. <button className="btn ghost" onClick={loadFeed}>إعادة المحاولة</button></div>
          )}
        </>
      )}
    </div>
  );
}
