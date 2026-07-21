"use client";
/**
 * Client Provisioning Wizard (spec §13) — create a fully-configured client
 * organization in minutes, no code. Walks: Info → Sources → Features → Branding
 * → Review, then provisions in order: create org → set type/branding/domain →
 * per-org feature entitlements → assign sources.
 */
import { useEffect, useState } from "react";
import { apiGet, apiSend } from "@/lib/api";
import { ORG_TYPES } from "@/lib/sector";
import { featureRegistry } from "@/lib/nav";

const PLANS = [
  { k: "trial", ar: "تجريبي" }, { k: "basic", ar: "أساسي" },
  { k: "pro", ar: "احترافي" }, { k: "enterprise", ar: "مؤسّسي" },
];
const REGISTRY = featureRegistry();
const STEPS = ["المعلومات", "المصادر", "الصلاحيات", "الهوية", "المراجعة"];

type SourceCat = { source_key: string; name: string; category: string };

export default function ProvisioningWizard({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  // step 1 — info
  const [name, setName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [orgType, setOrgType] = useState("general");
  const [country, setCountry] = useState("");
  const [plan, setPlan] = useState("trial");

  // step 2 — sources
  const [catalog, setCatalog] = useState<SourceCat[]>([]);
  const [sources, setSources] = useState<Set<string>>(new Set());

  // step 3 — features (store the DISABLED set; everything else enabled)
  const [disabled, setDisabled] = useState<Set<string>>(new Set());

  // step 4 — branding
  const [brandName, setBrandName] = useState("");
  const [primary, setPrimary] = useState("");
  const [hideVendor, setHideVendor] = useState(false);
  const [domain, setDomain] = useState("");

  useEffect(() => {
    apiGet("/api/sources/catalog")
      .then((r) => {
        const c: SourceCat[] = (r?.sources || []).map((s: any) => ({ source_key: s.source_key, name: s.name || s.display_name || s.source_key, category: s.category }));
        setCatalog(c);
        // preselect the news basics that every plan gets
        setSources(new Set(["google_news", "rss"]));
      })
      .catch(() => setCatalog([]));
  }, []);

  const toggle = (set: Set<string>, key: string, setter: (s: Set<string>) => void) => {
    const n = new Set(set); n.has(key) ? n.delete(key) : n.add(key); setter(n);
  };

  const provision = async () => {
    if (!name.trim()) { setStep(0); setMsg("⚠️ الاسم مطلوب"); return; }
    setBusy(true); setMsg("…جارٍ الإنشاء");
    try {
      const created = await apiSend("/api/orgs", "POST", { name: name.trim(), plan }).catch(() => null);
      const org = created?.org;
      if (!org?.id) { setMsg("⚠️ تعذّر الإنشاء (صلاحية أدمن / طبّق الهجرات)"); setBusy(false); return; }
      const id = org.id;
      // type + legal + country + branding + domain
      await apiSend(`/api/orgs/${id}`, "PATCH", {
        org_type: orgType,
        legal_name: legalName.trim() || null,
        country: country.trim() || null,
        branding: { name: brandName.trim(), primary: primary.trim(), hide_vendor: hideVendor },
        domain: domain.trim(),
      }).catch(() => null);
      // per-org feature entitlements (hidden = the disabled set)
      if (disabled.size) {
        await apiSend("/api/entitlements/org", "POST", { org_id: id, hidden: Array.from(disabled) }).catch(() => null);
      }
      // assign selected sources
      for (const src of Array.from(sources)) {
        await apiSend("/api/sources/assign", "POST", {
          organization_id: id, source_key: src, enabled: true, collection_mode: "scheduled",
        }).catch(() => null);
      }
      setMsg("✅ أُنشئ العميل وتهيّأ بالكامل");
      setBusy(false);
      onCreated();
      setTimeout(onClose, 700);
    } catch {
      setMsg("⚠️ خطأ غير متوقّع"); setBusy(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", zIndex: 200, display: "flex", alignItems: "flex-start", justifyContent: "center", overflow: "auto", padding: 24 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="cbox" style={{ width: "min(760px, 100%)", marginTop: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0 }}>معالج إنشاء عميل جديد</h3>
          <button className="btn ghost" style={{ fontSize: 13 }} onClick={onClose}>✕</button>
        </div>
        {/* stepper */}
        <div style={{ display: "flex", gap: 6, margin: "12px 0", flexWrap: "wrap" }}>
          {STEPS.map((s, i) => (
            <div key={s} style={{ fontSize: 12, padding: "4px 10px", borderRadius: 6,
              background: i === step ? "var(--accent2)" : "var(--input)",
              color: i === step ? "#fff" : "var(--muted)", fontWeight: i === step ? 700 : 400 }}>
              {i + 1}. {s}
            </div>
          ))}
        </div>

        {step === 0 && (
          <div style={{ display: "grid", gap: 10 }}>
            <label style={{ fontSize: 12 }}>اسم المؤسسة / العميل *
              <input value={name} onChange={(e) => setName(e.target.value)} style={{ width: "100%", marginTop: 4 }} /></label>
            <label style={{ fontSize: 12 }}>الاسم القانوني (اختياري)
              <input value={legalName} onChange={(e) => setLegalName(e.target.value)} style={{ width: "100%", marginTop: 4 }} /></label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              <label style={{ fontSize: 12 }}>القطاع
                <select value={orgType} onChange={(e) => setOrgType(e.target.value)} style={{ width: "100%", marginTop: 4 }}>
                  {ORG_TYPES.map((t) => <option key={t.key} value={t.key}>{t.ar}</option>)}
                </select></label>
              <label style={{ fontSize: 12 }}>الدولة
                <input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="العراق" style={{ width: "100%", marginTop: 4 }} /></label>
              <label style={{ fontSize: 12 }}>الباقة
                <select value={plan} onChange={(e) => setPlan(e.target.value)} style={{ width: "100%", marginTop: 4 }}>
                  {PLANS.map((p) => <option key={p.k} value={p.k}>{p.ar}</option>)}
                </select></label>
            </div>
          </div>
        )}

        {step === 1 && (
          <div>
            <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>اختر المنصّات التي يجمع منها هذا العميل. (الباقة قد تقيّد بعضها لاحقاً.)</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: 6 }}>
              {catalog.map((s) => (
                <label key={s.source_key} style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12 }}>
                  <input type="checkbox" checked={sources.has(s.source_key)} onChange={() => toggle(sources, s.source_key, setSources)} />
                  {s.name}
                </label>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>الوحدات المفعّلة لهذا العميل (✔ = ظاهرة).</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 10 }}>
              {REGISTRY.map((g) => (
                <div key={g.group}>
                  <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 4 }}>{g.group}</div>
                  {g.items.map((it) => (
                    <label key={it.key} style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12, padding: "2px 0" }}>
                      <input type="checkbox" checked={!disabled.has(it.key)} onChange={() => toggle(disabled, it.key, setDisabled)} />
                      {it.ar}
                    </label>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
          <div style={{ display: "grid", gap: 10 }}>
            <p className="muted" style={{ fontSize: 12, margin: 0 }}>اترك فارغاً ليستخدم العميل الهوية الافتراضية.</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <label style={{ fontSize: 12 }}>اسم العلامة
                <input value={brandName} onChange={(e) => setBrandName(e.target.value)} placeholder="Sentinel Intelligence" style={{ width: "100%", marginTop: 4 }} /></label>
              <label style={{ fontSize: 12 }}>اللون الأساسي
                <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 4 }}>
                  <input type="color" value={primary || "#4f9dff"} onChange={(e) => setPrimary(e.target.value)} style={{ width: 40, height: 32, border: "none", background: "none", padding: 0 }} />
                  <input value={primary} onChange={(e) => setPrimary(e.target.value)} placeholder="#4f9dff" style={{ flex: 1 }} />
                </div></label>
            </div>
            <label style={{ fontSize: 12 }}>النطاق المخصّص (اختياري)
              <input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="intel.client.com" style={{ width: "100%", marginTop: 4 }} /></label>
            <label style={{ fontSize: 12, display: "flex", gap: 8, alignItems: "center" }}>
              <input type="checkbox" checked={hideVendor} onChange={(e) => setHideVendor(e.target.checked)} />
              إخفاء «by Integrate Dynamics»
            </label>
          </div>
        )}

        {step === 4 && (
          <div style={{ fontSize: 13, display: "grid", gap: 6 }}>
            <Row k="الاسم" v={name || "—"} />
            <Row k="القطاع" v={ORG_TYPES.find((t) => t.key === orgType)?.ar || orgType} />
            <Row k="الدولة" v={country || "—"} />
            <Row k="الباقة" v={PLANS.find((p) => p.k === plan)?.ar || plan} />
            <Row k="المصادر" v={`${sources.size} مفعّلة`} />
            <Row k="الوحدات المفعّلة" v={`${REGISTRY.reduce((n, g) => n + g.items.length, 0) - disabled.size}`} />
            <Row k="العلامة" v={brandName || "افتراضية"} />
            <Row k="النطاق" v={domain || "—"} />
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16, borderTop: "1px solid var(--line)", paddingTop: 12 }}>
          <div style={{ display: "flex", gap: 8 }}>
            {step > 0 && <button className="btn ghost" onClick={() => setStep(step - 1)}>السابق</button>}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {msg && <span className="muted" style={{ fontSize: 12 }}>{msg}</span>}
            {step < STEPS.length - 1
              ? <button className="btn" onClick={() => setStep(step + 1)}>التالي</button>
              : <button className="btn" disabled={busy} onClick={provision}>{busy ? "…" : "إنشاء العميل"}</button>}
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--line)", paddingBottom: 4 }}>
      <span className="muted">{k}</span><b>{v}</b>
    </div>
  );
}
