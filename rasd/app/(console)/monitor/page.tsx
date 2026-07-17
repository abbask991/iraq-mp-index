"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { PageHeader, Section, Card, CardHead, Badge, Button, Grid, Icon } from "@/components/ui";

export default function Monitors() {
  const [items, setItems] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [kw, setKw] = useState("");
  const [authed, setAuthed] = useState<boolean | null>(null);

  async function load() {
    const { data } = await supabase.from("monitors").select("*").order("created_at", { ascending: false });
    setItems(data ?? []);
  }
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setAuthed(!!data.user));
    load();
  }, []);

  async function create() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { location.href = "/login"; return; }
    const keywords = kw.split(",").map((s) => s.trim()).filter(Boolean);
    if (!name || !keywords.length) return;
    await supabase.from("monitors").insert({ owner: user.id, name, keywords });
    setName(""); setKw(""); load();
  }
  async function del(id: number) {
    await supabase.from("monitors").delete().eq("id", id);
    load();
  }

  if (authed === false)
    return (
      <Card>
        <h2>قائمة المتابعة</h2>
        <p className="u-muted"><Link href="/login">سجّل الدخول</Link> لإدارة الكيانات المرصودة.</p>
      </Card>
    );

  return (
    <div>
      <PageHeader
        title="قائمة المتابعة"
        sub="الكيانات المرصودة — هذه القائمة تُغذّي مركز القيادة وغرفة الحرب والتقارير. أضف كياناً هنا فيظهر في كل الشاشات؛ احذفه فيختفي منها."
      />

      <Section title="إضافة كيان" icon="target">
        <Card>
          <div style={{ display: "grid", gap: "var(--s-3)" }}>
            <input placeholder="اسم الكيان (مثال: وزارة الكهرباء / النائب فلان / شركة س)" value={name}
              onChange={(e) => setName(e.target.value)} />
            <input placeholder="الكلمات المفتاحية مفصولة بفاصلة (مثال: عالية نصيف, الموازنة, التعليم)" value={kw}
              onChange={(e) => setKw(e.target.value)} />
            <div>
              <Button variant="primary" onClick={create} disabled={!name.trim() || !kw.trim()}>
                <Icon name="check" size={14} /> إضافة للمتابعة
              </Button>
            </div>
          </div>
        </Card>
      </Section>

      <Section title="الكيانات المتابَعة" icon="brain" count={items.length}>
        {items.length === 0 ? (
          <Card>
            <p className="u-muted" style={{ margin: 0 }}>
              لا كيانات في قائمتك بعد. أضف أول كيان فوق — بدونه تبقى لوحات الرصد فارغة،
              لأن كل الشاشات تُبنى من هذه القائمة.
            </p>
          </Card>
        ) : (
          <Grid cols="auto">
            {items.map((m) => (
              <Card key={m.id} interactive>
                <Link href={`/monitor/${m.id}`} style={{ color: "inherit", display: "block" }}>
                  <CardHead title={m.name} right={<Badge>{(m.keywords || []).length} كلمة</Badge>} />
                  <div className="u-fine">{(m.keywords || []).join(" · ")}</div>
                </Link>
                <div className="u-card-foot">
                  <Link href={`/monitor/${m.id}`} className="u-fine">فتح اللوحة</Link>
                  <button onClick={() => del(m.id)}
                    style={{ background: "none", border: 0, color: "var(--danger)", cursor: "pointer", fontSize: "var(--t-xs)" }}>
                    حذف
                  </button>
                </div>
              </Card>
            ))}
          </Grid>
        )}
      </Section>
    </div>
  );
}
