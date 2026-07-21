"use client";
/**
 * Survey Studio — Dashboard + light builder (Phase 1, Sprint 1A). Real data from
 * /api/surveys: create surveys, manage questions, run the lifecycle. The full
 * drag-and-drop builder, respondent flow, quotas and analytics come in 1B–1F.
 */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiGet, apiSend } from "@/lib/api";
import { PageHeader } from "@/components/ui";
import Tabs from "@/components/ui/Tabs";
import Link from "next/link";
import FacebookPagePanel from "./FacebookPagePanel";

const TYPES = [
  { k: "standard_survey", ar: "استطلاع قياسي" }, { k: "quick_poll", ar: "تصويت سريع" },
  { k: "citizen_satisfaction", ar: "رضا المواطنين" }, { k: "customer_satisfaction", ar: "رضا العملاء" },
  { k: "election_poll", ar: "استطلاع انتخابي" }, { k: "market_research", ar: "بحث سوق" },
  { k: "employee_survey", ar: "استطلاع موظفين" }, { k: "academic_research", ar: "بحث أكاديمي" },
  { k: "field_survey", ar: "مسح ميداني" }, { k: "custom", ar: "مخصّص" },
];
const TYPE_AR: Record<string, string> = Object.fromEntries(TYPES.map((t) => [t.k, t.ar]));
const STATUS_AR: Record<string, string> = {
  draft: "مسودة", ready: "جاهز", scheduled: "مجدول", active: "نشط",
  paused: "متوقف", closed: "مغلق", completed: "مكتمل", archived: "مؤرشف",
};
const QTYPES: { g: string; items: { k: string; ar: string; opts?: boolean }[] }[] = [
  { g: "نص", items: [{ k: "short_text", ar: "نص قصير" }, { k: "long_text", ar: "نص طويل" }, { k: "email", ar: "بريد" }, { k: "phone", ar: "هاتف" }, { k: "number", ar: "رقم" }] },
  { g: "اختيار", items: [{ k: "single_choice", ar: "اختيار واحد", opts: true }, { k: "multiple_choice", ar: "اختيار متعدد", opts: true }, { k: "dropdown", ar: "قائمة منسدلة", opts: true }, { k: "yes_no", ar: "نعم/لا" }] },
  { g: "تقييم", items: [{ k: "likert", ar: "ليكرت" }, { k: "rating_scale", ar: "مقياس تقييم" }, { k: "star_rating", ar: "نجوم" }, { k: "nps", ar: "NPS" }] },
  { g: "أخرى", items: [{ k: "date", ar: "تاريخ" }, { k: "ranking", ar: "ترتيب", opts: true }, { k: "heading", ar: "عنوان" }, { k: "consent", ar: "موافقة" }] },
];
const Q_OPTS = new Set(["single_choice", "multiple_choice", "dropdown", "ranking", "image_choice"]);
const Q_AR: Record<string, string> = Object.fromEntries(QTYPES.flatMap((g) => g.items).map((i) => [i.k, i.ar]));

type Survey = { id: string; title: string; survey_type: string; status: string; public_token?: string };

