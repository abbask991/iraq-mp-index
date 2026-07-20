"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { apiGet, apiSend } from "@/lib/api";
import { featureRegistry, PLANS, isAdminEmail, NAV_GROUPS } from "@/lib/nav";
import { SkelCards } from "@/components/Skeleton";
import EmptyState from "@/components/EmptyState";

type UserRow = { user_id: string; email: string | null; plan: string };

// Live preview of the client's menu given the current hidden set (mirrors the sidebar logic).
function MenuPreview({ hidden }: { hidden: Set<string> }) {
  const groups = NAV_GROUPS.map((g) => ({
    g, vis: g.items.filter((it) => it.href && !it.soon && !it.adminOnly && !it.plan && it.action !== "logout" && !hidden.has(it.href)),
  })).filter((x) => x.vis.length > 0);
  return (
    <div className="cbox" style={{ position: "sticky", top: 12 }}>
      <h4 style={{ marginTop: 0 }}>👁️ معاينة قائمة العميل (حيّة)</h4>
      <p className="muted" style={{ fontSize: 11, marginBottom: 8 }}>هكذا يرى العميل القائمة على هذه الباقة — تتحدّث فوراً وأنت تشيّك.</p>
      {groups.length === 0 && <p className="muted" style={{ fontSize: 12 }}>لا شيء ظاهر — كل الميزات مخفيّة.</p>}
      {groups.map(({ g, vis }) => (
        <div key={g.key} style={{ marginBottom: 6 }}>
          <div style={{ color: "var(--accent)", fontWeight: 800, fontSize: 12.5, padding: "3px 0" }}>{g.ar}</div>
          {vis.map((it) => <div key={it.href} style={{ fontSize: 12, padding: "1px 10px", color: "var(--muted)" }}>{it.ar}</div>)}
        </div>
      ))}
    </div>
  );
}

