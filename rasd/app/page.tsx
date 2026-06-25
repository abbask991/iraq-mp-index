import Link from "next/link";
import Reveal from "@/components/Reveal";

const I = {
  monitor: "M3 12h4l3 8 4-16 3 8h4",
  social: "M7 8h10M7 12h6M5 4h14a2 2 0 012 2v9a2 2 0 01-2 2H9l-4 4V6a2 2 0 012-2z",
  ai: "M12 3v3m0 12v3m9-9h-3M6 12H3m13.5-6.5l-2 2m-7 7l-2 2m11 0l-2-2m-7-7l-2-2M12 8a4 4 0 100 8 4 4 0 000-8z",
  alert: "M12 9v4m0 4h.01M10.3 3.9l-8 14A2 2 0 004 21h16a2 2 0 001.7-3l-8-14a2 2 0 00-3.4 0z",
  dash: "M4 13h6V4H4v9zm0 7h6v-5H4v5zm10 0h6v-9h-6v9zm0-16v5h6V4h-6z",
  report: "M9 13h6m-6 4h6m-6-8h2M7 3h7l5 5v11a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2z",
};
function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor"
      strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

const FEATURES: [keyof typeof I, string, string][] = [
  ["monitor", "الرصد الإعلامي", "أخبار ووكالات ومواقع — جمع وتصنيف يومي حسب الموضوع والجهة من ٤٥+ مصدر."],
  ["social", "رصد منصّات التواصل", "X (تويتر) وتيليغرام وريديت — الترندات والهاشتاغات وقياس التفاعل وتحليل الردود."],
  ["ai", "تحليل بالذكاء الاصطناعي", "النبرة والمشاعر، تصنيف القضايا، السرديات، البصمة الأسلوبية، وملخّصات تنفيذية ذكية."],
  ["alert", "كشف الحملات والإنذار المبكر", "كشف التنسيق والحسابات المزيّفة وارتفاع النبرة السلبية قبل أن تتحوّل لأزمة."],
  ["dash", "التوأم الرقمي و٨ مؤشرات", "ملف استخباراتي لكل شخصية: السمعة، النفوذ، الخطر، الأزمة، هيمنة السردية وأكثر."],
  ["report", "تقارير حكومية احترافية", "تقارير PDF / Word / PowerPoint جاهزة للإرسال، مع مساعد ذكي يجيب من بياناتك."],
];

const STATS: [string, string][] = [
  ["+٤٥", "مصدر إعلامي"], ["٨", "مؤشرات استراتيجية"], ["٤", "منصّات بيانات"], ["٢٤/٧", "رصد مستمر"],
];

const UNITS = [
  "رصد البرلمان العراقي", "رصد الأحزاب السياسية", "رصد المحافظات", "رصد الاقتصاد العراقي",
  "الإعلام الإقليمي والدولي حول العراق", "أداء النواب والوزراء إعلامياً",
];

const PLANS = [
  { name: "أساسي", tag: "للأفراد والمكاتب الصغيرة", price: "حسب الاتفاق",
    features: ["رصد حتى ٣ أهداف", "أخبار + X", "تقارير PDF", "تحليل النبرة"], accent: false },
  { name: "احترافي", tag: "للأحزاب وشركات العلاقات العامة", price: "حسب الاتفاق",
    features: ["أهداف غير محدودة", "كل المنصّات", "التوأم الرقمي والمؤشرات", "كشف الحملات والإنذار المبكر", "تقارير دورية"], accent: true },
  { name: "مؤسّسي", tag: "للحكومة والسفارات والمنظمات", price: "حسب الاتفاق",
    features: ["كل ميزات الاحترافي", "وحدات رصد مخصّصة", "شبكات التأثير والأرشيف التاريخي", "دعم وتدريب مخصّص", "تكامل وواجهات API"], accent: false },
];

function Mock() {
  const scores: [string, number, string][] = [
    ["السمعة", 72, "#22c55e"], ["النفوذ", 84, "#4f9dff"], ["الخطر", 31, "#f59e0b"], ["الأزمة", 18, "#34d6c6"]];
  const bars = [40, 62, 35, 78, 55, 90, 48];
  return (
    <div className="lp-mock">
      <div className="lp-mock-top">
        <span className="lp-live"><i /> رصد لحظي</span>
        <span className="lp-mock-title">التوأم الرقمي · محمد ش. السوداني</span>
      </div>
      <div className="lp-mock-scores">
        {scores.map(([l, v, c]) => (
          <div className="lp-sc" key={l}>
            <div className="lp-sc-v" style={{ color: c }}>{v}</div>
            <div className="lp-sc-l">{l}</div>
            <div className="lp-sc-bar"><i style={{ width: `${v}%`, background: c }} /></div>
          </div>
        ))}
      </div>
      <div className="lp-mock-chart">
        <div className="lp-mock-h">حجم الذِكر — آخر ٧ أيام</div>
        <div className="lp-bars">{bars.map((b, i) => <span key={i} style={{ height: `${b}%` }} />)}</div>
      </div>
      <div className="lp-mock-tags">
        {["#الكهرباء", "#الموازنة", "حملة مشتبهة", "نبرة متصاعدة"].map((t) => <span key={t}>{t}</span>)}
      </div>
    </div>
  );
}