export default function SurveysPage() {
  const [sum, setSum] = useState<any>(null);
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);
  const [locked, setLocked] = useState(false);
  const [title, setTitle] = useState("");
  const [stype] = useState("standard_survey");
  const [msg, setMsg] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [tab, setTab] = useState("overview");
  const router = useRouter();

  const load = () => {
    setLoading(true);
    Promise.all([apiGet("/api/surveys/summary").catch(() => null), apiGet("/api/surveys").catch(() => null)])
      .then(([s, l]) => {
        if (l && l.surveys === undefined && !s) setLocked(true);
        setSum(s); setSurveys(l?.surveys || []);
      }).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const createKind = async (mode: string) => {
    if (!title.trim()) { setMsg("⚠️ العنوان مطلوب"); return; }
    setMsg("…");
    const r = await apiSend("/api/surveys", "POST", { title: title.trim(), study_mode: mode, survey_type: stype }).catch(() => null);
    if (r?.created) {
      setTitle(""); setMsg("");
      if (mode === "direct_survey") { setOpen(r.survey.id); load(); }
      else { router.push(`/monitor/surveys/${r.survey.id}/collection`); }  // social → straight to platform/page selection
    } else if (r === null) setMsg("⚠️ لا تملك صلاحية أو الوحدة غير مفعّلة لباقتك");
    else setMsg("⚠️ تعذّر الحفظ — طبّق هجرات قاعدة البيانات 020/021 في Supabase");
  };
  const act = async (id: string, action: string) => {
    const r = await apiSend(`/api/surveys/${id}/${action}`, "POST", {}).catch(() => null);
    if (r && r.ok === false) setMsg("⚠️ " + (r.error || "تعذّر"));
    load();
  };

  return (
    <div>
      <PageHeader title="الاستطلاعات وذكاء الرأي العام" sub="استطلاعات مباشرة + رأي رقمي مرصود عبر المنصّات + دراسات هجينة — مع فصل منهجي صارم." />

      <Tabs tabs={[
        { key: "overview", label: "الاستطلاعات والدراسات", icon: "clip" },
        { key: "facebook", label: "لوحة صفحات فيسبوك", icon: "network" },
      ]} value={tab} onChange={setTab} />

      {tab === "facebook" && <FacebookPagePanel />}

      {tab === "overview" && <>
      {locked && <div className="cbox" style={{ borderInlineStart: "4px solid #f59e0b" }}>وحدة الاستطلاعات غير مفعّلة لباقتك. راجع مشرف المنصّة.</div>}

      {/* summary */}
      {sum && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 10, marginBottom: 16 }}>
          <Stat v={sum.total} l="إجمالي الاستطلاعات" />
          <Stat v={sum.active} l="نشطة" />
          <Stat v={sum.draft} l="مسودات" />
          <Stat v={sum.responses} l="المشاركون" />
          <Stat v={sum.completed_responses} l="مكتملة" />
          <Stat v={`${sum.completion_rate}%`} l="نسبة الإكمال" />
        </div>
      )}

      {/* create — pick the KIND of study */}
      <div className="cbox" style={{ marginBottom: 14 }}>
        <h4 style={{ marginTop: 0 }}>➕ دراسة جديدة</h4>
        <input placeholder="عنوان الدراسة" value={title} onChange={(e) => setTitle(e.target.value)} style={{ width: "100%", marginBottom: 10 }} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 10 }}>
          <button onClick={() => createKind("digital_opinion")} className="cbox" style={{ textAlign: "start", cursor: "pointer", border: "1px solid var(--accent2)", background: "var(--input)" }}>
            <b style={{ fontSize: 14 }}>📊 قياس الرأي من السوشل ميديا</b>
            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>بلا استمارة ولا مشاركين — يقرأ منشورات وتعليقات فيسبوك/إكس… ويحوّلها لقياس رأي (تأييد/معارضة/غضب/شكاوى). تختار المنصّات والصفحات.</div>
          </button>
          <button onClick={() => createKind("direct_survey")} className="cbox" style={{ textAlign: "start", cursor: "pointer", background: "var(--input)" }}>
            <b style={{ fontSize: 14 }}>📝 استبيان بأسئلة (رابط يُشارك بالسوشل)</b>
            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>تبني أسئلة، وتنشرها برابط تشاركه على فيسبوك/واتساب… والناس تجاوب. الجمهور من السوشل، لكن الإجابات مباشرة منهم.</div>
          </button>
        </div>
        {msg && <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>{msg}</p>}
        <p className="muted" style={{ fontSize: 11, marginTop: 8 }}>فصل منهجي صارم: الرأي الرقمي المرصود ليس عيّنة تمثيلية، ولا يُخلط مع إجابات الاستبيان المباشر.</p>
      </div>

      {loading && <span className="muted" style={{ fontSize: 12 }}>…تحميل</span>}
      {!loading && surveys.length === 0 && !locked && <p className="muted" style={{ fontSize: 12 }}>لا دراسات بعد — أنشئ أول واحدة فوق.</p>}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {surveys.map((s) => (
          <SurveyCard key={s.id} s={s} open={open === s.id} onToggle={() => setOpen(open === s.id ? null : s.id)} onAct={act} />
        ))}
      </div>
      </>}
    </div>
  );
}

function Stat({ v, l }: { v: any; l: string }) {
  return <div className="cbox" style={{ padding: 12 }}><div style={{ fontSize: 24, fontWeight: 900 }}>{v}</div><div className="muted" style={{ fontSize: 11 }}>{l}</div></div>;
}

