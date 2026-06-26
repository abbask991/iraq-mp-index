"use client";
import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";

const TITLE: Record<string, string> = { oppose: "منشورات معارِضة", support: "منشورات مؤيِّدة", all: "منشورات" };

export default function EvidenceModal({ target, filter, onClose }: { target: string; filter: string; onClose: () => void }) {
  const [d, setD] = useState<any>(null);
  useEffect(() => {
    setD(null);
    apiGet(`/api/evidence?target=${encodeURIComponent(target)}&filter=${filter}`).then(setD).catch(() => setD({ error: 1 }));
  }, [target, filter]);

  return (
    <div className="cmdk-overlay" onClick={onClose}>
      <div className="cmdk" style={{ width: "min(640px, 94vw)" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <b>الأدلة — {TITLE[filter] || "منشورات"} · «{target}»</b>
          <a style={{ cursor: "pointer", fontSize: 18 }} onClick={onClose}>✕</a>
        </div>
        <div style={{ maxHeight: "62vh", overflowY: "auto", padding: 10 }}>
          {!d && <div style={{ padding: 18 }}><span className="spinner" /> جلب الأدلة الفعلية…</div>}
          {d?.error && <div className="muted" style={{ padding: 16 }}>تعذّر جلب الأدلة.</div>}
          {(d?.posts || []).map((p: any, i: number) => (
            <div key={i} className="card" style={{ margin: "6px 0", padding: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}>
                <b>@{p.author}{p.verified && <span style={{ color: "#3b82f6" }}> ✓</span>}</b>
                <span className="muted">{Number(p.followers || 0).toLocaleString()} متابع · ❤ {Number(p.engagement || 0).toLocaleString()}{p.bot > 60 ? " · 🤖" : ""}</span>
              </div>
              <p style={{ fontSize: 13.5, lineHeight: 1.8, margin: "6px 0 0" }}>{p.text}</p>
            </div>
          ))}
          {d && !d.posts?.length && !d.error && <div className="muted" style={{ padding: 16, textAlign: "center" }}>لا أدلة كافية لهذا التصنيف.</div>}
        </div>
        {d?.posts?.length > 0 && <div className="cmdk-foot"><span className="muted">أعلى {d.posts.length} منشوراً وصولاً من {d.scanned} مفحوص · مرتّبة بالتأثير</span></div>}
      </div>
    </div>
  );
}
