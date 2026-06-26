"use client";
import { useEffect, useState } from "react";
import { apiGet, apiSend } from "@/lib/api";

type Source = { platform: string; url: string };
const PLAT_ICON: Record<string, string> = { instagram: "📸", tiktok: "🎵", facebook: "👤", youtube: "▶️", reddit: "🟠", x: "𝕏" };
const LS = "rasd_social_sources";

function load(): Source[] { try { return JSON.parse(localStorage.getItem(LS) || "[]"); } catch { return []; } }
function save(s: Source[]) { try { localStorage.setItem(LS, JSON.stringify(s)); } catch { /* ignore */ } }

export default function CrossPlatform() {
  const [status, setStatus] = useState<any>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [platform, setPlatform] = useState("instagram");
  const [url, setUrl] = useState("");
  const [feed, setFeed] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { apiGet("/api/social/platforms").then(setStatus).catch(() => {}); setSources(load()); }, []);

  const add = () => {
    const u = url.trim(); if (!u) return;
    const next = [...sources, { platform, url: u }]; setSources(next); save(next); setUrl("");
  };
  const remove = (i: number) => { const next = sources.filter((_, j) => j !== i); setSources(next); save(next); };

  const run = async () => {
    if (!sources.length) return;
    setBusy(true); setFeed({ posts: [], sources: sources.length });
    const all: any[] = [];
    for (const s of sources) {
      const started = await apiSend("/api/social/collect", "POST", { platform: s.platform, url: s.url, limit: 10 }).catch(() => null);
      const job = started?.job_id;
      if (!job) continue;
      for (let i = 0; i < 30; i++) {                       // poll up to ~3.5 min
        await new Promise((r) => setTimeout(r, 7000));
        const res = await apiGet(`/api/social/result?job=${encodeURIComponent(job)}&platform=${s.platform}&mode=auto`).catch(() => null);
        if (res?.status === "ready") {
          (res.posts || []).forEach((p: any) => { p.source_url = s.url; });
          all.push(...(res.posts || []));
          setFeed({ posts: [...all], sources: sources.length });
          break;
        }
        if (res?.status === "failed") break;
      }
    }
    setBusy(false);
  };

  const plats = status?.platforms || [];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
        <div>
          <h2 style={{ margin: 0 }}>الرصد عبر المنصّات</h2>
          <p className="muted" style={{ marginTop: 4 }}>راقب إنستغرام · تيك توك · فيسبوك · يوتيوب · ريديت من مكان واحد — أضف روابط الحسابات/الصفحات وتابع منشوراتها.</p>
        </div>
        {status && <span className="chip" style={{ color: status.enabled ? "#22c55e" : "#f43f5e" }}>المزوّد: {status.provider} {status.enabled ? "●" : "○ غير مُهيّأ"}</span>}
      </div>

      {status && !status.enabled && (
        <div className="card" style={{ marginTop: 12, borderInlineStart: "4px solid #fb923c" }}>
          <b>المزوّد غير مُفعّل</b>
          <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>أضف مفتاح <code>BRIGHTDATA_TOKEN</code> في إعدادات الخادم (Render) لتفعيل الجمع عبر المنصّات.</p>
        </div>
      )}

      {/* add source */}
      <div className="card" style={{ marginTop: 14 }}>
        <b style={{ fontSize: 13 }}>إضافة مصدر</b>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8, alignItems: "end" }}>
          <select value={platform} onChange={(e) => setPlatform(e.target.value)}>
            {plats.map((p: any) => <option key={p.key} value={p.key} disabled={!p.supported}>{PLAT_ICON[p.key]} {p.ar}</option>)}
          </select>
          <input placeholder="رابط الحساب/الصفحة (مثال: https://www.instagram.com/aljazeera/)" value={url}
            onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} style={{ flex: 2, minWidth: 240 }} />
          <button className="btn" onClick={add}>أضِف</button>
        </div>
        {!!sources.length && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
            {sources.map((s, i) => (
              <span key={i} className="chip">{PLAT_ICON[s.platform]} {s.url.replace(/^https?:\/\/(www\.)?/, "").slice(0, 32)}
                <a style={{ cursor: "pointer", color: "#f43f5e", marginInlineStart: 6 }} onClick={() => remove(i)}>×</a></span>
            ))}
          </div>
        )}
        <div style={{ marginTop: 12 }}>
          <button className="btn" onClick={run} disabled={busy || !sources.length}>{busy ? "جارٍ الجمع… (قد يستغرق دقيقة)" : "جمع المنشورات"}</button>
        </div>
      </div>

      {busy && <div style={{ marginTop: 14 }}><span className="spinner" /> الجمع عبر المنصّات غير فوري (يُشغّل مهمة بالخلفية لكل مصدر)…</div>}

      {feed && (
        <div style={{ marginTop: 14 }}>
          {feed.error && <p className="muted">تعذّر — {feed.error}</p>}
          <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>{(feed.posts || []).length} منشور من {feed.sources} مصدر</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 12 }}>
            {(feed.posts || []).map((p: any, i: number) => (
              <div key={i} className="cbox" style={{ borderInlineStart: "4px solid var(--accent)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
                  <b style={{ fontSize: 13 }}>{PLAT_ICON[p.platform]} {p.author?.username || "—"}</b>
                  {p.author?.followers > 0 && <span className="muted" style={{ fontSize: 11 }}>{Number(p.author.followers).toLocaleString()} متابع</span>}
                </div>
                <p style={{ fontSize: 13, lineHeight: 1.8, margin: "8px 0" }}>{(p.text || "").slice(0, 220) || "—"}</p>
                <div className="muted" style={{ fontSize: 11, display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <span>❤ {Number(p.engagement?.likes || 0).toLocaleString()}</span>
                  <span>💬 {Number(p.engagement?.comments || 0).toLocaleString()}</span>
                  {p.engagement?.views > 0 && <span>👁 {Number(p.engagement.views).toLocaleString()}</span>}
                  {p.url && <a href={p.url} target="_blank" rel="noopener" style={{ color: "var(--accent)" }}>المصدر ↗</a>}
                </div>
              </div>
            ))}
          </div>
          {!feed.error && !(feed.posts || []).length && <p className="muted">لا منشورات — تحقّق من الروابط أو أعد المحاولة (الجمع قد يحتاج وقتاً أطول).</p>}
        </div>
      )}

      <p className="muted" style={{ fontSize: 11, marginTop: 16 }}>الجمع عبر مزوّد قابل للتبديل — يدعم إنستغرام/تيك توك/فيسبوك/يوتيوب/ريديت/إكس. النتائج مخزّنة مؤقتاً.</p>
    </div>
  );
}
