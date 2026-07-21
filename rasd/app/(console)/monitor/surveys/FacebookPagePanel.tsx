"use client";
/**
 * Facebook Page Panel (spec §4,5,6,9). Build a catalog of Facebook pages,
 * filter by category/geography, select an exact set, and save reusable panels
 * with an explainable balance/bias score. Org-scoped via /api/opinion/facebook.
 */
import { useEffect, useState } from "react";
import { apiGet, apiSend } from "@/lib/api";

const CAT_AR: Record<string, string> = {
  government: "حكومي", ministry: "وزارة", party: "حزب", politician: "سياسي",
  news_media: "إعلام", local_news: "أخبار محلية", governorate: "صفحة محافظة",
  community: "مجتمعية", activist: "ناشط", influencer: "مؤثّر", company: "شركة",
  public_service: "خدمة عامة", research_center: "مركز أبحاث", other: "أخرى",
};
const GOVS = ["بغداد", "البصرة", "نينوى", "أربيل", "النجف", "كربلاء", "ذي قار", "الأنبار", "ديالى", "كركوك", "بابل", "واسط", "ميسان", "المثنى", "القادسية", "صلاح الدين", "دهوك", "السليمانية"];

type Page = { id: string; page_name: string; category?: string; governorate?: string; page_size?: number; comments_available?: boolean; reactions_available?: boolean };
type Panel = { id: string; name: string; page_count: number; description?: string };

