"use client";
/**
 * Collection dashboard (spec §7,18). Configure a study's platforms + Facebook
 * pages, set collection depth per platform, see an HONEST volume + cost estimate
 * before activation, and control the collection lifecycle. Actual record
 * collection is wired in Sprint 3 — until then progress is 0 (never faked).
 */
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiGet, apiSend } from "@/lib/api";
import { PageHeader } from "@/components/ui";

const DEPTHS = [
  { k: "light", ar: "خفيف" }, { k: "standard", ar: "قياسي" },
  { k: "deep", ar: "عميق" }, { k: "crisis", ar: "أزمة" },
];
const PLAT_AR: Record<string, string> = {
  facebook: "فيسبوك", x: "إكس", telegram: "تيليجرام", tiktok: "تيك توك",
  instagram: "إنستغرام", youtube: "يوتيوب", google_reviews: "تقييمات Google",
  google_news: "أخبار Google", rss: "RSS", news_websites: "مواقع إخبارية",
};
const STATUS_AR: Record<string, string> = {
  not_started: "لم يبدأ", collecting: "قيد الجمع", paused: "متوقف مؤقتاً", stopped: "موقوف", done: "مكتمل",
};

export default function CollectionPage() {
  const { study_id } = useParams<{ study_id: string }>();
  const router = useRouter();
  const [scope, setScope] = useState<any>(null);
  const [available, setAvailable] = useState<any[]>([]);
  const [panels, setPanels] = useState<any[]>([]);
  const [panelSel, setPanelSel] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    Promise.all([
      apiGet(`/api/opinion/studies/${study_id}/collection`).catch(() => null),
      apiGet(`/api/opinion/studies/${study_id}/sources`).catch(() => null),
      apiGet(`/api/opinion/facebook/panels`).catch(() => null),
    ]).then(([sc, src, pl]) => {
      setScope(sc);
      setAvailable(src?.available_platforms || []);
      setPanels(pl?.panels || []);
    }).finally(() => setLoading(false));
  };
  useEffect(() => { if (study_id) load(); /* eslint-disable-next-line */ }, [study_id]);

  const selectedPlatforms: Record<string, any> = {};
  (scope?.sources || []).forEach((s: any) => { selectedPlatforms[s.platform] = s; });

  const setSource = async (platform: string, patch: any) => {
    const cur = selectedPlatforms[platform] || {};
    const body = {
      platform,
      enabled: true,
      collection_mode: patch.collection_mode ?? cur.collection_mode ?? "standard",
      comments_enabled: patch.comments_enabled ?? cur.comments_enabled ?? true,
      reactions_enabled: patch.reactions_enabled ?? cur.reactions_enabled ?? false,
    };
    const r = await apiSend(`/api/opinion/studies/${study_id}/sources`, "POST", body).catch(() => null);
    if (r?.saved) load(); else setMsg("⚠️ " + (r?.detail || "تعذّر"));
  };
  const removeSource = async (platform: string) => { await apiSend(`/api/opinion/studies/${study_id}/sources/${platform}`, "DELETE").catch(() => null); load(); };
  const attachPanel = async () => {
    if (!panelSel) return;
    const r = await apiSend(`/api/opinion/studies/${study_id}/targets`, "POST", { facebook_panel_id: panelSel }).catch(() => null);
    setMsg(r?.added ? `✅ أُضيفت ${r.added} صفحة` : "⚠️ تعذّر (فعّل فيسبوك أولاً / اللوحة فارغة)");
    load();
  };
  const control = async (action: string) => { await apiSend(`/api/opinion/studies/${study_id}/collection/${action}`, "POST", {}).catch(() => null); load(); };
  const removeTarget = async (id: string) => { await apiSend(`/api/opinion/studies/${study_id}/targets/${id}`, "DELETE").catch(() => null); load(); };

  if (loading) return <span className="muted" style={{ fontSize: 12 }}>…تحميل</span>;
  if (!scope?.study) return <div className="cbox">لا توجد دراسة، أو تحتاج صلاحية.</div>;

  const est = scope.estimate?.total || {};
  const status = scope.status || "not_started";

  return (
    <div>
      <button className="btn ghost" style={{ fontSize: 12, marginBottom: 8 }} onClick={() => router.push("/monitor/surveys")}>← الدراسات</button>
      <PageHeader title={`الجمع — ${scope.study.title}`} sub="اختر المنصّات والصفحات، حدّد العمق، وشاهد الحجم والكلفة المقدّرة قبل التفعيل." />

      {/* status + estimate */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10, marginBottom: 14 }}>
        <Stat v={`${est.records || 0}`} l="سجلّات مقدّرة" />
        <Stat v={`$${(est.cost_usd || 0).toFixed(2)}`} l="كلفة مقدّرة" />
        <Stat v={scope.estimate?.target_count || 0} l="مصادر مختارة" />
        <Stat v={STATUS_AR[status] || status} l="الحالة" />
      </div>

      {/* controls */}
      <div className="cbox" style={{ marginBottom: 14, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        {status !== "collecting"
          ? <button className="btn" onClick={() => control("start")}>بدء الجمع</button>
          : <button className="btn ghost" onClick={() => control("pause")}>إيقاف مؤقت</button>}
        {status === "paused" && <button className="btn" onClick={() => control("resume")}>استئناف</button>}
        <button className="btn ghost" onClick={() => control("stop")}>إيقاف</button>
        <span className="muted" style={{ fontSize: 11 }}>التنفيذ الفعلي للجمع يُربط في Sprint 3؛ الأرقام أعلاه تقديرات قبل التفعيل (لا تُلفّق سجلّات مجموعة).</span>
      </div>

      {/* platforms */}
      <div className="cbox" style={{ marginBottom: 14 }}>
        <h4 style={{ marginTop: 0 }}>المنصّات (المفعّلة لباقتك فقط)</h4>
        {available.length === 0 && <p className="muted" style={{ fontSize: 12 }}>لا منصّات مفعّلة — راجع مشرف المنصّة.</p>}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {available.map((p: any) => {
            const sel = selectedPlatforms[p.source_key];
            return (
              <div key={p.source_key} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", padding: "6px 8px", background: sel ? "var(--hover)" : "var(--input)", borderRadius: 6 }}>
                <b style={{ fontSize: 13, minWidth: 90 }}>{PLAT_AR[p.source_key] || p.source_key}</b>
                {sel ? (
                  <>
                    <select value={sel.collection_mode} onChange={(e) => setSource(p.source_key, { collection_mode: e.target.value })} style={{ fontSize: 12, width: 100 }}>
                      {DEPTHS.map((d) => <option key={d.k} value={d.k}>{d.ar}</option>)}
                    </select>
                    <label style={{ fontSize: 12, display: "flex", gap: 4, alignItems: "center" }}><input type="checkbox" checked={!!sel.comments_enabled} onChange={(e) => setSource(p.source_key, { comments_enabled: e.target.checked })} /> تعليقات</label>
                    <label style={{ fontSize: 12, display: "flex", gap: 4, alignItems: "center" }}><input type="checkbox" checked={!!sel.reactions_enabled} onChange={(e) => setSource(p.source_key, { reactions_enabled: e.target.checked })} /> تفاعلات</label>
                    <button className="btn ghost" style={{ fontSize: 11 }} onClick={() => removeSource(p.source_key)}>إزالة</button>
                  </>
                ) : <button className="btn ghost" style={{ fontSize: 12 }} onClick={() => setSource(p.source_key, {})}>تفعيل</button>}
              </div>
            );
          })}
        </div>
      </div>

      {/* facebook pages via saved panel */}
      <div className="cbox" style={{ marginBottom: 14 }}>
        <h4 style={{ marginTop: 0 }}>صفحات فيسبوك في الدراسة</h4>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
          <select value={panelSel} onChange={(e) => setPanelSel(e.target.value)} style={{ minWidth: 200 }}>
            <option value="">— اختر لوحة صفحات محفوظة —</option>
            {panels.map((pl) => <option key={pl.id} value={pl.id}>{pl.name} ({pl.page_count})</option>)}
          </select>
          <button className="btn" onClick={attachPanel} disabled={!panelSel}>إضافة اللوحة للدراسة</button>
          <span className="muted" style={{ fontSize: 11 }}>أنشئ لوحات من تبويب «لوحة صفحات فيسبوك».</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 300, overflowY: "auto" }}>
          {(scope.targets || []).filter((t: any) => t.target_type === "facebook_page").map((t: any) => (
            <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 8px", background: "var(--input)", borderRadius: 6, fontSize: 13 }}>
              <span>{t.target_name} {t.metadata_json?.governorate && <span className="muted" style={{ fontSize: 11 }}>· {t.metadata_json.governorate}</span>}</span>
              <button className="btn ghost" style={{ fontSize: 11 }} onClick={() => removeTarget(t.id)}>إزالة</button>
            </div>
          ))}
          {(scope.targets || []).length === 0 && <p className="muted" style={{ fontSize: 12 }}>لا صفحات/أهداف مضافة بعد.</p>}
        </div>
      </div>

      {/* estimate breakdown */}
      {scope.estimate?.by_platform && Object.keys(scope.estimate.by_platform).length > 0 && (
        <div className="cbox">
          <h4 style={{ marginTop: 0 }}>تقدير الحجم والكلفة حسب المنصّة</h4>
          <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
            <thead><tr style={{ color: "var(--muted)", fontSize: 12, textAlign: "right" }}><th style={{ padding: 6 }}>المنصّة</th><th style={{ padding: 6 }}>مصادر</th><th style={{ padding: 6 }}>سجلّات مقدّرة</th><th style={{ padding: 6 }}>كلفة</th></tr></thead>
            <tbody>
              {Object.entries(scope.estimate.by_platform).map(([pl, v]: any) => (
                <tr key={pl} style={{ borderTop: "1px solid var(--line)" }}>
                  <td style={{ padding: 6, fontWeight: 700 }}>{PLAT_AR[pl] || pl}</td>
                  <td style={{ padding: 6 }}>{v.targets}</td>
                  <td style={{ padding: 6 }}>{v.records}</td>
                  <td style={{ padding: 6 }}>${v.cost_usd.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="muted" style={{ fontSize: 11, marginBottom: 0 }}>{scope.estimate.note}</p>
        </div>
      )}
      {msg && <p className="muted" style={{ fontSize: 12 }}>{msg}</p>}
    </div>
  );
}

function Stat({ v, l }: { v: any; l: string }) {
  return <div className="cbox" style={{ padding: 12 }}><div style={{ fontSize: 22, fontWeight: 900 }}>{v}</div><div className="muted" style={{ fontSize: 11 }}>{l}</div></div>;
}
