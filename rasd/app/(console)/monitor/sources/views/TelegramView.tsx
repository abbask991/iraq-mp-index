"use client";
import { useEffect, useState } from "react";
import { apiPost } from "@/lib/api";
import { useDemo } from "@/components/ui/DemoContext";
import { Icon, Badge } from "@/components/ui";

/**
 * Telegram tab — real collector (Phase 1). Fetches public channels via the t.me/s
 * preview (POST /monitor/telegram), classifies tone, and persists to the shared
 * mentions store so Telegram joins the unified picture. Channels persist locally.
 * Honest note: public channels only; private/real-time needs the MTProto worker.
 */
const sColor = (s: string) => (s === "سلبي" ? "#f43f5e" : s === "إيجابي" ? "#22c55e" : "#8a97ad");
const fmt = (n: number) => (n || 0).toLocaleString("en-US");
const LS = "rasd_tg_channels";
const load = (): string[] => { try { return JSON.parse(localStorage.getItem(LS) || "[]"); } catch { return []; } };
const save = (c: string[]) => { try { localStorage.setItem(LS, JSON.stringify(c)); } catch { /* ignore */ } };

export default function TelegramView() {
  const { demo } = useDemo();
  const [channels, setChannels] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [d, setD] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { setChannels(load()); }, []);

  const norm = (s: string) => s.trim().replace(/^https?:\/\//, "").replace("t.me/s/", "").replace("t.me/", "").replace("@", "").replace(/\/$/, "");
  const add = () => { const c = norm(input); if (!c || channels.includes(c)) return; const next = [...channels, c]; setChannels(next); save(next); setInput(""); };
  const remove = (c: string) => { const next = channels.filter((x) => x !== c); setChannels(next); save(next); };

  const run = async () => {
    setLoading(true); setD(null);
    const r = await apiPost("telegram", { channels, ...(demo ? { demo: 1 } : {}) }).catch(() => null);
    setD(r); setLoading(false);
  };
  // auto-fetch in demo (no channels needed) so the tab is never empty in a demo
  useEffect(() => { if (demo) run(); /* eslint-disable-next-line */ }, [demo]);

  const hits = d?.hits || [];

  return (
    <div>
      <h2 style={{ margin: 0 }}>تيليجرام</h2>
      <p className="muted" style={{ marginTop: 4 }}>جمع القنوات العامة عبر معاينة t.me/s — يُخزّن في المخزون الموحّد فينضمّ تيليجرام للصورة والأدلّة ومسار السرديات.</p>

      <div className="card" style={{ margin: "12px 0" }}>
        <div style={{ display: "flex", gap: 8 }}>
          <input placeholder="أضِف قناة عامة (مثال: @iraq_alerts أو t.me/iraq_alerts)" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
          <button className="btn ghost" onClick={add}>أضِف</button>
          <button className="btn" onClick={run} disabled={loading || (!channels.length && !demo)}>{loading ? "جارٍ الجمع…" : "اجمع الآن"}</button>
        </div>
        {channels.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
            {channels.map((c) => (
              <span key={c} className="chip">@{c}<a style={{ cursor: "pointer", color: "#f43f5e", marginInlineStart: 6 }} onClick={() => remove(c)}>×</a></span>
            ))}
          </div>
        )}
        {!channels.length && !demo && <div className="u-fine" style={{ marginTop: 8 }}>أضِف قناة عامة واحدة على الأقل، أو فعّل «وضع العرض» لبيانات توضيحية.</div>}
      </div>

      {loading && <div><span className="spinner" /> يجمع من القنوات…</div>}

      {d && !loading && (
        <>
          {d.note && !hits.length && <p className="muted">{d.note}</p>}
          {hits.length > 0 && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", margin: "4px 0 12px" }}>
              <span className="muted" style={{ fontSize: 13 }}>{fmt(d.count)} منشور · {fmt(d.sources)} قناة</span>
              {demo && <Badge t="warn">بيانات توضيحية</Badge>}
              <span className="u-fine">· يُخزّن في المخزون الموحّد</span>
            </div>
          )}
          <div style={{ display: "grid", gap: 8 }}>
            {hits.map((h: any, i: number) => (
              <div key={h.external_id || i} className="cbox" style={{ borderInlineStart: `3px solid ${sColor(h.sentiment)}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 5 }}>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <Badge t="neutral">تيليجرام</Badge>
                    <span className="muted" style={{ fontSize: 12 }}>@{h.source}</span>
                  </div>
                  <span className="muted u-num" style={{ fontSize: 11 }}>{h.date ? new Date(h.date).toLocaleString("ar-IQ", { dateStyle: "short", timeStyle: "short" }) : ""}</span>
                </div>
                <p style={{ fontSize: 13.5, lineHeight: 1.9, margin: "0 0 6px", whiteSpace: "pre-wrap" }}>{(h.text || "").slice(0, 400)}</p>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                  {h.sentiment && <span className="chip" style={{ fontSize: 10.5, color: sColor(h.sentiment) }}>{h.sentiment}</span>}
                  {h.engagement && h.engagement !== "0" && <span className="muted u-num" style={{ fontSize: 11 }}><Icon name="bolt" size={11} /> {h.engagement} مشاهدة</span>}
                  {(h.hashtags || []).slice(0, 4).map((t: string) => <span key={t} className="muted" style={{ fontSize: 11 }}>#{t}</span>)}
                  {h.link && <a href={h.link} target="_blank" rel="noopener" style={{ color: "var(--accent)", fontSize: 12 }}>المصدر ↗</a>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <p className="u-fine" style={{ marginTop: 14 }}>
        القنوات العامة فقط (التي تدعم المعاينة). للجمع اللحظي والتاريخ الكامل والقنوات المقيّدة: جامع MTProto (Telethon) على خادم العامل — الخطوة التالية.
      </p>
    </div>
  );
}
