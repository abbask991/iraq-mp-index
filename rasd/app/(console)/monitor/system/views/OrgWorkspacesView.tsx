"use client";
/**
 * Organization Administration — Workspaces & Projects (spec §5,21). Wires the
 * /api/organization endpoints: every call is tenant-scoped server-side, so an
 * org admin manages only their OWN org's workspaces and projects.
 */
import { useEffect, useState } from "react";
import { apiGet, apiSend } from "@/lib/api";

type Workspace = { id: string; name: string; workspace_type?: string; status?: string };
type Project = { id: string; workspace_id: string; name: string; project_type?: string; status?: string };

export default function OrgWorkspacesView() {
  const [wss, setWss] = useState<Workspace[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [wsName, setWsName] = useState("");
  const [wsType, setWsType] = useState("");
  const [pName, setPName] = useState("");
  const [pType, setPType] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);

  const loadWss = () => {
    setLoading(true);
    apiGet("/api/organization/workspaces")
      .then((r) => setWss(r?.workspaces || []))
      .catch(() => setWss([])).finally(() => setLoading(false));
  };
  const loadProjects = (wid: string) => {
    apiGet(`/api/organization/projects?workspace_id=${wid}`)
      .then((r) => setProjects(r?.projects || [])).catch(() => setProjects([]));
  };
  useEffect(() => { loadWss(); }, []);
  useEffect(() => { if (sel) loadProjects(sel); else setProjects([]); }, [sel]);

  const createWs = async () => {
    if (!wsName.trim()) return;
    setMsg("…");
    const r = await apiSend("/api/organization/workspaces", "POST",
      { name: wsName.trim(), workspace_type: wsType.trim() }).catch(() => null);
    if (r?.created) { setWsName(""); setWsType(""); setMsg("✅ أُنشئت مساحة العمل"); loadWss(); }
    else setMsg("⚠️ تعذّر الإنشاء (صلاحية مطلوبة / طبّق 017)");
  };
  const delWs = async (id: string) => {
    await apiSend(`/api/organization/workspaces/${id}`, "DELETE").catch(() => null);
    if (sel === id) setSel(null);
    loadWss();
  };
  const createProj = async () => {
    if (!pName.trim() || !sel) return;
    setMsg("…");
    const r = await apiSend("/api/organization/projects", "POST",
      { workspace_id: sel, name: pName.trim(), project_type: pType.trim() }).catch(() => null);
    if (r?.created) { setPName(""); setPType(""); setMsg("✅ أُنشئ المشروع"); loadProjects(sel); }
    else setMsg("⚠️ تعذّر");
  };
  const delProj = async (id: string) => {
    if (!sel) return;
    await apiSend(`/api/organization/projects/${id}`, "DELETE").catch(() => null);
    loadProjects(sel);
  };

  return (
    <div>
      <h2 style={{ margin: 0 }}>مساحات العمل والمشاريع</h2>
      <p className="muted">نظّم رصد مؤسستك: مساحة عمل لكل مجال (خدمات، إعلام، أزمات)، ومشاريع داخلها. معزولة لمؤسستك فقط.</p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        {/* workspaces */}
        <div className="cbox">
          <h4 style={{ marginTop: 0 }}>مساحات العمل</h4>
          <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
            <input placeholder="اسم مساحة العمل" value={wsName} onChange={(e) => setWsName(e.target.value)} style={{ flex: 1, minWidth: 120 }} />
            <input placeholder="النوع (اختياري)" value={wsType} onChange={(e) => setWsType(e.target.value)} style={{ width: 120 }} />
            <button className="btn" onClick={createWs}>إضافة</button>
          </div>
          {loading && <span className="muted" style={{ fontSize: 12 }}>…تحميل</span>}
          {!loading && wss.length === 0 && <p className="muted" style={{ fontSize: 12 }}>لا مساحات عمل بعد.</p>}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {wss.map((w) => (
              <div key={w.id} onClick={() => setSel(w.id)}
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", borderRadius: 6, cursor: "pointer",
                  background: sel === w.id ? "var(--hover)" : "var(--input)", border: sel === w.id ? "1px solid var(--accent2)" : "1px solid transparent" }}>
                <div><b style={{ fontSize: 13 }}>{w.name}</b>{w.workspace_type && <span className="muted" style={{ fontSize: 11, marginInlineStart: 6 }}>{w.workspace_type}</span>}</div>
                <button className="btn ghost" style={{ fontSize: 11 }} onClick={(e) => { e.stopPropagation(); delWs(w.id); }}>حذف</button>
              </div>
            ))}
          </div>
        </div>

        {/* projects */}
        <div className="cbox">
          <h4 style={{ marginTop: 0 }}>المشاريع {sel ? "" : "— اختر مساحة عمل"}</h4>
          {sel && (
            <>
              <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
                <input placeholder="اسم المشروع" value={pName} onChange={(e) => setPName(e.target.value)} style={{ flex: 1, minWidth: 120 }} />
                <input placeholder="النوع (اختياري)" value={pType} onChange={(e) => setPType(e.target.value)} style={{ width: 120 }} />
                <button className="btn" onClick={createProj}>إضافة</button>
              </div>
              {projects.length === 0 && <p className="muted" style={{ fontSize: 12 }}>لا مشاريع في هذه المساحة.</p>}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {projects.map((p) => (
                  <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", borderRadius: 6, background: "var(--input)" }}>
                    <div><b style={{ fontSize: 13 }}>{p.name}</b>{p.project_type && <span className="muted" style={{ fontSize: 11, marginInlineStart: 6 }}>{p.project_type}</span>}</div>
                    <button className="btn ghost" style={{ fontSize: 11 }} onClick={() => delProj(p.id)}>حذف</button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
      {msg && <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>{msg}</p>}
    </div>
  );
}
