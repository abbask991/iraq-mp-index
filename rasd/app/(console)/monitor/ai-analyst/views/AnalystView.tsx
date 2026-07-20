"use client";
import { useEffect, useRef, useState } from "react";
import { apiGet, apiSend } from "@/lib/api";
import Logo from "@/components/Logo";
import StrategicQuestionGenerator from "@/components/StrategicQuestionGenerator";

type Msg = { role: "user" | "ai"; text: string; entity?: string | null; sources?: string[]; loading?: boolean };

export default function AnalystView() {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [q, setQ] = useState("");
  const [suggested, setSuggested] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { apiGet("/api/analyst/suggested").then((r) => setSuggested(r?.suggested || [])).catch(() => {}); }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  const send = async (question: string) => {
    if (!question.trim() || busy) return;
    setQ(""); setBusy(true);
    setMsgs((m) => [...m, { role: "user", text: question }, { role: "ai", text: "", loading: true }]);
    const r = await apiSend("/api/analyst/ask", "POST", { question }).catch(() => null);
    setMsgs((m) => {
      const c = [...m];
      c[c.length - 1] = { role: "ai", text: r?.answer || "تعذّر الحصول على إجابة.", entity: r?.entity, sources: r?.sources };
      return c;
    });
    setBusy(false);
  };

  return (
    <div className="analyst">
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <Logo size={30} />
        <h2 style={{ margin: 0 }}>المحلّل الذكي — اسأل أي سؤال</h2>
      </div>
      <p className="muted">اسأل بالعراقي عن أي شخصية أو حزب أو وضع، والمحلّل يجمع من كل وحدات المنصّة ويجاوبك بالأدلّة.</p>

      <div className="an-chat">
        {msgs.length === 0 && (
          <div className="an-empty">
            <div style={{ fontSize: 40, marginBottom: 6 }}>🧠</div>
            <div className="muted">ابدأ بسؤال، أو اختر من المقترحات:</div>
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={`an-msg ${m.role}`}>
            <div className="an-bubble">
              {m.loading ? <span className="an-typing"><span /><span /><span /></span>
                : <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.9 }}>{m.text}</div>}
              {!m.loading && m.role === "ai" && (m.entity || m.sources?.length) ? (
                <div className="an-src">
                  {m.entity && <span className="chip" style={{ fontSize: 11 }}>🎯 {m.entity}</span>}
                  {(m.sources || []).map((s) => <span key={s} className="chip muted" style={{ fontSize: 11 }}>{s}</span>)}
                </div>
              ) : null}
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {suggested.length > 0 && msgs.length === 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          {suggested.map((s) => (
            <button key={s} className="btn ghost" style={{ fontSize: 12.5, padding: "5px 11px" }} onClick={() => send(s)}>{s}</button>
          ))}
        </div>
      )}

      {msgs.length === 0 && (
        <div style={{ marginBottom: 10 }}>
          <StrategicQuestionGenerator onPick={(question) => setQ(question)} />
        </div>
      )}

      <div className="an-input">
        <input placeholder="اكتب سؤالك… مثلاً: منو يهاجم الوزير الفلاني هالأسبوع؟" value={q}
          onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send(q)} disabled={busy} />
        <button className="btn" onClick={() => send(q)} disabled={busy || !q.trim()}>{busy ? "…" : "اسأل"}</button>
      </div>
      <p className="muted" style={{ fontSize: 11, marginTop: 8 }}>إجابات مبنية على بيانات المنصّة · لغة احتمالية تتطلّب مراجعة بشرية.</p>
    </div>
  );
}