export default function Landing() {
  return (
    <div className="lp">
      <header className="lp-nav">
        <div className="lp-brand"><span className="lp-logo" />مركز الرصد</div>
        <Link href="/login" className="btn ghost sm">دخول</Link>
      </header>

      <section className="lp-hero">
        <div className="lp-orb a" /><div className="lp-orb b" /><div className="lp-grid-bg" />
        <div className="lp-hero-grid">
          <div className="lp-hero-text">
            <span className="lp-badge"><i className="dot" /> منصّة استخبارات إعلامية وسياسية · العراق</span>
            <h1>اعرف ماذا يُقال عنك<br /><span className="grad">قبل أن يصبح أزمة.</span></h1>
            <p className="lp-lead">
              الرصد + التحليل بالذكاء الاصطناعي + كشف الحملات + التنبؤ + التقارير — في منصّة واحدة
              للسياسيين والأحزاب والمؤسسات الحكومية وشركات العلاقات العامة.
            </p>
            <div className="lp-cta">
              <Link href="/login" className="btn lg">ابدأ الآن مجاناً</Link>
              <Link href="#pricing" className="btn ghost lg">شاهد الباقات</Link>
            </div>
            <div className="lp-trust">رصد لحظي · ٤٥+ مصدر · ٨ مؤشرات استراتيجية · تقارير جاهزة</div>
          </div>
          <Reveal className="lp-hero-mock"><Mock /></Reveal>
        </div>
      </section>

      <section className="lp-statband">
        {STATS.map(([n, l], i) => (
          <Reveal key={l} delay={i * 80}><div className="lp-stat"><div className="n">{n}</div><div className="l">{l}</div></div></Reveal>
        ))}
      </section>

      <section className="lp-section">
        <Reveal><div className="lp-eyebrow">القدرات</div><h2 className="lp-h2">كل ما تحتاجه لتفهم المشهد وتتحرّك قبل غيرك</h2></Reveal>
        <div className="lp-feat-grid">
          {FEATURES.map(([icon, t, d], i) => (
            <Reveal key={t} delay={(i % 3) * 90}>
              <div className="lp-feat">
                <div className="lp-feat-ic"><Icon d={I[icon]} /></div>
                <div className="lp-feat-t">{t}</div>
                <div className="lp-feat-d">{d}</div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="lp-section">
        <Reveal><div className="lp-eyebrow">مصمّمة للعراق</div><h2 className="lp-h2">وحدات رصد متخصّصة</h2></Reveal>
        <Reveal><div className="lp-chips">{UNITS.map((u) => <span key={u}>{u}</span>)}</div></Reveal>
      </section>

      <section id="pricing" className="lp-section">
        <Reveal><div className="lp-eyebrow">الباقات</div><h2 className="lp-h2">اختر ما يناسب مؤسستك</h2>
          <p className="lp-sub">اشتراك بالتفعيل المباشر — سجّل وتواصل معنا لتفعيل الباقة (فواتير B2B).</p></Reveal>
        <div className="lp-plans">
          {PLANS.map((p, i) => (
            <Reveal key={p.name} delay={i * 90}>
              <div className={"lp-plan" + (p.accent ? " hot" : "")}>
                {p.accent && <div className="lp-badge2">الأكثر طلباً</div>}
                <div className="lp-pname">{p.name}</div>
                <div className="lp-ptag">{p.tag}</div>
                <div className="lp-pprice">{p.price}</div>
                <ul>{p.features.map((f) => <li key={f}>{f}</li>)}</ul>
                <Link href="/login" className={"btn" + (p.accent ? " lg" : " ghost lg")} style={{ width: "100%", textAlign: "center" }}>ابدأ</Link>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="lp-final">
        <Reveal>
          <div className="lp-final-card">
            <div className="lp-orb c" />
            <h2>جاهز تسيطر على روايتك الإعلامية؟</h2>
            <p>أنشئ حسابك خلال دقيقة، جرّب مجاناً، ثم فعّل باقتك.</p>
            <Link href="/login" className="btn lg">إنشاء حساب الآن</Link>
          </div>
        </Reveal>
      </section>

      <footer className="lp-foot">مركز الرصد · منصّة الرصد والتحليل والاستخبارات الإعلامية</footer>
    </div>
  );
}
