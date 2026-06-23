"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { apiPost } from "@/lib/api";
import RangeSelect, { Range } from "@/components/RangeSelect";

const COMM = ["#2563eb", "#22c55e", "#f59e0b", "#a855f7", "#06b6d4", "#ec4899", "#84cc16", "#fb923c"];
const riskColor = (r: number) => (r >= 60 ? "#f43f5e" : r >= 35 ? "#f59e0b" : "#22c55e");
const lvlColor = (l: string) => (l?.includes("جداً") ? "#f43f5e" : l === "مرتفع" ? "#fb923c" : l === "متوسط" ? "#f59e0b" : "#22c55e");

export default function BigData() {
  const [monitors, setMonitors] = useState<any[]>([]);
  const [term, setTerm] = useState("");
  const [range, setRange] = useState<Range>("week");
  const [d, setD] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { supabase.from("monitors").select("name,keywords").then(({ data }) => setMonitors(data || [])); }, []);

  const run = async (q: string) => {
    if (!q.trim()) return;
    setTerm(q); setLoading(true); setD(null);
    const r = await apiPost("bigdata", { keywords: [q], range }).catch(() => null);
    setD(r); setLoading(false);
  };

  const W = 560, H = 360;
  const net = d?.network;
  const nodeMap: Record<string, any> = {};
  (net?.nodes || []).forEach((n: any) => (nodeMap[n.id] = n));
  const maxHour = Math.max(1, ...(d?.activity_by_hour || [1]));
  const maxBot = Math.max(1, ...(d?.bot_histogram || [1]));
  const maxCo = Math.max(1, ...(d?.age_cohorts || []).map((c: any) => c.count));
  const maxTl = Math.max(1, ...(d?.timeline || []).map((t: any) => t.count));

  return (
    <div>
      <h2>البيانات الضخمة والتحليلات المتقدّمة</h2>
      <p className="muted">تشريح عميق لأي موضوع: مؤشّر تلاعب مركّب، خريطة شبكة التأثير، أنماط النشر، توزيع الحسابات، والبصمات المكرّرة.</p>

      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <input placeholder="موضوع / هاشتاغ / اسم (مثال: الموازنة)" value={term}
            onChange={(e) => setTerm(e.target.value)} onKeyDown={(e) => e.key === "Enter" && run(term)} />
          <button className="btn" onClick={() => run(term)} disabled={loading}>{loading ? "جارٍ التحليل…" : "حلّل"}</button>
        </div>
        <div style={{ marginTop: 10, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <RangeSelect value={range} onChange={setRange} disabled={loading} />
          {monitors.map((m) => (
            <button key={m.name} className="btn ghost" style={{ padding: "3px 10px", fontSize: 12 }}
              onClick={() => run((m.keywords || [m.name])[0])}>{m.name}</button>
          ))}
        </div>
      </div>

      {loading && <div className="spinner" />}

      {d && !loading && (d.sparse ? <p className="muted">{d.message || "بيانات غير كافية لهذا الموضوع."}</p> : (
        <>
          {/* manipulation index hero */}
          <div className="bd-hero">
            <div className="bd-gauge">
              <div className="v" style={{ color: lvlColor(d.level) }}>{d.manipulation_index}</div>
              <div className="l">مؤشّر التلاعب /100</div>
              <span className="chip" style={{ color: lvlColor(d.level), marginTop: 6 }}>{d.level}</span>
            </div>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>مكوّنات المؤشّر — تحليل {d.posts} منشور / {d.accounts} حساب:</div>
              {[["حسابات مشبوهة", d.drivers.bot_pct], ["محتوى مكرّر", d.drivers.dup_ratio], ["حسابات جديدة", d.drivers.new_pct], ["تركيز زمني (دفقات)", d.drivers.burst]].map(([l, v]: any) => (
                <div className="srcrow" key={l} style={{ marginBottom: 6 }}>
                  <div style={{ width: 130, fontSize: 12.5 }}>{l}</div>
                  <div className="bar"><i style={{ width: `${v}%`, background: v >= 50 ? "#f43f5e" : v >= 30 ? "#f59e0b" : undefined }} /></div>
                  <div className="num">{v}%</div>
                </div>
              ))}
            </div>
          </div>

          {/* influence network */}
          <div className="cbox" style={{ marginBottom: 16 }}>
            <h4>خريطة شبكة التأثير — {net?.nodes?.length || 0} حساب · {net?.communities || 0} مجتمع · {net?.edges?.length || 0} رابط</h4>
            <div style={{ overflow: "auto" }}>
              <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ minWidth: 480, background: "var(--input)", borderRadius: 12 }}>
                {(net?.edges || []).map((e: any, i: number) => {
                  const a = nodeMap[e.s], b = nodeMap[e.t];
                  if (!a || !b) return null;
                  return <line key={i} x1={a.x * W} y1={a.y * H} x2={b.x * W} y2={b.y * H} stroke="var(--line)" strokeWidth={0.7} opacity={0.6} />;
                })}
                {(net?.nodes || []).map((n: any) => {
                  const r = 4 + n.size * 1.6;
                  return (
                    <a key={n.id} href={`https://x.com/${n.id}`} target="_blank" rel="noopener">
                      <circle cx={n.x * W} cy={n.y * H} r={r} fill={COMM[n.community % COMM.length]}
                        stroke={n.risk >= 60 ? "#f43f5e" : "#0008"} strokeWidth={n.risk >= 60 ? 2 : 0.5} opacity={0.9}>
                        <title>{`@${n.id} · متابعون ${Number(n.followers).toLocaleString()} · منشورات ${n.posts} · بوت ${n.risk}`}</title>
                      </circle>
                      {n.size >= 7 && <text x={n.x * W} y={n.y * H - r - 2} fontSize={9} fill="var(--text)" textAnchor="middle">@{n.id}</text>}
                    </a>
                  );
                })}
              </svg>
            </div>
            <div className="muted" style={{ fontSize: 11, marginTop: 8 }}>
              الحجم = درجة التأثير · اللون = المجتمع (تكتّل) · الإطار الأحمر = حساب مشبوه. اضغط أي عقدة لزيارة الحساب.
            </div>
          </div>

          <div className="cc-grid">
            {/* activity heatmap */}
            <div className="cbox">
              <h4>نمط النشر عبر الساعة (UTC)</h4>
              <div className="bd-heat">
                {(d.activity_by_hour || []).map((c: number, h: number) => (
                  <div key={h} className="cell" title={`${h}:00 — ${c} منشور`}
                    style={{ background: c ? `rgba(79,157,255,${0.15 + 0.85 * (c / maxHour)})` : "var(--hover)" }}>
                    <span>{h}</span>
                  </div>
                ))}
              </div>
              <div className="muted" style={{ fontSize: 11, marginTop: 6 }}>تركّز النشر بساعات قليلة = مؤشّر أتمتة محتملة.</div>
            </div>

            {/* bot distribution */}
            <div className="cbox">
              <h4>توزيع درجات البوت</h4>
              <div className="bd-bars">
                {(d.bot_histogram || []).map((c: number, i: number) => (
                  <div key={i} className="col" title={`${c} حساب`}>
                    <b>{c}</b>
                    <i style={{ height: `${(c / maxBot) * 100}%`, background: ["#22c55e", "#84cc16", "#f59e0b", "#fb923c", "#f43f5e"][i] }} />
                    <span>{i * 20}-{i * 20 + 20}</span>
                  </div>
                ))}
              </div>
              <div className="muted" style={{ fontSize: 11, marginTop: 6 }}>كل ما مالت للأحمر = حسابات أقرب للبوتات.</div>
            </div>
          </div>

          <div className="cc-grid">
            {/* age cohorts */}
            <div className="cbox">
              <h4>أعمار الحسابات</h4>
              {(d.age_cohorts || []).map((c: any) => (
                <div className="srcrow" key={c.label} style={{ marginBottom: 6 }}>
                  <div style={{ width: 80, fontSize: 12 }}>{c.label}</div>
                  <div className="bar"><i style={{ width: `${(c.count / maxCo) * 100}%`, background: c.label === "< شهر" ? "#f43f5e" : undefined }} /></div>
                  <div className="num">{c.count}</div>
                </div>
              ))}
            </div>

            {/* timeline */}
            <div className="cbox">
              <h4>الخطّ الزمني (حجم + سلبي)</h4>
              <div className="bd-bars" style={{ height: 120 }}>
                {(d.timeline || []).map((t: any, i: number) => (
                  <div key={i} className="col" title={`${t.t} — ${t.count} منشور (${t.neg} سلبي)`}>
                    <i style={{ height: `${(t.count / maxTl) * 100}%`, background: "linear-gradient(180deg,var(--accent2),var(--accent))" }}>
                      <em style={{ height: `${t.count ? (t.neg / t.count) * 100 : 0}%` }} />
                    </i>
                  </div>
                ))}
              </div>
              <div className="muted" style={{ fontSize: 11, marginTop: 6 }}>الجزء الأحمر داخل العمود = نسبة المنشورات السلبية.</div>
            </div>
          </div>

          {d.duplicate_clusters?.length > 0 && (
            <div className="cbox" style={{ marginBottom: 16, borderColor: "#f59e0b55" }}>
              <h4>بصمات محتوى مكرّر (نسخ-لصق)</h4>
              {d.duplicate_clusters.map((c: any, i: number) => (
                <div key={i} style={{ fontSize: 13, padding: "5px 0", borderTop: i ? "1px solid var(--line)" : 0 }}>
                  <span className="chip" style={{ color: "#f59e0b" }}>×{c.count}</span> {c.text}…
                </div>
              ))}
            </div>
          )}

          <div className="cc-grid">
            <div className="cbox">
              <h4>أبرز المضخّمين</h4>
              {(d.amplifiers || []).map((m: any) => (
                <div className="srcrow" key={m.username}>
                  <div style={{ flex: 1, fontSize: 13 }}><a href={`https://x.com/${m.username}`} target="_blank" rel="noopener" style={{ color: "var(--text)" }}>@{m.username}</a></div>
                  <span className="muted" style={{ fontSize: 11 }}>{m.posts} منشور · {Number(m.engagement).toLocaleString()} تفاعل</span>
                </div>
              ))}
            </div>
            <div className="cbox">
              <h4>أكثر الروابط مشاركة</h4>
              {(d.top_domains || []).length === 0 && <span className="muted">لا روابط بارزة.</span>}
              {(d.top_domains || []).map((dm: any) => (
                <div className="srcrow" key={dm.domain}><div style={{ flex: 1, fontSize: 13 }}>{dm.domain}</div><div className="num">{dm.count}</div></div>
              ))}
            </div>
          </div>

          <p className="muted" style={{ fontSize: 11, marginTop: 14 }}>
            * تحليل آلي تقريبي مبني على إشارات علنية — لا يثبت التلاعب بشكل قاطع ويتطلّب مراجعة بشرية.
          </p>
        </>
      ))}
    </div>
  );
}
