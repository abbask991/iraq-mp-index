"use client";
/**
 * Organization Administration — Users & Roles (spec §4,21). Create client users
 * (password or invite), assign roles, suspend/activate, reset passwords, remove.
 * Tenant-scoped: manages only the signed-in admin's own org.
 */
import { useEffect, useState } from "react";
import { apiGet, apiSend } from "@/lib/api";

const ROLES = [
  { k: "organization_owner", ar: "مالك" },
  { k: "organization_admin", ar: "أدمن" },
  { k: "executive", ar: "تنفيذي" },
  { k: "analyst", ar: "محلّل" },
  { k: "researcher", ar: "باحث" },
  { k: "reviewer", ar: "مراجع" },
  { k: "report_viewer", ar: "مطّلع تقارير" },
  { k: "read_only", ar: "قراءة فقط" },
];
const ROLE_AR: Record<string, string> = Object.fromEntries(ROLES.map((r) => [r.k, r.ar]));

type Member = { user_id: string; email: string; role: string; status?: string };

export default function OrgUsersView() {
  const [members, setMembers] = useState<Member[]>([]);
  const [cap, setCap] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  // add form
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("analyst");
  const [mode, setMode] = useState<"password" | "invite">("password");
  const [password, setPassword] = useState("");
  const [pwEdit, setPwEdit] = useState<string | null>(null);
  const [newPw, setNewPw] = useState("");

  const load = () => {
    setLoading(true);
    apiGet("/api/organization/users")
      .then((r) => { setMembers(r?.users || []); setCap(r?.max_users ?? null); })
      .catch(() => setMembers([])).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!email.trim()) { setMsg("⚠️ الإيميل مطلوب"); return; }
    if (mode === "password" && password.length < 6) { setMsg("⚠️ باسورد ٦ أحرف على الأقل"); return; }
    setMsg("…");
    const r = await apiSend("/api/organization/users", "POST",
      { email: email.trim(), role, mode, password: mode === "password" ? password : undefined }).catch(() => null);
    if (r?.created || r?.invited) {
      setMsg(r?.invited && !r?.created ? "✅ أُرسلت دعوة بالبريد" : "✅ أُنشئ المستخدم");
      setEmail(""); setPassword(""); load();
    } else {
      const e = r?.error === "max_users_reached" ? "بلغت حدّ الباقة للمستخدمين"
        : r?.error || "تعذّر الإنشاء";
      setMsg("⚠️ " + e);
    }
  };

  const changeRole = async (uid: string, newRole: string) => {
    await apiSend(`/api/organization/users/${uid}`, "PATCH", { role: newRole }).catch(() => null);
    load();
  };
  const toggleStatus = async (m: Member) => {
    const status = m.status === "suspended" ? "active" : "suspended";
    await apiSend(`/api/organization/users/${m.user_id}`, "PATCH", { status }).catch(() => null);
    load();
  };
  const resetPw = async (uid: string, sendLink: boolean) => {
    setMsg("…");
    const body = sendLink ? { send_reset: true } : { password: newPw };
    if (!sendLink && newPw.length < 6) { setMsg("⚠️ باسورد ٦ أحرف على الأقل"); return; }
    const r = await apiSend(`/api/organization/users/${uid}/password`, "POST", body).catch(() => null);
    setMsg(r?.changed ? "✅ تغيّرت الباسورد" : r?.sent ? "✅ أُرسل رابط إعادة التعيين" : "⚠️ تعذّر");
    setPwEdit(null); setNewPw("");
  };
  const remove = async (uid: string) => {
    await apiSend(`/api/organization/users/${uid}`, "DELETE").catch(() => null);
    load();
  };

  return (
    <div>
      <h2 style={{ margin: 0 }}>المستخدمون والأدوار</h2>
      <p className="muted">أنشئ حسابات مستخدمي مؤسستك وتحكّم بأدوارهم وحالتهم وكلمات مرورهم. معزول لمؤسستك.</p>

      <div className="cbox" style={{ marginBottom: 14 }}>
        <h4 style={{ marginTop: 0 }}>➕ إضافة مستخدم {cap != null && <span className="muted" style={{ fontSize: 12 }}>({members.length}/{cap})</span>}</h4>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <input placeholder="البريد الإلكتروني" value={email} onChange={(e) => setEmail(e.target.value)} style={{ flex: 1, minWidth: 180 }} />
          <select value={role} onChange={(e) => setRole(e.target.value)} style={{ width: 130 }}>
            {ROLES.map((r) => <option key={r.k} value={r.k}>{r.ar}</option>)}
          </select>
          <select value={mode} onChange={(e) => setMode(e.target.value as any)} style={{ width: 150 }}>
            <option value="password">تحديد باسورد</option>
            <option value="invite">دعوة بالبريد</option>
          </select>
          {mode === "password" && (
            <input type="text" placeholder="باسورد مؤقّت" value={password} onChange={(e) => setPassword(e.target.value)} style={{ width: 150 }} />
          )}
          <button className="btn" onClick={add}>إضافة</button>
        </div>
        {msg && <p className="muted" style={{ fontSize: 12, marginBottom: 0 }}>{msg}</p>}
        {mode === "invite" && <p className="muted" style={{ fontSize: 11, marginTop: 6 }}>الدعوة تتطلّب تفعيل البريد (SMTP) في Supabase؛ لو غير مفعّل استخدم «تحديد باسورد».</p>}
      </div>

      {loading && <span className="muted" style={{ fontSize: 12 }}>…تحميل</span>}
      {!loading && members.length === 0 && <p className="muted" style={{ fontSize: 12 }}>لا مستخدمين في هذه المؤسسة بعد.</p>}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {members.map((m) => (
          <div key={m.user_id} className="cbox" style={{ padding: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
              <div>
                <b style={{ fontSize: 14 }}>{m.email}</b>
                {m.status === "suspended" && <span className="chip" style={{ marginInlineStart: 8, color: "#f87171" }}>موقوف</span>}
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                <select value={m.role} onChange={(e) => changeRole(m.user_id, e.target.value)} style={{ width: 130, fontSize: 12 }}>
                  {ROLES.map((r) => <option key={r.k} value={r.k}>{r.ar}</option>)}
                </select>
                <button className="btn ghost" style={{ fontSize: 12 }} onClick={() => toggleStatus(m)}>
                  {m.status === "suspended" ? "تفعيل" : "إيقاف"}
                </button>
                <button className="btn ghost" style={{ fontSize: 12 }} onClick={() => setPwEdit(pwEdit === m.user_id ? null : m.user_id)}>الباسورد</button>
                <button className="btn ghost" style={{ fontSize: 12, color: "#f87171" }} onClick={() => remove(m.user_id)}>إزالة</button>
              </div>
            </div>
            {pwEdit === m.user_id && (
              <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 10, flexWrap: "wrap" }}>
                <input type="text" placeholder="باسورد جديد" value={newPw} onChange={(e) => setNewPw(e.target.value)} style={{ width: 160 }} />
                <button className="btn" style={{ fontSize: 12 }} onClick={() => resetPw(m.user_id, false)}>تعيين</button>
                <span className="muted" style={{ fontSize: 12 }}>أو</span>
                <button className="btn ghost" style={{ fontSize: 12 }} onClick={() => resetPw(m.user_id, true)}>إرسال رابط إعادة تعيين</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
