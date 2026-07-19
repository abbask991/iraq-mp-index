"use client";
import { useState } from "react";
import { SkelCards } from "@/components/Skeleton";
import { useBrand } from "../useBrand";

const prC = (l: string) => (/حرج/.test(l || "") ? "#dc2626" : /مرتفع/.test(l || "") ? "#f43f5e" : /متوسط/.test(l || "") ? "#f59e0b" : "#22c55e");

/** Response center — moved from /corporate/response. The only interactive view:
 *  it keeps its own filter/handled/copied state; the host owns brand + demo. */
export default function ResponseView({ brand, demo }: { brand: string; demo: boolean }) {
  const { d, loading } = useBrand("response", brand, demo);
  const [handled, setHandled] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<"all" | "pending" | "critical">("all");
  const [copied, setCopied] = useState("");
  const copy = (id: string, text: string) => { navigator.clipboard?.writeText(text); setCopied(id); setTimeout(() => setCopied(""), 1500); };
  const toggle = (id: string) => { const n = new Set(handled); n.has(id) ? n.delete(id) : n.add(id); setHandled(n); };

  if (loading) return <SkelCards count={3} />;
  if (d?.empty) return <div className="cbox">{d.note}</div>;
  if (!d) return null;

  let tickets = d?.tickets || [];
  if (filter === "pending") tickets = tickets.filter((t: any) => !handled.has(t.id));
  if (filter === "critical") tickets = tickets.filter((t: any) => /حرج/.test(t.priority));
  const pendingCount = (d?.tickets || []).filter((t: any) => !handled.has(t.id)).length;

  return (
    <>
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
        <button className={`btn ${filter === "all" ? "" : "ghost"}`} style={{ fontSize: 12 }} onClick={() => setFilter("all")}>الكل ({d.tickets.length})</button>
        <button className={`btn ${filter === "pending" ? "" : "ghost"}`} style={{ fontSize: 12 }} onClick={() => setFilter("pending")}>معلّقة ({pendingCount})</button>
        <button className={`btn ${filter === "critical" ? "" : "ghost"}`} style={{ fontSize: 12 }} onClick={() => setFilter("critical")}>حرجة ({d.counts?.critical || 0})</button>
      </div>

      {tickets.map((t: any) => {
        const done = handled.has(t.id);
        return (
          <div key={t.id} className="cbox" style={{ marginBottom: 10, borderInlineStart: `4px solid ${done ? "#22c55e" : prC(t.priority)}`, opacity: done ? 0.6 : 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
              <span className="muted" style={{ fontSize: 12 }}>{t.id}{t.customer ? ` · ${t.customer}` : ""}{t.time ? ` · ${t.time}` : ""}</span>
              <span style={{ display: "flex", gap: 6 }}>
                <span className="chip" style={{ fontSize: 10, color: prC(t.priority) }}>{t.priority}</span>
                <button className="btn ghost" style={{ fontSize: 11, padding: "2px 8px" }} onClick={() => toggle(t.id)}>{done ? "معلّقة" : "تمّت"}</button>
              </span>
            </div>
            <div style={{ fontSize: 13.5, marginTop: 6, fontWeight: 600 }}>«{t.text}»</div>
            <div style={{ marginTop: 8, padding: "8px 10px", borderRadius: 8, background: "color-mix(in srgb,#6366f1 7%,transparent)", fontSize: 12.5 }}>
              <div className="muted" style={{ fontSize: 11, marginBottom: 3 }}>ردّ مقترح:</div>
              {t.suggested_reply}
              <button className="btn ghost" style={{ fontSize: 11, padding: "2px 8px", marginInlineStart: 6 }} onClick={() => copy(t.id, t.suggested_reply)}>{copied === t.id ? "نُسخ" : "نسخ"}</button>
            </div>
          </div>
        );
      })}
      <p className="muted" style={{ fontSize: 11 }}>{d.disclaimer}</p>
    </>
  );
}
