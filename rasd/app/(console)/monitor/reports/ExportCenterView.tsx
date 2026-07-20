"use client";
import { useState } from "react";
import { intelPost, intelGet } from "@/lib/api";
import { PageHeader, Button, Icon } from "@/components/ui";

/**
 * Export Center — server-side PDF / Word / PowerPoint generation over
 * POST /api/intelligence/report (+ /job/{id} polling).
 *
 * The generators (playwright, python-docx, python-pptx) run on the RQ worker.
 * This view is HONEST about that: when a worker is configured the job is queued
 * and polled to completion, then the file downloads. When no worker is present
 * the endpoint renders inline — a PDF still comes back as HTML we open for the
 * browser's own "print to PDF", while Word/PowerPoint report that the worker is
 * required rather than pretending to produce a file.
 */
const KINDS: [string, string, boolean][] = [
  ["executive", "الموجز التنفيذي الوطني", false],
  ["daily_book", "الكتاب الاستخباراتي اليومي", false],
  ["crisis", "تقرير موقف الأزمة الوطني", false],
  ["profile", "ملف كيان / شخصية", true],
  ["government", "تقرير جهة حكومية", true],
  ["campaign", "تقرير حملة / هاشتاغ", true],
];
const FORMATS: [string, string][] = [["pdf", "PDF"], ["docx", "Word (DOCX)"], ["pptx", "PowerPoint (PPTX)"]];
const MIME: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

function download(b64: string, mime: string, name: string) {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([arr], { type: mime }));
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export default function ExportCenterView() {
  const [kind, setKind] = useState("executive");
  const [target, setTarget] = useState("");
  const [range, setRange] = useState("week");
  const [format, setFormat] = useState("pdf");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const needsTarget = KINDS.find((k) => k[0] === kind)?.[2];

  const nameFor = (fmt: string) => `${kind}-${(target || "national").replace(/\s+/g, "_")}.${fmt}`;

  const finish = (out: any) => {
    setBusy(false);
    if (out?.pdf_base64) { download(out.pdf_base64, MIME.pdf, nameFor("pdf")); setStatus("تم إنشاء ملف PDF وتنزيله."); return; }
    if (out?.file_base64) { download(out.file_base64, MIME[out.format] || "application/octet-stream", nameFor(out.format || format)); setStatus("تم إنشاء الملف وتنزيله."); return; }
    // PDF requested but no worker → the endpoint hands back rendered HTML; open it
    // in a new window so the browser's own print-to-PDF produces the document.
    if (out?.error && out?.html) {
      const w = window.open("", "_blank");
      if (w) { w.document.write(out.html); w.document.close(); }
      setStatus("خدمة توليد PDF غير مفعّلة على الخادم — فُتح التقرير في نافذة جديدة؛ استخدم طباعة المتصفّح لحفظه PDF.");
      return;
    }
    if (out?.error) { setStatus(`التصدير بصيغة ${format.toUpperCase()} يتطلّب تشغيل خدمة العامل (worker) على الخادم.${out.message ? " " + out.message : ""}`); return; }
    setStatus("تعذّر إنشاء التقرير.");
  };

  const poll = async (jobId: string, tries = 0) => {
    if (tries > 40) { setBusy(false); setStatus("انتهت مهلة الانتظار — حاول لاحقاً."); return; }
    const r = await intelGet(`/job/${jobId}`).catch(() => null);
    if (!r) { setBusy(false); setStatus("تعذّر الاتصال بالخادم."); return; }
    if (r.status === "done" || r.status === "finished") { finish(r); return; }
    if (r.status === "failed") { setBusy(false); setStatus("فشل توليد التقرير على الخادم." + (r.error ? " " + r.error : "")); return; }
    setStatus(`قيد الإنشاء على الخادم… (${r.status})`);
    setTimeout(() => poll(jobId, tries + 1), 2500);
  };

  const run = async () => {
    if (needsTarget && !target.trim()) { setStatus("أدخل اسم الهدف أولاً."); return; }
    setBusy(true); setStatus("يُرسل الطلب…");
    const r = await intelPost("/report", { kind, target, range, format }).catch(() => null);
    if (!r) { setBusy(false); setStatus("تعذّر الاتصال بالخادم."); return; }
    if (r.job_id) { setStatus("أُدرج في قائمة الانتظار…"); poll(r.job_id); return; }
    finish(r); // inline render (no worker) → done or a worker-required notice
  };

  const lbl = { display: "flex", flexDirection: "column" as const, gap: 4, fontSize: 12 };

  return (
    <div>
      <PageHeader title="مركز التصدير" sub="ولّد تقارير رسمية بصيغة PDF / Word / PowerPoint من بيانات المنصّة." />
      <div className="card" style={{ maxWidth: 640, display: "grid", gap: 12 }}>
        <label style={lbl}>
          <span className="muted">نوع التقرير</span>
          <select value={kind} onChange={(e) => { setKind(e.target.value); setStatus(""); }}>
            {KINDS.map((k) => <option key={k[0]} value={k[0]}>{k[1]}</option>)}
          </select>
        </label>

        {needsTarget && (
          <label style={lbl}>
            <span className="muted">الهدف (اسم الكيان / الجهة / الحملة)</span>
            <input value={target} onChange={(e) => setTarget(e.target.value)} placeholder="مثال: وزارة الكهرباء" />
          </label>
        )}

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <label style={{ ...lbl, flex: 1, minWidth: 140 }}>
            <span className="muted">الفترة</span>
            <select value={range} onChange={(e) => setRange(e.target.value)}>
              <option value="day">24 ساعة</option><option value="week">أسبوع</option><option value="month">شهر</option>
            </select>
          </label>
          <label style={{ ...lbl, flex: 1, minWidth: 140 }}>
            <span className="muted">الصيغة</span>
            <select value={format} onChange={(e) => setFormat(e.target.value)}>
              {FORMATS.map((f) => <option key={f[0]} value={f[0]}>{f[1]}</option>)}
            </select>
          </label>
        </div>

        <div>
          <Button variant="primary" onClick={run} disabled={busy}>
            <Icon name="clip" size={14} /> {busy ? "جارٍ الإنشاء…" : "أنشئ التصدير"}
          </Button>
        </div>
        {status && <p className="muted" style={{ fontSize: 13, margin: 0 }}>{status}</p>}
      </div>

      <p className="u-fine" style={{ marginTop: 12, maxWidth: 640 }}>
        تُولَّد تقارير Word و PowerPoint مباشرةً على الخادم وتُنزَّل فوراً. أما PDF فيُولَّد على خادم العامل عند توفّره،
        وإلا يُفتح التقرير في المتصفّح لحفظه PDF عبر أمر الطباعة.
      </p>
    </div>
  );
}
