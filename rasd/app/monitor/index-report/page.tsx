"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { apiPost } from "@/lib/api";
import RangeSelect, { Range } from "@/components/RangeSelect";

const DIMS: [string, string][] = [
  ["visibility", "الحضور"],
  ["sentiment", "النبرة"],
  ["engagement", "التفاعل"],
  ["diversity", "تنوّع المصادر"],
  ["momentum", "الزخم"],
];
const gradeColor = (g: string) =>
  g.startsWith("A") ? "#22c55e" : g === "B" ? "#84cc16" : g === "C" ? "#f59e0b" : "#f43f5e";

export default function IndexReport() {
  const [monitors, setMonitors] = useState<any[]>([]);
  const [scores, setScores] = useState<Record<number, any>>({});
  const [scanning, setScanning] = useState(false);
  const [open, setOpen] = useState<number | null>(null);
  const [range, setRange] = useState<Range>("week");

  useEffect(() => {
    supabase.from("monitors").select("*").then(({ data }) => setMonitors(data || []));
  }, []);

  const scan = useCallback(async (list: any[]) => {
    setScanning(true);
    for (const m of list) {
      setScores((s) => ({ ...s, [m.id]: "loading" }));
      const r = await apiPost("index", { keywords: m.keywords, range }).catch(() => null);
      setScores((s) => ({ ...s, [m.id]: r || { composite: 0, grade: "—" } }));
    }
    setScanning(false);
  }, [range]);

  const ranked = [...monitors].sort((a, b) => {
    const ca = scores[a.id]?.composite ?? -1, cb = scores[b.id]?.composite ?? -1;
    return cb - ca;
  });

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <div>
          <h2>📊 المؤشرات والدراسات</h2>
          <p className="muted">مؤشر الأداء الإعلامي (0-100) لكل هدف — الحضور + النبرة + التفاعل + تنوّع المصادر + الزخم.</p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <RangeSelect value={range} onChange={setRange} disabled={scanning} />
          <button className="btn" onClick={() => scan(monitors)} disabled={scanning || !monitors.length}>
            {scanning ? "جارٍ الحساب…" : "📈 احسب المؤشر"}
          </button>
        </div>
      </div>

      {!monitors.length && <p className="muted">لا أهداف بعد — أنشئ عملية رصد من <Link href="/monitor">عمليات الرصد</Link>.</p>}

      <div className="section-title">لوحة الترتيب الإعلامي</div>
      {ranked.map((m, i) => {
        const s = scores[m.id];
        const ready = s && s !== "loading";
        return (
          <div className="card" key={m.id} style={{ marginBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, cursor: ready ? "pointer" : "default" }}
              onClick={() => ready && setOpen(open === m.id ? null : m.id)}>
              <div style={{ fontSize: 18, fontWeight: 800, color: "var(--muted)", width: 24 }}>{ready ? i + 1 : "•"}</div>
              <div style={{ flex: 1 }}>
                <b>📡 {m.name}</b>
                <div className="muted" style={{ fontSize: 12 }}>{(m.keywords || []).join(" · ")}</div>
              </div>
              {s === "loading" ? <span className="muted">…</span> : ready ? (
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 24, fontWeight: 800, color: gradeColor(s.grade) }}>{s.composite}</div>
                  <div style={{ fontSize: 11 }}><span className="chip" style={{ color: gradeColor(s.grade) }}>{s.grade}</span></div>
                </div>
              ) : <span className="muted">—</span>}
            </div>

            {open === m.id && ready && s.dims && (
              <div style={{ marginTop: 12, borderTop: "1px solid var(--line)", paddingTop: 12 }}>
                {DIMS.map(([k, label]) => (
                  <div key={k} className="srcrow" style={{ marginBottom: 6 }}>
                    <div style={{ width: 90, fontSize: 13 }}>{label}</div>
                    <div className="bar"><i style={{ width: `${s.dims[k]}%` }} /></div>
                    <div className="num">{s.dims[k]}</div>
                  </div>
                ))}
                <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
                  من {s.total} منشور · {s.pos} إيجابي · {s.neg} سلبي · تفاعل {Number(s.engagement).toLocaleString()} · {s.sources} مصدر
                </div>
                <Link href={`/monitor/${m.id}`} className="btn ghost" style={{ marginTop: 10, padding: "4px 12px", fontSize: 12 }}>لوحة الهدف</Link>
              </div>
            )}
          </div>
        );
      })}

      {monitors.length > 0 && Object.keys(scores).length === 0 && (
        <p className="muted" style={{ marginTop: 12 }}>اضغط «احسب المؤشر» لترتيب أهدافك حسب أدائها الإعلامي. اضغط أي هدف للتفاصيل.</p>
      )}
    </div>
  );
}
