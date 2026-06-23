import Link from "next/link";

const FEATURES = [
  ["📰", "الرصد الإعلامي", "أخبار ووكالات ومواقع — جمع وتصنيف يومي حسب الموضوع والجهة من ٤٥+ مصدر."],
  ["📱", "رصد منصّات التواصل", "X (تويتر) وغيرها — متابعة الترندات والهاشتاغات وقياس التفاعل وتحليل الردود."],
  ["🧠", "تحليل المحتوى بالذكاء الاصطناعي", "تحليل النبرة (إيجابي/سلبي/محايد)، تصنيف القضايا، وملخّصات تنفيذية ذكية."],
  ["🔔", "الإنذار المبكر", "رصد ارتفاع الذِكر السلبي والحملات المنظّمة قبل انتشارها وإصدار تنبيهات."],
  ["📊", "لوحات ومؤشرات لحظية", "مؤشر إعلامي، توزيع المصادر، التغطية عبر الزمن — لحظة بلحظة."],
  ["📄", "تقارير احترافية", "تقارير PDF يومية وأسبوعية وشهرية جاهزة للإرسال للعميل، مع تصدير البيانات."],
];

const PLANS = [
  { name: "أساسي", tag: "للأفراد والمكاتب الصغيرة", price: "حسب الاتفاق", features: ["رصد حتى ٣ أهداف", "أخبار + X", "تقارير PDF", "تحليل النبرة"], accent: false },
  { name: "احترافي", tag: "للأحزاب وشركات العلاقات العامة", price: "حسب الاتفاق", features: ["أهداف غير محدودة", "كل المنصّات المتاحة", "تحليل التعليقات والردود", "إنذار مبكر", "تقارير دورية"], accent: true },
  { name: "مؤسّسي", tag: "للحكومة والسفارات والمنظمات", price: "حسب الاتفاق", features: ["كل ميزات الاحترافي", "وحدات رصد مخصّصة", "تحليل الحملات وشبكات التأثير", "دعم مخصّص وتدريب", "تكامل وواجهات API"], accent: false },
];

export default function Landing() {
  return (
    <div className="landing">
      <section className="hero">
        <div className="pill">مركز رصد وتحليل إعلامي · موجّه للعراق</div>
        <h1>اعرف ماذا يُقال عنك<br />قبل أن يصبح أزمة.</h1>
        <p className="lead">
          مركز الرصد يجمع <b>الرصد + التحليل + قياس الرأي العام + الإنذار المبكر</b> في منصّة واحدة —
          للسياسيين والأحزاب والمؤسسات الحكومية وشركات العلاقات العامة.
        </p>
        <div className="cta">
          <Link href="/login" className="btn">ابدأ الآن</Link>
          <Link href="#pricing" className="btn ghost">شاهد الباقات</Link>
        </div>
      </section>

      <section>
        <h2 className="sec">ماذا يقدّم المركز</h2>
        <div className="feat-grid">
          {FEATURES.map(([icon, t, d]) => (
            <div className="feat" key={t}>
              <div className="ic">{icon}</div>
              <div className="ft">{t}</div>
              <div className="fd">{d}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="units">
        <h2 className="sec">وحدات متخصّصة للعراق</h2>
        <div className="chips">
          {["رصد البرلمان العراقي", "رصد الأحزاب السياسية", "رصد المحافظات", "رصد الاقتصاد العراقي",
            "الإعلام الإقليمي والدولي حول العراق", "أداء النواب والوزراء إعلامياً"].map((u) => (
            <span key={u}>{u}</span>
          ))}
        </div>
      </section>

      <section id="pricing">
        <h2 className="sec">الباقات</h2>
        <p className="muted" style={{ textAlign: "center", marginTop: -6 }}>
          الاشتراك بالتفعيل المباشر — سجّل، وتواصل معنا لتفعيل الباقة المناسبة (فواتير B2B).
        </p>
        <div className="plans">
          {PLANS.map((p) => (
            <div className={"plan" + (p.accent ? " hot" : "")} key={p.name}>
              {p.accent && <div className="badge">الأكثر طلباً</div>}
              <div className="pname">{p.name}</div>
              <div className="ptag">{p.tag}</div>
              <div className="pprice">{p.price}</div>
              <ul>{p.features.map((f) => <li key={f}>✓ {f}</li>)}</ul>
              <Link href="/login" className={"btn" + (p.accent ? "" : " ghost")}>ابدأ</Link>
            </div>
          ))}
        </div>
      </section>

      <section className="final">
        <h2>جاهز تبدأ الرصد؟</h2>
        <p className="muted">أنشئ حسابك خلال دقيقة وابدأ بتجربة مجانية، ثم فعّل باقتك.</p>
        <Link href="/login" className="btn">إنشاء حساب</Link>
      </section>

      <footer className="land-foot">مركز الرصد · الرصد والتحليل الإعلامي</footer>
    </div>
  );
}
