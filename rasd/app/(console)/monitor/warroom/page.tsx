"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { apiGet } from "@/lib/api";
import Gauge from "@/components/Gauge";
import CountUp from "@/components/CountUp";
import WarGraph from "@/components/WarGraph";
import RadarChart from "@/components/RadarChart";
import EmotionHeatmap from "@/components/EmotionHeatmap";
import IraqMap from "@/components/IraqMap";
import Icon from "@/components/ui/Icon";

const TRAJ = (t: string) => (t === "rising" || t === "escalating" ? "▲" : t === "declining" || t === "cooling" ? "▼" : "▬");

const REFRESH = 45;
/** Severity → colour. Was 🔴/🟠/🟡; the dot is drawn now, so it takes the palette
 *  and stays crisp at any size instead of depending on the OS emoji font. */
const sevColor = (s: string) => (s === "red" ? "#f43f5e" : s === "orange" ? "#fb923c" : "#eab308");
const riskColor = (v: number) => (v >= 70 ? "#f43f5e" : v >= 50 ? "#fb923c" : v >= 30 ? "#f59e0b" : "#22c55e");

// National alert posture — the DEFCON-style status the whole room keys off.
function posture(risk: number) {
  if (risk >= 70) return { label: "حالة حرجة", code: "ALERT 1", color: "#f43f5e", crit: true };
  if (risk >= 50) return { label: "تحذير مرتفع", code: "ALERT 2", color: "#fb923c", crit: false };
  if (risk >= 30) return { label: "مراقبة", code: "ALERT 3", color: "#f59e0b", crit: false };
  return { label: "هادئ — تحت السيطرة", code: "ALERT 4", color: "#22c55e", crit: false };
}

