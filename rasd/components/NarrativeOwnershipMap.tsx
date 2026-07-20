"use client";
import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";
import { getTargets, primaryKeyword } from "@/lib/targets";
import { Icon, Badge } from "@/components/ui";

/**
 * Narrative Ownership Map — who carries a narrative and in what ROLE. Honest and
 * LIMITED on purpose: it maps the real platforms each narrative spans (from the
 * fusion picture) to a role inferred FROM PLATFORM TYPE. It does NOT claim a
 * verified originator, because that needs first-seen cross-platform timing the
 * pipeline doesn't retain yet — that limit is stated in the UI, not hidden.
 */
const PLAT_AR: Record<string, string> = { x: "إكس", facebook: "فيسبوك", telegram: "تيليجرام", tiktok: "تيك توك", news: "أخبار", instagram: "إنستغرام", youtube: "يوتيوب" };
const ROLE: Record<string, string> = {
  news: "مانح شرعية", facebook: "مضخّم غضب عام", x: "مضخّم سياسي",
  telegram: "إشارة مبكرة (مصدر محتمل)", tiktok: "انتشار عاطفي", instagram: "انتشار بصري", youtube: "محتوى موسّع",
};

export default function NarrativeOwnershipMap() {
  const [subject, setSubject] = useState("");
  const [d, setD] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const run = (q: string) => {
    if (!q.trim()) return;
    setSubject(q); setLoading(true); setD(null);
    apiGet(`/api/fusion/picture?entity=${encodeURIComponent(q.trim())}`).then(setD).catch(() => setD(null)).finally(() => setLoading(false));
  };
  useEffect(() => { getTargets().then((ts) => run(primaryKeyword(ts))); /* eslint-disable-next-line */ }, []);

  const narratives = (d?.narratives || []).filter((n: any) => (n.platforms || []).length).slice(0, 4);

  return (
    <div className="cbox">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 4 }}>
        <span style={{ fontWeight: 700, fontSize: 14, display: "inline-flex", alignItems: "center", gap: 7 }}><Icon name="network" size={15} /> خريطة ملكية السردية</span>
      </div>
      <p className="muted" style={{ fontSize: 12.5, marginTop: 0 }}>من يحمل السردية وبأي دور — الدور مُستنتج من نوع المنصّة، لا من توقيت أول ظهور.</p>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <input placeholder="كيان / موضوع (مثال: وزارة الكهرباء)" value={subject} onChange={(e) => setSubject(e.target.value)} onKeyDown={(e) => e.key === "Enter" && run(subject)} style={{ flex: 1 }} />
        <button className="btn" onClick={() => run(subject)} disabled={loading}>{loading ? "…" : "ابنِ الخريطة"}</button>
      </div>

      {loading && <div><span className="spinner" /> يدمج المنصّات…</div>}
      {d && !loading && narratives.length === 0 && <p className="muted" style={{ fontSize: 13 }}>لا سرديات عابرة للمنصّات كافية لبناء الخريطة.</p>}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {narratives.map((n: any, i: number) => (
          <div key={i} style={{ border: "1px solid var(--line)", borderRadius: 10, padding: "10px 12px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <b style={{ fontSize: 13.5 }}>{n.narrative}</b>
              <span className="u-fine">{n.posts} منشور · {n.share}%{n.cross_platform > 1 ? ` · عابرة ${n.cross_platform} منصّات` : ""}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 6 }}>
              {(n.platforms || []).map((p: string) => (
                <div key={p} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
                  <Badge t="neutral">{PLAT_AR[p] || p}</Badge>
                  <span style={{ color: "var(--accent)" }}>{ROLE[p] || "حامل سردية"}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="u-fine" style={{ marginTop: 8 }}>حدود: تحديد «المصدر الأول» بدقّة يتطلّب تتبّع توقيت عبر المنصّات (قيد الإنشاء). الأدوار هنا استدلال من نوع المنصّة ويتطلّب مراجعة بشرية.</p>
    </div>
  );
}
