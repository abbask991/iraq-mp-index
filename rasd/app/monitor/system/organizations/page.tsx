"use client";
import { useEffect, useState } from "react";
import { apiGet, apiSend } from "@/lib/api";
import { SkelCards } from "@/components/Skeleton";

const PLANS = [
  { k: "trial", ar: "تجريبي" }, { k: "basic", ar: "أساسي" },
  { k: "pro", ar: "احترافي" }, { k: "enterprise", ar: "مؤسّسي" },
];
const PLAN_AR: Record<string, string> = Object.fromEntries(PLANS.map((p) => [p.k, p.ar]));

type Org = { id: string; name: string; plan: string; status?: string; slug?: string; created_at?: string };

export default function Organizations() {
  const [orgs, setOrgs] = useState<Org[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [plan, setPlan] = useState("trial");
  const [msg, setMsg] = useState("");
  const [usage, setUsage] = useState<Record<string, any>>({});
  const [openId, setOpenId] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    apiGet("/api/orgs").then((r) => setOrgs(Array.isArray(r?.orgs) ? r.orgs : []))
      .catch(() => setOrgs([])).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!name.trim()) return;
    setMsg("…");
    const r = await apiSend("/api/orgs", "POST", { name: name.trim(), plan }).catch(() => null);
    if (r?.created) { setName(""); setMsg("✅ أُنشئت المؤسسة"); load(); }
    else setMsg(r ? "⚠️ تعذّر الإنشاء (طبّق الهجرة 013؟)" : "⚠️ تحتاج صلاحية أدمن");
  };

  const changePlan = async (id: string, p: string) => {
    await apiSend(`/api/orgs/${id}`, "PATCH", { plan: p }).catch(() => null);
    load();
  };

  const toggleUsage = async (id: string) => {
    if (openId === id) { setOpenId(null); return; }
    setOpenId(id);
    if (!usage[id]) {
      const r = await apiGet(`/api/orgs/${id}/usage`).catch(() => null);
      setUsage((u) => ({ ...u, [id]: r || { total_usd: 0, by_provider: {} } }));
    }
  };

  return (
    <div>
      <h2 style={{ margin: 0 }}>المؤسسات (العملاء) — العزل والفوترة</h2>
      <p className="muted">كل عميل = مؤسسة معزولة ببياناتها وقائمتها وفاتورتها. هنا تنشئ العملاء، تحدّد باقتهم، وتشوف كلفة البيانات لكل واحد.</p>

      <div className="cbox" style={{ marginBottom: 14 }}>
        <h4>➕ إنشاء عميل جديد</h4>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <input placeholder="اسم المؤسسة / العميل" value={name} onChange={(e) => setName(e.target.value)}
            style={{ flex: 1, minWidth: 200 }} />
          <select value={plan} onChange={(e) => setPlan(e.target.value)} style={{ width: 150 }}>
            {PLANS.map((p) => <option key={p.k} value={p.k}>{p.ar}</option>)}
          </select>
          <button className="btn" onClick={create}>إنشاء</button>
          {msg && <span className="muted" style={{ fontSize: 12 }}>{msg}</span>}
        </div>
      </div>

      {loading && <SkelCards count={3} />}
      {!loading && orgs && orgs.length === 0 && (
        <div className="cbox" style={{ borderInlineStart: "4px solid #f59e0b" }}>
          لا توجد مؤسسات بعد. أنشئ أول عميل فوق — أو إذا ظهر خطأ، طبّق الهجرة <b>013_organizations.sql</b> في Supabase أولاً.
        </div>
      )}
      {!loading && orgs && orgs.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {orgs.map((o) => (
            <div key={o.id} className="cbox">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                <div>
                  <b style={{ fontSize: 15 }}>{o.name}</b>
                  {o.status === "suspended" && <span className="chip" style={{ marginInlineStart: 8, color: "#f87171" }}>موقوف</span>}
                  <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>{o.id}</div>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <select value={o.plan} onChange={(e) => changePlan(o.id, e.target.value)} style={{ width: 130, fontSize: 13 }}>
                    {PLANS.map((p) => <option key={p.k} value={p.k}>{p.ar}</option>)}
                  </select>
                  <button className="btn ghost" style={{ fontSize: 12 }} onClick={() => toggleUsage(o.id)}>
                    {openId === o.id ? "إخفاء الكلفة" : "كلفة البيانات"}
                  </button>
                </div>
              </div>
              {openId === o.id && (
                <div style={{ marginTop: 12, borderTop: "1px solid var(--line)", paddingTop: 12 }}>
                  {!usage[o.id] && <span className="muted" style={{ fontSize: 12 }}>…جارٍ الحساب</span>}
                  {usage[o.id] && (
                    <div>
                      <div style={{ fontSize: 20, fontWeight: 800 }}>
                        ${Number(usage[o.id].total_usd || 0).toFixed(2)}
                        <span className="muted" style={{ fontSize: 12, fontWeight: 400 }}> — هذا الشهر</span>
                      </div>
                      {Object.keys(usage[o.id].by_provider || {}).length === 0 ? (
                        <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                          لا استهلاك مُسجّل بعد. يُملأ تلقائياً عند ربط الجمع بالمزوّدات (المرحلة القادمة).
                        </p>
                      ) : (
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                          {Object.entries(usage[o.id].by_provider).map(([prov, v]: any) => (
                            <span key={prov} className="chip">{prov}: ${Number(v.cost_usd).toFixed(2)} ({v.calls})</span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="muted" style={{ fontSize: 11, marginTop: 14 }}>
        ملاحظة: تتطلّب الهجرة <b>013_organizations.sql</b>. ربط الجمع والفوترة الفعلية بكل مؤسسة ضمن المرحلة القادمة.
      </p>
    </div>
  );
}
