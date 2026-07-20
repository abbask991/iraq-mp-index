"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiGet } from "@/lib/api";
import { SkelCards } from "@/components/Skeleton";
import EmptyState from "@/components/EmptyState";
import EvidenceExplorer from "@/components/EvidenceExplorer";
import DecisionSimulator from "@/components/DecisionSimulator";
import ReputationAttackSurface from "@/components/ReputationAttackSurface";
import { useDemo } from "@/components/ui/DemoContext";

const fmt = (n: number) => (n || 0).toLocaleString("en-US");
const lvlColor = (l: string) => (/حرج/.test(l || "") ? "#dc2626" : /مرتفع/.test(l || "") ? "#f43f5e" : /متوسط/.test(l || "") ? "#f59e0b" : "#22c55e");
const scoreColor = (v: number) => (v >= 60 ? "#22c55e" : v >= 40 ? "#f59e0b" : "#f43f5e");

function Spark({ data, color }: { data: number[]; color: string }) {
  if (!data?.length) return null;
  const max = Math.max(...data), min = Math.min(...data), rng = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * 100},${30 - ((v - min) / rng) * 28}`).join(" ");
  return <svg viewBox="0 0 100 30" style={{ width: "100%", height: 36 }}><polyline points={pts} fill="none" stroke={color} strokeWidth="2" /></svg>;
}

export default function EntityWorkspace() {
  const params = useParams();
  const router = useRouter();
  const id = decodeURIComponent((params?.entity_id as string) || "");
  const [d, setD] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { demo, setDemo } = useDemo();
  const [demoEnts, setDemoEnts] = useState<string[]>([]);

  const load = () => { setLoading(true); apiGet(`/api/entity-workspace?id=${encodeURIComponent(id)}${demo ? "&demo=1" : ""}`).then(setD).finally(() => setLoading(false)); };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id, demo]);
  useEffect(() => { apiGet("/api/entity-workspace/demo-entities").then((r) => setDemoEnts(r?.entities || [])).catch(() => {}); }, []);

  const fb = d?.facebook || {};
  const gap = fb.comment_reaction_gap || {};

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <h2 style={{ margin: 0 }}>🏛️ مساحة عمل الكيان</h2>
        <button className={`btn ${demo ? "" : "ghost"}`} onClick={() => setDemo(!demo)} style={demo ? { background: "#6366f1" } : {}}>🧪 وضع العرض {demo ? "(مفعّل)" : ""}</button>
      </div>
      {demo && demoEnts.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "8px 0" }}>
          <span className="muted" style={{ fontSize: 11 }}>كيانات تجريبية:</span>
          {demoEnts.map((e) => <button key={e} className="btn ghost" style={{ fontSize: 11, padding: "3px 8px" }} onClick={() => router.push(`/monitor/entities/${encodeURIComponent(e)}/workspace`)}>{e}</button>)}
        </div>
      )}

      {loading && <SkelCards count={4} />}
      {!loading && d?.empty && !demo && <EmptyState title={`لا بيانات عن «${id}»`} subtitle={d?.note} action={{ label: "وضع العرض", onClick: () => setDemo(true) }} />}

      {!loading && d && !d.empty && (
        <>
          {/* Header */}
          <div className="cbox" style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
              <div>
                <h3 style={{ margin: 0 }}>{d.name}</h3>
                <div className="muted" style={{ fontSize: 12 }}>{d.type}{d.aliases?.length ? ` · ${d.aliases.join("، ")}` : ""}</div>
              </div>
              {d.latest_change && <span className="chip" style={{ color: "#f43f5e" }}>آخر تغيّر: سمعة {d.latest_change.reputation} · خطر +{d.latest_change.risk}</span>}
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
              {[["السمعة", "reputation"], ["الخطر", "risk"], ["التأثير", "influence"], ["الرأي العام", "public_opinion"]].map(([l, k]: any) => (
                d.scores?.[k] != null && (
                  <div key={k} style={{ flex: "1 1 120px", textAlign: "center", padding: "10px 6px", border: "1px solid var(--line)", borderRadius: 12, background: "var(--input)" }}>
                    <div style={{ fontSize: 26, fontWeight: 900, color: k === "risk" ? lvlColor(d.score_levels?.[k]) : scoreColor(d.scores[k]) }}>{d.scores[k]}</div>
                    <div className="muted" style={{ fontSize: 11.5 }}>{l} · {d.score_levels?.[k]}</div>
                  </div>
                )
              ))}
            </div>
          </div>

          {/* AI summary */}
          <div className="cbox" style={{ marginBottom: 14, borderInlineStart: "4px solid #6366f1" }}>
            <h4 style={{ margin: "0 0 6px" }}>🧠 الموجز التنفيذي</h4>
            <p style={{ fontSize: 14, lineHeight: 1.9, margin: 0 }}>{d.executive_summary}</p>
          </div>

          {/* Decision Simulator — what-if projection for this entity */}
          <div style={{ marginBottom: 14 }}>
            <DecisionSimulator entityId={d.name || id} name={d.name || id} />
          </div>

          {/* Reputation attack surface — where this entity is most exposed */}
          {(d.reputation_risk?.drivers || []).filter(Boolean).length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <ReputationAttackSurface entity={d.name || id} drivers={d.reputation_risk.drivers} />
            </div>
          )}

          {/* Reputation & risk */}
          {d.reputation_risk && (
            <div className="grid" style={{ marginBottom: 14 }}>
              <div className="cbox"><h4>📊 السمعة والخطر</h4>
                <div className="muted" style={{ fontSize: 11 }}>السمعة (7 أيام)</div><Spark data={d.reputation_risk.rep_series} color="#22c55e" />
                <div className="muted" style={{ fontSize: 11 }}>الخطر (7 أيام)</div><Spark data={d.reputation_risk.risk_series} color="#f43f5e" />
                {d.reputation_risk.sentiment_change && <div style={{ fontSize: 12.5, marginTop: 4 }}>تغيّر المشاعر: <b style={{ color: "#f43f5e" }}>{d.reputation_risk.sentiment_change}</b></div>}
              </div>
              <div className="cbox"><h4>🔧 المحرّكات الرئيسية</h4>
                {(d.reputation_risk.drivers || []).filter(Boolean).map((x: string, i: number) => <div key={i} style={{ fontSize: 13, padding: "3px 0" }}>• {x}</div>)}
              </div>
            </div>
          )}

          {/* Campaigns + Narratives */}
          <div className="grid" style={{ marginBottom: 14 }}>
            <div className="cbox"><h4>📢 الحملات</h4>
              {(d.campaigns?.targeting || []).length === 0 && <p className="muted" style={{ fontSize: 12 }}>لا حملات مستهدِفة.</p>}
              {(d.campaigns?.targeting || []).map((c: any, i: number) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "4px 0" }}>
                  <span>🎯 #{c.hashtag}</span><span className="chip" style={{ fontSize: 10.5, color: lvlColor(c.level) }}>تنسيق {c.coordination} · {fmt(c.evidence)} دليل</span>
                </div>
              ))}
            </div>
            <div className="cbox"><h4>🧵 السرديات</h4>
              {d.narratives?.harmful?.length > 0 && <div style={{ fontSize: 12.5 }}><b style={{ color: "#f43f5e" }}>ضارّة:</b> {d.narratives.harmful.join("، ")}</div>}
              {d.narratives?.dominant?.length > 0 && <div style={{ fontSize: 12.5, marginTop: 4 }}><b>مهيمنة:</b> {d.narratives.dominant.join("، ")}</div>}
              {d.narratives?.growing?.length > 0 && <div style={{ fontSize: 12.5, marginTop: 4 }}><b style={{ color: "#f59e0b" }}>صاعدة:</b> {d.narratives.growing.join("، ")}</div>}
              {d.narratives?.supportive?.length > 0 && <div style={{ fontSize: 12.5, marginTop: 4 }}><b style={{ color: "#22c55e" }}>داعمة:</b> {d.narratives.supportive.join("، ")}</div>}
            </div>
          </div>

          {/* Facebook intelligence */}
          {(fb.approval != null || gap.gap_score != null) && (
            <div className="cbox" style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h4 style={{ margin: 0 }}>📘 استخبارات فيسبوك</h4>
                <EvidenceExplorer subject={d.name} type="entity_facebook" demo={demo} />
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 8, fontSize: 12.5 }}>
                {fb.approval != null && <span className="chip">التأييد المدمَج {fb.approval}%</span>}
                {gap.gap_score != null && <span className="chip" style={{ color: gap.misleading ? "#f43f5e" : "#22c55e" }}>فجوة التفاعل/التعليق {gap.gap_score} ({gap.level})</span>}
                {fb.mood_index != null && <span className="chip">مزاج الجمهور {fb.mood_index}</span>}
              </div>
              {gap.explanation && <p style={{ fontSize: 12.5, marginTop: 6, lineHeight: 1.7 }}>{gap.explanation}</p>}
              {fb.accusations?.length > 0 && <div style={{ fontSize: 12.5, marginTop: 4 }}><b style={{ color: "#f43f5e" }}>اتهامات:</b> {fb.accusations.slice(0, 2).join(" · ")}</div>}
              {fb.demands?.length > 0 && <div style={{ fontSize: 12.5, marginTop: 2 }}><b style={{ color: "#22c55e" }}>مطالب:</b> {fb.demands.slice(0, 2).join(" · ")}</div>}
              {fb.note && <p className="muted" style={{ fontSize: 11, marginTop: 6 }}>{fb.note}</p>}
            </div>
          )}

          {/* X + other platforms */}
          <div className="grid" style={{ marginBottom: 14 }}>
            <div className="cbox"><h4>✖️ إكس</h4><p className="muted" style={{ fontSize: 12 }}>{d.x?.note || "لا إشارات."}</p></div>
            <div className="cbox"><h4>📺 منصّات أخرى</h4>
              <p className="muted" style={{ fontSize: 12 }}>{d.other_platforms?.news?.note || "تيك توك/إنستغرام: لا إشارات."}</p></div>
          </div>

          {/* Timeline */}
          {d.timeline?.length > 0 && (
            <div className="cbox" style={{ marginBottom: 14 }}>
              <h4>🕐 الخط الزمني</h4>
              {d.timeline.map((t: any, i: number) => (
                <div key={i} style={{ display: "flex", gap: 8, fontSize: 12.5, padding: "4px 0", borderTop: i ? "1px dashed var(--line)" : 0 }}>
                  <span className="muted" style={{ minWidth: 110 }}>{String(t.time).slice(0, 16).replace("T", " ")}</span>
                  <span><b>{t.platform}</b> — {t.event}</span>
                </div>
              ))}
            </div>
          )}

          {/* Recommendations */}
          {d.recommendations?.length > 0 && (
            <div className="cbox" style={{ marginBottom: 14, borderInlineStart: "4px solid #22c55e" }}>
              <h4 style={{ marginTop: 0 }}>✅ ماذا نفعل الآن؟</h4>
              {d.recommendations.map((a: string, i: number) => <div key={i} style={{ fontSize: 13.5, padding: "3px 0" }}>▸ {a}</div>)}
            </div>
          )}

          <div style={{ marginBottom: 14 }}><EvidenceExplorer subject={d.name} type="entity" score={d.scores?.risk} demo={demo} label="🔍 عرض كل الأدلّة" /></div>
          <p className="muted" style={{ fontSize: 11 }}>{d.disclaimer}</p>
        </>
      )}
    </div>
  );
}
