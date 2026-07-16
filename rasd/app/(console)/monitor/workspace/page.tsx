"use client";
import { useEffect, useState } from "react";
import { apiGet, apiSend } from "@/lib/api";
import { SkelCards } from "@/components/Skeleton";
import { HBars, Spark } from "@/components/MiniCharts";

const FIELDS: [string, string, string][] = [
  ["entities", "الكيانات المرصودة", "شخصيات/أحزاب/مؤسسات تريد مراقبتها — واحد بكل سطر"],
  ["keywords", "الكلمات المفتاحية", "كلمات/مواضيع لتتبّعها — واحد بكل سطر"],
  ["brands", "العلامات التجارية", "أسماء الشركات/البراندات — واحد بكل سطر"],
  ["fb_pages", "صفحات فيسبوك", "slug أو رابط صفحة — واحد بكل سطر (facebook.com/الاسم)"],
];

export default function Workspace() {
  const [tab, setTab] = useState<"feed" | "list">("feed");
  const [d, setD] = useState<any>(null);
  const [wl, setWl] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState("");
  const [dirty, setDirty] = useState(false);
  const [feed, setFeed] = useState<any>(null);
  const [feedLoading, setFeedLoading] = useState(false);

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
  useEffect(() => { load(); }, []);
  useEffect(() => { if (tab === "feed" && !feed && d?.workspace) loadFeed(); }, [tab, d]);

  const save = async () => {
    setSaved("…"); setDirty(false);
    const body: any = {};
    FIELDS.forEach(([k]) => { body[k] = (wl[k] || "").split("\n").map((x) => x.trim()).filter(Boolean); });
    const r = await apiSend("/api/workspace/watchlist", "POST", body).catch(() => null);
    setSaved(r?.saved ? "✅ حُفظت قائمتك" : "⚠️ سجّل الدخول أو تعذّر الحفظ");
    setFeed(null);   // watchlist changed → refresh feed next time
  };

  const totalItems = FIELDS.reduce((n, [k]) => n + (wl[k] || "").split("\n").filter((x) => x.trim()).length, 0);

  return (
    <div>
      <h2 style={{ margin: 0 }}>مساحة العمل — بياناتك أنت</h2>
      <p className="muted">مؤسستك ترصد أهدافها أنت. قائمة معزولة تماماً + خلاصة أخبار حيّة عن كياناتك.</p>

      {loading && <SkelCards count={2} />}
      {!loading && d && !d.workspace && (
        <div className="cbox" style={{ borderInlineStart: "4px solid #f59e0b" }}>يجب تسجيل الدخول لعرض مساحتك.</div>
      )}

      {!loading && d?.workspace && (
        <>
          <div className="cbox" style={{ marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
            <span style={{ fontSize: 13 }}>🏢 <b>{d.org || d.email}</b> <span className="chip" style={{ fontSize: 10 }}>مساحة معزولة</span></span>
            <div className="auth-tabs" style={{ maxWidth: 320 }}>
              <button className={tab === "feed" ? "on" : ""} onClick={() => setTab("feed")}>📡 بياناتي الحيّة</button>
              <button className={tab === "list" ? "on" : ""} onClick={() => setTab("list")}>📝 قائمتي ({totalItems})</button>
            </div>
          </div>

          {tab === "list" && (
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

          {tab === "feed" && (
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
        </>
      )}
    </div>
  );
}