function SurveyCard({ s, open, onToggle, onAct }: { s: Survey; open: boolean; onToggle: () => void; onAct: (id: string, a: string) => void }) {
  return (
    <div className="cbox">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <div onClick={onToggle} style={{ cursor: "pointer" }}>
          <b style={{ fontSize: 15 }}>{s.title}</b>
          <span className="chip" style={{ marginInlineStart: 8, fontSize: 11 }}>{STATUS_AR[s.status] || s.status}</span>
          <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>{TYPE_AR[s.survey_type] || s.survey_type}</div>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          {s.status === "active"
            ? <>
                <span className="muted" style={{ fontSize: 11, direction: "ltr" }}>/s/{s.public_token}</span>
                <button className="btn ghost" style={{ fontSize: 12 }} onClick={() => onAct(s.id, "pause")}>إيقاف مؤقت</button>
                <button className="btn ghost" style={{ fontSize: 12 }} onClick={() => onAct(s.id, "close")}>إغلاق</button>
              </>
            : (s.status === "draft" || s.status === "ready" || s.status === "paused")
              ? <button className="btn" style={{ fontSize: 12 }} onClick={() => onAct(s.id, s.status === "paused" ? "publish" : "publish")}>نشر</button>
              : null}
          <Link href={`/monitor/surveys/${s.id}/collection`} className="btn ghost" style={{ fontSize: 12 }}>الجمع والمصادر</Link>
          <button className="btn ghost" style={{ fontSize: 12 }} onClick={onToggle}>{open ? "إغلاق" : "الأسئلة"}</button>
        </div>
      </div>
      {open && <QuestionEditor survey={s} />}
    </div>
  );
}

function QuestionEditor({ survey }: { survey: Survey }) {
  const [qs, setQs] = useState<any[]>([]);
  const [qtype, setQtype] = useState("single_choice");
  const [qtitle, setQtitle] = useState("");
  const [opts, setOpts] = useState("نعم\nلا");
  const [required, setRequired] = useState(false);
  const [msg, setMsg] = useState("");
  const editable = survey.status === "draft" || survey.status === "ready" || survey.status === "paused";

  const load = () => apiGet(`/api/surveys/${survey.id}/questions`).then((r) => setQs(r?.questions || [])).catch(() => setQs([]));
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [survey.id]);

  const add = async () => {
    if (!qtitle.trim()) { setMsg("⚠️ نص السؤال مطلوب"); return; }
    const body: any = { question_type: qtype, title: qtitle.trim(), required, position: qs.length };
    if (Q_OPTS.has(qtype)) body.options = opts.split("\n").map((o) => o.trim()).filter(Boolean).map((label) => ({ label, value: label }));
    const r = await apiSend(`/api/surveys/${survey.id}/questions`, "POST", body).catch(() => null);
    if (r?.created) { setQtitle(""); setMsg("✅ أُضيف السؤال"); load(); } else setMsg("⚠️ تعذّر");
  };
  const del = async (qid: string) => { await apiSend(`/api/surveys/${survey.id}/questions/${qid}`, "DELETE").catch(() => null); load(); };

  return (
    <div style={{ marginTop: 12, borderTop: "1px solid var(--line)", paddingTop: 12 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
        {qs.length === 0 && <span className="muted" style={{ fontSize: 12 }}>لا أسئلة بعد.</span>}
        {qs.map((q, i) => (
          <div key={q.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 10px", background: "var(--input)", borderRadius: 6 }}>
            <div style={{ fontSize: 13 }}>
              <span className="muted" style={{ fontSize: 11 }}>{i + 1}. </span>{q.title || "—"}
              <span className="chip" style={{ marginInlineStart: 6, fontSize: 10 }}>{Q_AR[q.question_type] || q.question_type}</span>
              {q.required && <span style={{ color: "#f87171", marginInlineStart: 4 }}>*</span>}
            </div>
            {editable && <button className="btn ghost" style={{ fontSize: 11 }} onClick={() => del(q.id)}>حذف</button>}
          </div>
        ))}
      </div>
      {editable ? (
        <div style={{ display: "grid", gap: 6 }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            <select value={qtype} onChange={(e) => setQtype(e.target.value)} style={{ width: 150 }}>
              {QTYPES.map((g) => <optgroup key={g.g} label={g.g}>{g.items.map((it) => <option key={it.k} value={it.k}>{it.ar}</option>)}</optgroup>)}
            </select>
            <input placeholder="نص السؤال" value={qtitle} onChange={(e) => setQtitle(e.target.value)} style={{ flex: 1, minWidth: 160 }} />
            <label style={{ fontSize: 12, display: "flex", gap: 4, alignItems: "center" }}>
              <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} /> إجباري
            </label>
            <button className="btn" style={{ fontSize: 12 }} onClick={add}>إضافة سؤال</button>
          </div>
          {Q_OPTS.has(qtype) && (
            <textarea value={opts} onChange={(e) => setOpts(e.target.value)} placeholder="خيار في كل سطر" rows={3} style={{ width: "100%", fontSize: 12 }} />
          )}
          {msg && <span className="muted" style={{ fontSize: 12 }}>{msg}</span>}
        </div>
      ) : <p className="muted" style={{ fontSize: 11 }}>الاستطلاع منشور — التعديل البنيوي يتطلّب إيقافه مؤقتاً أو نسخة جديدة.</p>}
    </div>
  );
}
