"use client";
import { useEffect, useState } from "react";
import { apiGet, apiSend } from "@/lib/api";
import { SkelCards } from "@/components/Skeleton";

const FIELDS: [string, string, string][] = [
  ["entities", "الكيانات المرصودة", "شخصيات/أحزاب/مؤسسات تريد مراقبتها — واحد بكل سطر"],
  ["fb_pages", "صفحات فيسبوك", "slug أو رابط صفحة — واحد بكل سطر (facebook.com/الاسم)"],
  ["brands", "العلامات التجارية", "أسماء الشركات/البراندات — واحد بكل سطر"],
  ["keywords", "الكلمات المفتاحية", "كلمات/مواضيع لتتبّعها — واحد بكل سطر"],
];

export default function Workspace() {
  const [d, setD] = useState<any>(null);
  const [wl, setWl] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState("");
  const [dirty, setDirty] = useState(false);

  const load = () => {
    setLoading(true);
    apiGet("/api/workspace/watchlist").then((r) => {
      setD(r);
      const w = r?.watchlist || {};
      setWl(Object.fromEntries(FIELDS.map(([k]) => [k, (w[k] || []).join("\n")])));
    }).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    setSaved("…"); setDirty(false);
    const body: any = {};
    FIELDS.forEach(([k]) => { body[k] = (wl[k] || "").split("\n").map((x) => x.trim()).filter(Boolean); });
    const r = await apiSend("/api/workspace/watchlist", "POST", body).catch(() => null);
    setSaved(r?.saved ? "✅ حُفظت قائمتك" : "⚠️ سجّل الدخول أو تعذّر الحفظ");
  };

  return (
    <div>
      <h2 style={{ margin: 0 }}>مساحة العمل — قائمة المراقبة الخاصّة</h2>
      <p className="muted">هذي قائمتك أنت فقط — معزولة تماماً عن أي حساب آخر. حدّد كياناتك، صفحاتك، برانداتك، وكلماتك المفتاحية.</p>

      {loading && <SkelCards count={2} />}
      {!loading && d && !d.workspace && (
        <div className="cbox" style={{ borderInlineStart: "4px solid #f59e0b" }}>يجب تسجيل الدخول لعرض/حفظ قائمتك الخاصّة.</div>
      )}
      {!loading && d?.workspace && (
        <>
          <div className="cbox" style={{ marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
            <span style={{ fontSize: 13 }}>👤 حساب: <b>{d.email || d.workspace}</b> <span className="chip" style={{ fontSize: 10 }}>مساحة معزولة</span></span>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {dirty && <span style={{ fontSize: 12, color: "#f59e0b", fontWeight: 700 }}>● غير محفوظة</span>}
              {saved && <span className="muted" style={{ fontSize: 12 }}>{saved}</span>}
              <button className="btn" onClick={save} style={dirty ? { boxShadow: "0 0 0 2px #f59e0b" } : {}}>حفظ قائمتي</button>
            </div>
          </div>
          <div className="grid">
            {FIELDS.map(([k, title, hint]) => (
              <div key={k} className="cbox">
                <h4>{title}</h4>
                <textarea rows={6} value={wl[k] || ""} onChange={(e) => { setWl({ ...wl, [k]: e.target.value }); setDirty(true); setSaved(""); }}
                  placeholder={hint} style={{ width: "100%", fontFamily: "inherit", fontSize: 13, resize: "vertical" }} />
                <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>{(wl[k] || "").split("\n").filter((x) => x.trim()).length} عنصر</div>
              </div>
            ))}
          </div>
          <p className="muted" style={{ fontSize: 11, marginTop: 10 }}>ملاحظة: قائمتك محفوظة بحسابك فقط. ربط الجمع الآلي بها ضمن المرحلة التالية — حالياً تُستخدم كمرجع لمراقبتك.</p>
        </>
      )}
    </div>
  );
}