export default function WarRoom() {
  const [d, setD] = useState<any>(null);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [clock, setClock] = useState("");
  const [date, setDate] = useState("");
  const [countdown, setCountdown] = useState(REFRESH);
  const [sound, setSound] = useState(false);
  const [flash, setFlash] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const seenAlerts = useRef<Set<string>>(new Set());
  const soundRef = useRef(false);

  const beep = () => {
    try {
      const AC = (window.AudioContext || (window as any).webkitAudioContext);
      const ac = new AC();
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = "sine"; o.frequency.value = 880; o.connect(g); g.connect(ac.destination);
      g.gain.setValueAtTime(0.001, ac.currentTime);
      g.gain.exponentialRampToValueAtTime(0.25, ac.currentTime + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.5);
      o.start(); o.stop(ac.currentTime + 0.5);
    } catch { /* ignore */ }
  };

  const load = () => {
    apiGet("/api/battlefield/national").then(setD).catch(() => {});
    apiGet("/monitor/alerts-feed").then((r) => {
      const a = r?.alerts || [];
      // detect NEW critical alerts → flash + optional beep (skip the very first load)
      const fresh = a.filter((x: any) => x.severity === "red" && !seenAlerts.current.has(x.message));
      const primed = seenAlerts.current.size > 0;
      a.forEach((x: any) => seenAlerts.current.add(x.message));
      if (fresh.length && primed) {
        setFlash(true); setTimeout(() => setFlash(false), 1400);
        if (soundRef.current) beep();
      }
      setAlerts(a);
    }).catch(() => {});
    setCountdown(REFRESH);
  };
  useEffect(() => { load(); const i = setInterval(load, REFRESH * 1000); return () => clearInterval(i); }, []);
  useEffect(() => {
    const t = setInterval(() => {
      const now = new Date();
      setClock(now.toLocaleTimeString("ar-IQ"));
      setDate(now.toLocaleDateString("ar-IQ", { weekday: "long", day: "numeric", month: "long" }));
      setCountdown((c) => (c > 0 ? c - 1 : 0));
    }, 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => { soundRef.current = sound; }, [sound]);

  const fs = () => {
    const el = ref.current as any;
    if (!document.fullscreenElement) el?.requestFullscreen?.();
    else document.exitFullscreen?.();
  };

  const sc = d?.scores || {};
  const risk = sc.national_risk || 0;
  const pos = posture(risk);
  const narrs = d?.top_narratives || [];
  const camps = d?.top_campaigns || [];
  const attacked = d?.most_attacked || [];
  const reds = alerts.filter((a) => a.severity === "red").length;
  const platforms = d?.platform_distribution || [];
  const heatmap = d?.emotion_heatmap || [];
  const momentum = d?.momentum || [];
  const radarAxes = [
    { label: "العام", value: risk },
    { label: "سياسي", value: sc.political || 0 },
    { label: "أزمة", value: sc.crisis || 0 },
    { label: "حملات", value: sc.campaign || 0 },
    { label: "سمعة", value: sc.reputation || 0 },
  ];
  const PLAT_AR: Record<string, string> = { x: "إكس", news: "أخبار", telegram: "تيليغرام", facebook: "فيسبوك", instagram: "إنستغرام", tiktok: "تيك توك", youtube: "يوتيوب", reddit: "ريديت" };
  const PLAT_C: Record<string, string> = { x: "#4f9dff", news: "#a855f7", telegram: "#34d6c6", facebook: "#3b82f6", instagram: "#ec4899", tiktok: "#f43f5e", youtube: "#ef4444", reddit: "#fb923c" };

  // breaking ticker items
  const ticker: string[] = [
    ...alerts.slice(0, 6).map((a) => a.message),
    ...narrs.slice(0, 4).map((n: any) => `سردية صاعدة: ${n.narrative} (${n.posts || 0})`),
    ...attacked.slice(0, 3).map((e: any) => `تحت الهجوم: ${e.name} — خطر ${e.risk}`),
  ];

  return (
    <div ref={ref} className={`wr ${pos.crit ? "wr-crit" : ""}`}>
      {flash && <div className="wr-flash" />}

      {/* command bar */}
      <div className="wr-top">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span className="wr-live"><span className="wr-dot" />LIVE</span>
          <b style={{ fontSize: 18, letterSpacing: "1px" }}>SENTINEL · غرفة الحرب</b>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ textAlign: "left", lineHeight: 1.2 }}>
            <div className="wr-clock">{clock}</div>
            <div style={{ fontSize: 11, color: "var(--muted)" }}>{date}</div>
          </div>
          <span className="wr-ring" title="التحديث القادم"><svg viewBox="0 0 36 36" width="34" height="34">
            <circle cx="18" cy="18" r="15" fill="none" stroke="var(--line)" strokeWidth="3" />
            <circle cx="18" cy="18" r="15" fill="none" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 15} strokeDashoffset={2 * Math.PI * 15 * (1 - countdown / REFRESH)}
              transform="rotate(-90 18 18)" style={{ transition: "stroke-dashoffset 1s linear" }} />
          </svg><span className="wr-ring-n">{countdown}</span></span>
          <button className="btn ghost" style={{ fontSize: 12 }} onClick={() => setSound((s) => !s)} title="تنبيه صوتي">
            {sound ? <Icon name="bell" size={14} /> : <Icon name="bellOff" size={14} />}</button>
          <button className="btn ghost" style={{ fontSize: 12 }} onClick={fs}><Icon name="expand" size={13} /> ملء الشاشة</button>
        </div>
      </div>

      {!d && <div style={{ padding: 40, textAlign: "center" }}><span className="spinner" /> تهيئة غرفة الحرب…</div>}

      {d && (
        <>
          {/* national posture banner */}
          <div className="wr-posture" style={{ ["--pc" as any]: pos.color }}>
            <div className="wr-posture-l">
              <div className="wr-posture-code">{pos.code}</div>
              <div>
                <div style={{ fontSize: 12, color: "var(--muted)", letterSpacing: 1 }}>حالة التأهّب الوطني</div>
                <div style={{ fontSize: 26, fontWeight: 900, color: pos.color }}>{pos.label}</div>
              </div>
            </div>
            <div className="wr-posture-r">
              {reds > 0 && <span className="wr-badge" style={{ background: "#f43f5e" }}>{reds} تهديد حرج</span>}
              {camps.length > 0 && <span className="wr-badge" style={{ background: "#fb923c" }}>{camps.length} حملة منسّقة</span>}
              {d.facebook?.approval != null && <span className="wr-badge" style={{ background: d.facebook.approval >= 55 ? "#22c55e" : d.facebook.approval >= 40 ? "#f59e0b" : "#f43f5e" }}><Icon name="trendUp" size={12} /> فيسبوك {d.facebook.approval}% تأييد</span>}
              <span className="wr-badge" style={{ background: pos.color }}>الخطر {risk}/100</span>
            </div>
          </div>

          {/* KPI hero */}
          <div className="wr-kpis">
            <div className="wr-kpi"><div className="wr-g"><Gauge value={risk} size={92} invert color={riskColor(risk)} /></div><div className="wr-l">الخطر الوطني</div></div>
            <div className="wr-kpi"><div className="wr-v" style={{ color: riskColor(sc.crisis || 0) }}><CountUp value={sc.crisis || 0} /></div><div className="wr-l">مؤشر الأزمة</div></div>
            <div className="wr-kpi"><div className="wr-v" style={{ color: riskColor(sc.political || 0) }}><CountUp value={sc.political || 0} /></div><div className="wr-l">الخطر السياسي</div></div>
            <div className="wr-kpi"><div className="wr-v"><CountUp value={narrs.length} /></div><div className="wr-l">سرديات نشطة</div></div>
            <div className="wr-kpi"><div className="wr-v" style={{ color: camps.length ? "#fb923c" : undefined }}><CountUp value={camps.length} /></div><div className="wr-l">حملات منسّقة</div></div>
            <div className="wr-kpi"><div className="wr-v" style={{ color: reds ? "#f43f5e" : "#22c55e" }}><CountUp value={alerts.length} /></div><div className="wr-l">تنبيهات</div></div>
          </div>

          {/* main: map · threat graph · alert ticker */}
          <div className="wr-main3">
            <div className="wr-graph">
              <div className="wr-cap"><Icon name="map" size={13} /> الخريطة الميدانية — العراق</div>
              {d.geo?.governorates?.length ? <IraqMap geo={d.geo} />
                : <div className="muted" style={{ padding: 24, textAlign: "center" }}>لا بيانات جغرافية بعد.</div>}
            </div>
            <div className="wr-graph">
              <div className="wr-cap"><Icon name="network" size={13} /> خريطة التهديد الحيّة — كيانات · سرديات · حملات</div>
              <WarGraph data={{ nodes: d.nodes, edges: d.edges }} />
            </div>
            <div className="wr-side">
              <div className="wr-cap" style={{ color: "#f43f5e" }}>● بثّ التنبيهات الحيّ</div>
              <div className="wr-alerts">
                {alerts.length ? alerts.slice(0, 14).map((a, i) => (
                  <div key={i} className="wr-alert" style={{ ["--ac" as any]: a.severity === "red" ? "#f43f5e" : a.severity === "orange" ? "#fb923c" : "#eab308" }}>
                    <span className="u-badge-dot" style={{ background: sevColor(a.severity), marginTop: 6 }} />
                    <span style={{ flex: 1 }}>{a.message}</span>
                  </div>
                )) : <div className="muted" style={{ fontSize: 13, padding: 8 }}>لا تنبيهات نشطة — الوضع تحت السيطرة. </div>}
              </div>
            </div>
          </div>

          {/* mid: most-attacked · coordinated campaigns · narratives */}
          <div className="wr-tri">
            <div className="wr-panel">
              <div className="wr-cap" style={{ color: "#f43f5e" }}><Icon name="target" size={13} /> الأكثر تعرّضاً للهجوم</div>
              {attacked.length ? attacked.slice(0, 6).map((e: any, i: number) => (
                <div key={i} className="wr-attrow">
                  <span className="wr-attname">{e.name}</span>
                  <span className="wr-attbar"><span style={{ width: `${Math.min(100, e.risk || 0)}%`, background: riskColor(e.risk || 0) }} /></span>
                  <span style={{ color: riskColor(e.risk || 0), fontWeight: 800, minWidth: 28, textAlign: "left" }}>{e.risk}</span>
                </div>
              )) : <span className="muted">—</span>}
            </div>

            <div className="wr-panel">
              <div className="wr-cap" style={{ color: "#fb923c" }}><Icon name="network" size={13} /> الحملات المنسّقة النشطة</div>
              {camps.length ? camps.slice(0, 6).map((c: any, i: number) => (
                <Link key={i} href={`/monitor/coordination?q=${encodeURIComponent(c.hashtag || "")}`} className="wr-camprow">
                  <span style={{ flex: 1, fontWeight: 600 }}>#{c.hashtag || "—"}</span>
                  <span className="chip" style={{ color: (c.coordination_score || 0) >= 60 ? "#f43f5e" : "#fb923c" }}>تنسيق {c.coordination_score || 0}</span>
                  <span style={{ color: "var(--muted)", fontSize: 12 }}>↗</span>
                </Link>
              )) : <span className="muted">لا حملات منسّقة مرصودة حالياً. </span>}
            </div>

            <div className="wr-panel">
              <div className="wr-cap"><Icon name="trendUp" size={13} /> معركة السرديات</div>
              {narrs.length ? narrs.slice(0, 7).map((n: any, i: number) => (
                <div key={i} className="wr-narrrow">
                  <span className="wr-narrdot" style={{ background: (n.neg_ratio || 0) > 0.5 ? "#f43f5e" : "#22c55e" }} />
                  <span style={{ flex: 1, fontSize: 13 }}>{n.narrative}</span>
                  <b style={{ color: "var(--accent)", fontSize: 13 }}>{n.posts || 0}</b>
                </div>
              )) : <span className="muted">—</span>}
            </div>
          </div>

          {/* viz row: risk radar · platform activity */}
          <div className="wr-viz">
            <div className="wr-panel">
              <div className="wr-cap"><Icon name="target" size={13} /> مصفوفة المخاطر الوطنية</div>
              <RadarChart axes={radarAxes} color={riskColor(risk)} />
            </div>
            <div className="wr-panel">
              <div className="wr-cap"><Icon name="megaphone" size={13} /> نشاط المنصّات</div>
              {platforms.length ? platforms.slice(0, 7).map((p: any, i: number) => {
                const k = (p.platform || "x").toLowerCase();
                return (
                  <div key={i} className="wr-platrow">
                    <span className="wr-platname">{PLAT_AR[k] || p.platform}</span>
                    <span className="wr-platbar"><span style={{ width: `${Math.min(100, p.pct || 0)}%`, background: PLAT_C[k] || "#4f9dff" }} /></span>
                    <span style={{ fontWeight: 800, fontSize: 12, minWidth: 36, textAlign: "left" }}>{p.pct}%</span>
                  </div>
                );
              }) : <div className="muted" style={{ fontSize: 13, padding: 8 }}>تُجمَّع بيانات المنصّات حالياً…</div>}
            </div>
          </div>

          {/* viz row 2: emotion heatmap · spread velocity */}
          <div className="wr-viz">
            <div className="wr-panel">
              <div className="wr-cap"><Icon name="thermometer" size={13} /> خريطة حرارة المشاعر</div>
              <EmotionHeatmap data={heatmap} />
            </div>
            <div className="wr-panel">
              <div className="wr-cap"><Icon name="rocket" size={13} /> سرعة الانتشار</div>
              {momentum.length ? (
                <div className="wr-velos">
                  {momentum.slice(0, 4).map((m: any, i: number) => (
                    <div key={i} className="wr-velo">
                      <Gauge value={m.velocity || 0} size={78} color={riskColor(m.risk || m.velocity || 0)} />
                      <div className="wr-velo-name">{m.name} <span style={{ color: m.trajectory === "declining" || m.trajectory === "cooling" ? "#22c55e" : "#f43f5e" }}>{TRAJ(m.trajectory)}</span></div>
                    </div>
                  ))}
                </div>
              ) : <div className="muted" style={{ fontSize: 13, padding: 8 }}>تُحتسب سرعة الانتشار حالياً…</div>}
            </div>
          </div>

          {/* AI situation brief */}
          {(d.summary || d.recommended_actions?.length) && (
            <div className="wr-brief">
              <div className="wr-cap"><Icon name="brain" size={13} /> تقييم الموقف — الذكاء الاصطناعي</div>
              {d.summary && <p style={{ fontSize: 14.5, lineHeight: 2, margin: "4px 0 10px" }}>{d.summary}</p>}
              {d.recommended_actions?.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {d.recommended_actions.slice(0, 4).map((a: string, i: number) => (
                    <span key={i} className="wr-act">▸ {a}</span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* breaking ticker */}
          {ticker.length > 0 && (
            <div className="wr-ticker">
              <span className="wr-ticker-tag">عاجل</span>
              <div className="wr-ticker-track">
                <div className="wr-ticker-move">
                  {[...ticker, ...ticker].map((t, i) => <span key={i} className="wr-ticker-item">{t}</span>)}
                </div>
              </div>
            </div>
          )}

          <div className="muted" style={{ fontSize: 11, textAlign: "center", marginTop: 12 }}>
            تحديث حيّ كل {REFRESH} ثانية · آخر تحديث للبيانات: {d.generated_at ? new Date(d.generated_at).toLocaleString("ar-IQ") : "—"} · Sentinel Intelligence by Integrate Dynamics
          </div>
        </>
      )}
    </div>
  );
}
