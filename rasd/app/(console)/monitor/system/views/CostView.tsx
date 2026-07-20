"use client";
import { useEffect, useState } from "react";
import { apiGet, apiSend } from "@/lib/api";
import { SkelCards } from "@/components/Skeleton";
import { useDemo } from "@/components/ui/DemoContext";

const fmt = (n: number) => (n || 0).toLocaleString("en-US");
const lvlColor = (l: string) => (/حرج/.test(l || "") ? "#dc2626" : /مرتفع/.test(l || "") ? "#f43f5e" : "#f59e0b");

export default function CostView() {
  const [d, setD] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { demo, setDemo } = useDemo();
  const [saving, setSaving] = useState("");
  const load = () => { setLoading(true); apiGet("/api/cost-center" + (demo ? "?demo=1" : "")).then(setD).finally(() => setLoading(false)); };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [demo]);

  const c = d?.controls || {};
  const toggle = async (key: string, val: any) => {
    if (demo) { setD({ ...d, controls: { ...c, [key]: val } }); return; }   // demo: local only
    setSaving(key);
    await apiSend("/api/cost-center/controls", "POST", { changes: { [key]: val } }).catch(() => {});
    setSaving(""); load();
  };

  const m = d?.month || {}; const t = d?.today || {};
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <h2 style={{ margin: 0 }}>💰 مركز التحكّم بالتكلفة</h2>
        <button className={`btn ${demo ? "" : "ghost"}`} onClick={() => setDemo(!demo)} style={demo ? { background: "#6366f1" } : {}}>🧪 وضع العرض {demo ? "(مفعّل)" : ""}</button>
      </div>
      <p className="muted">رقابة الإنفاق + ضوابط حماية حتى لا يحرق النظام الرصيد بلا رؤية.</p>

      {loading && <SkelCards count={4} />}
      {!loading && d && (
        <>
          {demo && <p className="muted" style={{ fontSize: 11.5, color: "#6366f1" }}>🧪 {d.providers_note}</p>}

          {/* warnings */}
          {d.warnings?.length > 0 && d.warnings.map((w: any, i: number) => (
            <div key={i} className="cbox" style={{ borderInlineStart: `4px solid ${lvlColor(w.level)}`, marginBottom: 8 }}>⚠️ <b>{w.level}:</b> {w.msg}</div>
          ))}

          {/* KPI row */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
            {[["اليوم (وحدات)", fmt(t.units), `$${t.cost_usd ?? 0}`],
              ["الشهر (وحدات)", fmt(m.units), m.cap ? `${m.pct}% من السقف` : "بلا سقف"],
              ["متبقٍّ", m.remaining != null ? fmt(m.remaining) : "—", m.cap ? `سقف ${fmt(m.cap)}` : ""],
              ["توقّع الشهر", fmt(m.projected_units), `$${m.projected_cost_usd ?? 0}`]].map(([l, v, s]: any, i) => (
              <div key={i} style={{ flex: "1 1 150px", textAlign: "center", padding: "12px 8px", border: "1px solid var(--line)", borderRadius: 12, background: "var(--input)" }}>
                <div style={{ fontSize: 24, fontWeight: 900 }}>{v}</div>
                <div className="muted" style={{ fontSize: 11.5 }}>{l}</div>
                {s && <div className="muted" style={{ fontSize: 10.5 }}>{s}</div>}
              </div>
            ))}
          </div>

          <div className="grid" style={{ marginBottom: 14 }}>
            {/* by feature */}
            {d.by_feature?.length > 0 && (
              <div className="cbox"><h4>📊 التكلفة حسب الميزة</h4>
                {d.by_feature.map((f: any, i: number) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "4px 0", borderTop: i ? "1px solid var(--line)" : 0 }}>
                    <span>{f.label}</span><span className="muted">{fmt(f.units)} · ${f.cost_usd}</span>
                  </div>
                ))}
              </div>
            )}
            {/* platform breakdown (demo) */}
            {d.platform_breakdown?.length > 0 && (
              <div className="cbox"><h4>🌐 التوزيع حسب المنصّة</h4>
                {d.platform_breakdown.map((p: any, i: number) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}>
                    <span style={{ width: 70, fontSize: 12.5 }}>{p.platform}</span>
                    <span style={{ flex: 1, height: 8, borderRadius: 999, background: "var(--input)", overflow: "hidden" }}><span style={{ display: "block", height: "100%", width: `${p.pct}%`, background: "#4f9dff" }} /></span>
                    <span style={{ fontSize: 12 }}>{p.pct}%</span>
                  </div>
                ))}
              </div>
            )}
            {/* cost per insight (demo) */}
            {d.cost_per_insight?.length > 0 && (
              <div className="cbox"><h4>🎯 التكلفة لكل ناتج</h4>
                {d.cost_per_insight.map((x: any, i: number) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "4px 0" }}><span>{x.item}</span><span className="muted">${x.cost_usd}</span></div>
                ))}
              </div>
            )}
          </div>

          {/* controls */}
          <div className="cbox" style={{ marginBottom: 14 }}>
            <h4>🛡️ الضوابط والحماية</h4>
            <p className="muted" style={{ fontSize: 11.5 }}>الإيقاف الطارئ وإيقاف فيسبوك والسقف اليومي مُفعّلة فعلياً على الجمع.</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {[["emergency_stop", "🛑 إيقاف طارئ (كل الجمع)"], ["pause_facebook", "⏸️ إيقاف فيسبوك"],
                ["slow_mode", "🐢 الوضع البطيء"], ["pause_manual_refresh", "✋ إيقاف التحديث اليدوي"],
                ["analyze_only_viral", "🔥 الفايرل فقط"], ["warn_at_70", "🔔 تنبيه 70%"], ["warn_at_90", "🔔 تنبيه 90%"]].map(([k, l]: any) => (
                <label key={k} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, padding: "6px 8px", border: "1px solid var(--line)", borderRadius: 8, cursor: "pointer", background: c[k] ? "color-mix(in srgb,#f43f5e 10%,transparent)" : "transparent" }}>
                  <input type="checkbox" checked={!!c[k]} onChange={(e) => toggle(k, e.target.checked)} disabled={saving === k} />
                  {l}{k === "emergency_stop" && c[k] && <span className="chip" style={{ color: "#f43f5e", fontSize: 10 }}>مفعّل</span>}
                </label>
              ))}
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
              {[["daily_cap", "السقف اليومي"], ["monthly_cap", "السقف الشهري"]].map(([k, l]: any) => (
                <label key={k} style={{ fontSize: 12.5 }}>{l}: <input type="number" value={c[k] ?? 0} onChange={(e) => toggle(k, parseInt(e.target.value) || 0)} style={{ width: 110 }} /> <span className="muted">(0 = بلا حد)</span></label>
              ))}
            </div>
          </div>

          {/* smart rules */}
          {d.smart_rules?.length > 0 && (
            <div className="cbox" style={{ marginBottom: 14 }}>
              <h4>⚡ قواعد التوفير الذكية</h4>
              {d.smart_rules.map((r: any, i: number) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "4px 0", borderTop: i ? "1px solid var(--line)" : 0 }}>
                  <span>{r.active ? "✅" : "⚪"} {r.rule}{r.note ? <span className="muted" style={{ fontSize: 11 }}> — {r.note}</span> : ""}</span>
                  <span className="muted" style={{ fontSize: 11 }}>{r.active ? "مفعّل" : "متوقف"}</span>
                </div>
              ))}
            </div>
          )}

          <p className="muted" style={{ fontSize: 11 }}>{d.providers_note}</p>
          <p className="muted" style={{ fontSize: 11 }}>{d.disclaimer}</p>
        </>
      )}
    </div>
  );
}
