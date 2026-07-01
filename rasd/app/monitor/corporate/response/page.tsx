"use client";
import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";
import { SkelCards } from "@/components/Skeleton";

const prC = (l: string) => (/حرج/.test(l || "") ? "#dc2626" : /مرتفع/.test(l || "") ? "#f43f5e" : /متوسط/.test(l || "") ? "#f59e0b" : "#22c55e");
const chIcon: Record<string, string> = { facebook: "📘", google: "🔍", x: "✖️", instagram: "📷" };

export default function ResponseCenter() {
  const [brand, setBrand] = useState("");
  const [d, setD] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [handled, setHandled] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<"all" | "pending" | "critical">("all");
  const [copied, setCopied] = useState("");

  const run = async (real = false) => {
    setLoading(true); setD(null);
    const r = await apiGet(`/api/corporate/response?brand=${encodeURIComponent(brand)}${real ? "" : "&demo=1"}`).catch(() => null);
    setD(r); setLoading(false);
  };
  useEffect(() => { run(false); /* eslint-disable-next-line */ }, []);

  const copy = (id: string, text: string) => { navigator.clipboard?.writeText(text); setCopied(id); setTimeout(() => setCopied(""), 1500); };
  const toggle = (id: string) => { const n = new Set(handled); n.has(id) ? n.delete(id) : n.add(id); setHandled(n); };

  let tickets = d?.tickets || [];
  if (filter === "pending") tickets = tickets.filter((t: any) => !handled.has(t.id));
  if (filter === "critical") tickets = tickets.filter((t: any) => /حرج/.test(t.priority));
  const pendingCount = (d?.tickets || []).filter((t: any) => !handled.has(t.id)).length;

  return (
    <div>
      <h2 style={{ margin: 0 }}>مركز الاستجابة</h2>
      <p className="muted">حوّل الشكاوى لتذاكر قابلة للتنفيذ: أولوية · ردّ مقترح جاهز · حالة (تمّت/معلّقة).</p>
      <div className="card" style={{ marginBottom: 14, display: "flex", gap: 8 }}>
        <input placeholder="اسم الشركة" value={brand} onChange={(e) => setBrand(e.target.value)} onKeyDown={(e) => e.key === "Enter" && run(true)} style={{ flex: 1 }} />
        <button className="btn" onClick={() => run(true)} disabled={loading}>تحميل</button>
      </div>

      {loading && <SkelCards count={3} />}
      {d?.empty && <div className="cbox">{d.note}</div>}
      {d && !d.empty && (
        <>
          <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
            <button className={`btn ${filter === "all" ? "" : "ghost"}`} style={{ fontSize: 12 }} onClick={() => setFilter("all")}>الكل ({d.tickets.length})</button>
            <button className={`btn ${filter === "pending" ? "" : "ghost"}`} style={{ fontSize: 12 }} onClick={() => setFilter("pending")}>معلّقة ({pendingCount})</button>
            <button className={`btn ${filter === "critical" ? "" : "ghost"}`} style={{ fontSize: 12 }} onClick={() => setFilter("critical")}>حرجة ({d.counts?.critical || 0})</button>
            {d.demo && <span className="muted" style={{ fontSize: 11, color: "#6366f1" }}>🧪 عيّنة</span>}
          </div>

          {tickets.map((t: any) => {
            const done = handled.has(t.id);
            return (
              <div key={t.id} className="cbox" style={{ marginBottom: 10, borderInlineStart: `4px solid ${done ? "#22c55e" : prC(t.priority)}`, opacity: done ? 0.6 : 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                  <span style={{ fontSize: 12 }}>{chIcon[t.channel] || "•"} <span className="muted">{t.id}{t.customer ? ` · ${t.customer}` : ""}{t.time ? ` · ${t.time}` : ""}</span></span>
                  <span style={{ display: "flex", gap: 6 }}>
                    <span className="chip" style={{ fontSize: 10, color: prC(t.priority) }}>{t.priority}</span>
                    <button className="btn ghost" style={{ fontSize: 11, padding: "2px 8px" }} onClick={() => toggle(t.id)}>{done ? "↩️ معلّقة" : "✓ تمّت"}</button>
                  </span>
                </div>
                <div style={{ fontSize: 13.5, marginTop: 6, fontWeight: 600 }}>«{t.text}»</div>
                <div style={{ marginTop: 8, padding: "8px 10px", borderRadius: 8, background: "color-mix(in srgb,#6366f1 7%,transparent)", fontSize: 12.5 }}>
                  <div className="muted" style={{ fontSize: 11, marginBottom: 3 }}>ردّ مقترح:</div>
                  {t.suggested_reply}
                  <button className="btn ghost" style={{ fontSize: 11, padding: "2px 8px", marginInlineStart: 6 }} onClick={() => copy(t.id, t.suggested_reply)}>{copied === t.id ? "✅ نُسخ" : "📋 نسخ"}</button>
                </div>
              </div>
            );
          })}
          <p className="muted" style={{ fontSize: 11 }}>{d.disclaimer}</p>
        </>
      )}
    </div>
  );
}