export default function FacebookPagePanel() {
  const [pages, setPages] = useState<Page[]>([]);
  const [panels, setPanels] = useState<Panel[]>([]);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [fq, setFq] = useState(""); const [fcat, setFcat] = useState(""); const [fgov, setFgov] = useState("");
  const [msg, setMsg] = useState("");
  // add page
  const [pn, setPn] = useState(""); const [pcat, setPcat] = useState("news_media"); const [pgov, setPgov] = useState(""); const [purl, setPurl] = useState(""); const [pcomm, setPcomm] = useState(true);
  // panel
  const [panelName, setPanelName] = useState("");
  const [balance, setBalance] = useState<Record<string, any>>({});

  const loadPages = () => {
    const qs = new URLSearchParams();
    if (fq) qs.set("q", fq); if (fcat) qs.set("category", fcat); if (fgov) qs.set("governorate", fgov);
    apiGet(`/api/opinion/facebook/pages?${qs}`).then((r) => setPages(r?.pages || [])).catch(() => setPages([]));
  };
  const loadPanels = () => apiGet("/api/opinion/facebook/panels").then((r) => setPanels(r?.panels || [])).catch(() => setPanels([]));
  useEffect(() => { loadPages(); loadPanels(); /* eslint-disable-next-line */ }, []);
  useEffect(() => { loadPages(); /* eslint-disable-next-line */ }, [fq, fcat, fgov]);

  const addPage = async () => {
    if (!pn.trim()) { setMsg("⚠️ اسم الصفحة مطلوب"); return; }
    const r = await apiSend("/api/opinion/facebook/pages", "POST",
      { page_name: pn.trim(), category: pcat, governorate: pgov || null, page_url: purl || null, comments_available: pcomm }).catch(() => null);
    if (r?.created) { setPn(""); setPurl(""); setMsg("✅ أُضيفت الصفحة"); loadPages(); } else setMsg("⚠️ تعذّر (صلاحية / هجرة 021)");
  };
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const selectAllFiltered = () => setSel(new Set(pages.map((p) => p.id)));
  const savePanel = async () => {
    if (!panelName.trim()) { setMsg("⚠️ اسم اللوحة مطلوب"); return; }
    if (sel.size === 0) { setMsg("⚠️ اختر صفحات أولاً"); return; }
    const r = await apiSend("/api/opinion/facebook/panels", "POST", { name: panelName.trim(), page_ids: Array.from(sel) }).catch(() => null);
    if (r?.created) { setPanelName(""); setSel(new Set()); setMsg("✅ حُفظت اللوحة"); loadPanels(); } else setMsg("⚠️ تعذّر");
  };
  const showBalance = async (id: string) => {
    if (balance[id]) { setBalance((b) => { const n = { ...b }; delete n[id]; return n; }); return; }
    const r = await apiGet(`/api/opinion/facebook/panels/${id}/balance`).catch(() => null);
    setBalance((b) => ({ ...b, [id]: r }));
  };
  const delPanel = async (id: string) => { await apiSend(`/api/opinion/facebook/panels/${id}`, "DELETE").catch(() => null); loadPanels(); };
  const delPage = async (id: string) => { await apiSend(`/api/opinion/facebook/pages/${id}`, "DELETE").catch(() => null); loadPages(); };

  return (
    <div>
      <p className="muted" style={{ marginTop: 0 }}>كتالوج صفحات فيسبوك واختيارها بدقّة، وحفظ لوحات قابلة لإعادة الاستخدام مع مؤشّر توازن/تحيّز. <b>الانتماء يُدخل يدوياً بأدلّة فقط.</b></p>

      {/* add page */}
      <div className="cbox" style={{ marginBottom: 12 }}>
        <h4 style={{ marginTop: 0 }}>➕ إضافة صفحة للكتالوج</h4>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <input placeholder="اسم الصفحة" value={pn} onChange={(e) => setPn(e.target.value)} style={{ flex: 1, minWidth: 160 }} />
          <input placeholder="رابط (اختياري)" value={purl} onChange={(e) => setPurl(e.target.value)} style={{ width: 160 }} />
          <select value={pcat} onChange={(e) => setPcat(e.target.value)} style={{ width: 130 }}>
            {Object.entries(CAT_AR).map(([k, ar]) => <option key={k} value={k}>{ar}</option>)}
          </select>
          <select value={pgov} onChange={(e) => setPgov(e.target.value)} style={{ width: 120 }}>
            <option value="">— المحافظة —</option>{GOVS.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
          <label style={{ fontSize: 12, display: "flex", gap: 4, alignItems: "center" }}><input type="checkbox" checked={pcomm} onChange={(e) => setPcomm(e.target.checked)} /> تعليقات</label>
          <button className="btn" onClick={addPage}>إضافة</button>
        </div>
        {msg && <p className="muted" style={{ fontSize: 12, marginBottom: 0 }}>{msg}</p>}
      </div>

      {/* filters + selection */}
      <div className="cbox" style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 8 }}>
          <input placeholder="بحث بالاسم" value={fq} onChange={(e) => setFq(e.target.value)} style={{ flex: 1, minWidth: 140 }} />
          <select value={fcat} onChange={(e) => setFcat(e.target.value)} style={{ width: 130 }}><option value="">كل الفئات</option>{Object.entries(CAT_AR).map(([k, ar]) => <option key={k} value={k}>{ar}</option>)}</select>
          <select value={fgov} onChange={(e) => setFgov(e.target.value)} style={{ width: 120 }}><option value="">كل المحافظات</option>{GOVS.map((g) => <option key={g} value={g}>{g}</option>)}</select>
          <button className="btn ghost" style={{ fontSize: 12 }} onClick={selectAllFiltered}>تحديد الكل ({pages.length})</button>
          <span className="muted" style={{ fontSize: 12 }}>محدّد: {sel.size}</span>
        </div>
        {pages.length === 0 ? <p className="muted" style={{ fontSize: 12 }}>لا صفحات مطابقة — أضِف صفحات فوق.</p> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 340, overflowY: "auto" }}>
            {pages.map((p) => (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", background: sel.has(p.id) ? "var(--hover)" : "var(--input)", borderRadius: 6 }}>
                <input type="checkbox" checked={sel.has(p.id)} onChange={() => toggle(p.id)} />
                <div style={{ flex: 1, fontSize: 13 }}>
                  <b>{p.page_name}</b>
                  <span className="chip" style={{ marginInlineStart: 6, fontSize: 10 }}>{CAT_AR[p.category || "other"]}</span>
                  {p.governorate && <span className="muted" style={{ fontSize: 11, marginInlineStart: 6 }}>{p.governorate}</span>}
                  {p.comments_available && <span className="muted" style={{ fontSize: 10, marginInlineStart: 6 }}>💬</span>}
                </div>
                <button className="btn ghost" style={{ fontSize: 11 }} onClick={() => delPage(p.id)}>حذف</button>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10 }}>
          <input placeholder="اسم اللوحة المحفوظة" value={panelName} onChange={(e) => setPanelName(e.target.value)} style={{ minWidth: 180 }} />
          <button className="btn" onClick={savePanel}>حفظ كلوحة ({sel.size})</button>
        </div>
      </div>

      {/* saved panels */}
      <div className="cbox">
        <h4 style={{ marginTop: 0 }}>اللوحات المحفوظة</h4>
        {panels.length === 0 ? <p className="muted" style={{ fontSize: 12 }}>لا لوحات محفوظة بعد.</p> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {panels.map((pl) => (
              <div key={pl.id} style={{ padding: "8px 10px", background: "var(--input)", borderRadius: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div><b style={{ fontSize: 13 }}>{pl.name}</b> <span className="muted" style={{ fontSize: 11 }}>{pl.page_count} صفحة</span></div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button className="btn ghost" style={{ fontSize: 11 }} onClick={() => showBalance(pl.id)}>{balance[pl.id] ? "إخفاء التوازن" : "درجة التوازن"}</button>
                    <button className="btn ghost" style={{ fontSize: 11, color: "#f87171" }} onClick={() => delPanel(pl.id)}>حذف</button>
                  </div>
                </div>
                {balance[pl.id] && (
                  <div style={{ marginTop: 8, fontSize: 12 }}>
                    <div><b style={{ fontSize: 18 }}>{balance[pl.id].score}</b>/100 — {balance[pl.id].level}</div>
                    {(balance[pl.id].risks || []).map((r: string, i: number) => <div key={i} className="muted" style={{ fontSize: 11 }}>⚠️ {r}</div>)}
                    <div className="muted" style={{ fontSize: 10, marginTop: 4 }}>{balance[pl.id].note}</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