export default function PackagesView() {
  const [gate, setGate] = useState<"loading" | "denied" | "ok">("loading");
  const [mode, setMode] = useState<"plan" | "user">("plan");

  const [plan, setPlan] = useState("basic");
  const [users, setUsers] = useState<UserRow[]>([]);
  const [uid, setUid] = useState("");
  const [override, setOverride] = useState(false);

  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState("");
  const [dirty, setDirty] = useState(false);
  const reg = featureRegistry();

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!isAdminEmail(user?.email)) { setGate("denied"); return; }
      setGate("ok");
      // load users from the backend (service key bypasses client RLS on subscriptions)
      const r = await apiGet("/api/entitlements/users").catch(() => null);
      setUsers((r?.users as UserRow[]) || []);
    })();
  }, []);

  // load hidden set for the current target (plan or user)
  const loadTarget = () => {
    setLoading(true); setSaved(""); setDirty(false);
    if (mode === "plan") {
      apiGet(`/api/entitlements?plan=${plan}`).then((r) => setHidden(new Set(r?.hidden || []))).finally(() => setLoading(false));
    } else if (uid) {
      apiGet(`/api/entitlements/user?uid=${uid}`).then((r) => {
        setOverride(!!r?.has_override);
        // start from the user's override if any, else from their plan (as a baseline)
        if (r?.has_override) { setHidden(new Set(r.hidden || [])); setLoading(false); }
        else {
          const u = users.find((x) => x.user_id === uid);
          apiGet(`/api/entitlements?plan=${u?.plan || "basic"}`).then((p) => setHidden(new Set(p?.hidden || []))).finally(() => setLoading(false));
        }
      }).catch(() => setLoading(false));
    } else { setHidden(new Set()); setLoading(false); }
  };
  useEffect(() => { if (gate === "ok") loadTarget(); /* eslint-disable-next-line */ }, [gate, mode, plan, uid]);

  const toggle = (key: string) => {
    const n = new Set(hidden); n.has(key) ? n.delete(key) : n.add(key); setHidden(n); setSaved(""); setDirty(true);
  };
  const bulk = (show: boolean) => {
    if (show) setHidden(new Set());
    else { const all = new Set<string>(); reg.forEach((g) => g.items.forEach((it) => all.add(it.key))); setHidden(all); }
    setDirty(true); setSaved("");
  };
  const save = async () => {
    setSaved("…");
    const r = mode === "plan"
      ? await apiSend("/api/entitlements", "POST", { plan, hidden: Array.from(hidden) }).catch(() => null)
      : await apiSend("/api/entitlements/user", "POST", { uid, hidden: Array.from(hidden) }).catch(() => null);
    if (mode === "user" && r?.saved) setOverride(true);
    if (r?.saved) setDirty(false);
    setSaved(r?.saved ? "✅ حُفظ" : "⚠️ تعذّر الحفظ");
  };
  const clearUser = async () => {
    setSaved("…");
    const r = await apiSend("/api/entitlements/user", "POST", { uid, clear: true }).catch(() => null);
    if (r?.saved) { setOverride(false); loadTarget(); }
    setSaved(r?.saved ? "↩️ رجع لصلاحيات الباقة" : "⚠️ تعذّر");
  };

  if (gate === "loading") return <p className="muted" style={{ padding: 20 }}>…</p>;
  if (gate === "denied") return <EmptyState tone="error" title="غير مصرّح" subtitle="هذه الصفحة للمشرفين فقط." />;

  const total = reg.reduce((n, g) => n + g.items.length, 0);
  const visibleCount = total - hidden.size;
  const targetLabel = mode === "plan" ? `باقة «${PLANS.find((p) => p.key === plan)?.ar}»`
    : (uid ? `مستخدم «${users.find((u) => u.user_id === uid)?.email || uid}»` : "اختر مستخدماً");

  return (
    <div>
      <h2 style={{ margin: 0 }}>إدارة الباقات والصلاحيات</h2>
      <p className="muted">تحكّم بالميزات الظاهرة — إمّا لكل باقة سعرية، أو لمستخدم مُحدّد (صلاحيات المستخدم تتقدّم على الباقة). المشرف يرى كل شيء دائماً.</p>

      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <button className={`btn ${mode === "plan" ? "" : "ghost"}`} onClick={() => setMode("plan")}>حسب الباقة</button>
        <button className={`btn ${mode === "user" ? "" : "ghost"}`} onClick={() => setMode("user")}>مستخدم محدّد</button>
      </div>

      {/* target selector */}
      <div className="card" style={{ marginBottom: 14, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {mode === "plan" ? (
          <>
            <span className="muted" style={{ fontSize: 12 }}>الباقة:</span>
            {PLANS.map((p) => <button key={p.key} className={`btn ${plan === p.key ? "" : "ghost"}`} onClick={() => setPlan(p.key)}>{p.ar}</button>)}
          </>
        ) : (
          <>
            <span className="muted" style={{ fontSize: 12 }}>المستخدم:</span>
            <select value={uid} onChange={(e) => setUid(e.target.value)} style={{ flex: "1 1 240px" }}>
              <option value="">— اختر مستخدماً —</option>
              {users.map((u) => <option key={u.user_id} value={u.user_id}>{u.email || u.user_id} · {PLANS.find((p) => p.key === u.plan)?.ar || u.plan}</option>)}
            </select>
            {uid && <span className="chip" style={{ fontSize: 11, color: override ? "#22c55e" : "var(--muted)" }}>{override ? "صلاحيات خاصة مفعّلة" : "يتبع الباقة"}</span>}
            {uid && override && <button className="btn ghost" style={{ fontSize: 11 }} onClick={clearUser}>↩️ رجّعه لصلاحيات الباقة</button>}
          </>
        )}
        <span style={{ flex: 1 }} />
        <button className="btn ghost" onClick={() => bulk(true)}>إظهار الكل</button>
        <button className="btn ghost" onClick={() => bulk(false)}>إخفاء الكل</button>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
        <span className="muted" style={{ fontSize: 12.5 }}>ظاهرة <b style={{ color: "#22c55e" }}>{visibleCount}</b> / {total} — {targetLabel}</span>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {dirty && <span style={{ fontSize: 12, color: "#f59e0b", fontWeight: 700 }}>● تغييرات غير محفوظة</span>}
          {saved && <span className="muted" style={{ fontSize: 12 }}>{saved}</span>}
          <button className="btn" onClick={save} disabled={mode === "user" && !uid} style={dirty ? { boxShadow: "0 0 0 2px #f59e0b" } : {}}>حفظ التغييرات</button>
        </div>
      </div>

      {loading && <SkelCards count={4} />}
      {!loading && (mode === "plan" || uid) && (
        <div style={{ display: "flex", gap: 14, alignItems: "flex-start", flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 420px", minWidth: 300 }}>
            {reg.map((g) => (
              <div key={g.group} className="cbox" style={{ marginBottom: 12 }}>
                <h4 style={{ marginTop: 0 }}>{g.group}</h4>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                  {g.items.map((it) => {
                    const on = !hidden.has(it.key);
                    return (
                      <label key={it.key} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, padding: "6px 8px", borderRadius: 8, cursor: "pointer",
                        border: "1px solid var(--line)", background: on ? "color-mix(in srgb,#22c55e 8%,transparent)" : "color-mix(in srgb,#f43f5e 8%,transparent)" }}>
                        <input type="checkbox" checked={on} onChange={() => toggle(it.key)} />
                        <span style={{ flex: 1 }}>{it.ar}</span>
                        <span className="chip" style={{ fontSize: 10, color: on ? "#22c55e" : "#f43f5e" }}>{on ? "ظاهرة" : "مخفيّة"}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <div style={{ flex: "1 1 240px", minWidth: 220 }}><MenuPreview hidden={hidden} /></div>
        </div>
      )}
      {!loading && mode === "user" && !uid && <EmptyState title="اختر مستخدماً" subtitle="اختر مستخدماً من القائمة لتحديد صلاحياته." />}
      <p className="muted" style={{ fontSize: 11 }}>ملاحظة: التطبيق على مستوى الواجهة (إخفاء من القائمة). لحماية كاملة على مستوى المسارات لاحقاً يُنصح بتحقّق في الخادم.</p>
    </div>
  );
}
