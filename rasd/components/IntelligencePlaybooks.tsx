"use client";
import { useState } from "react";
import { Icon } from "@/components/ui";
import ReportGenerationButtons from "@/components/ReportGenerationButtons";

/**
 * Intelligence Playbooks — predefined response guides for common scenarios so a
 * client can act faster. Static, curated expert content (trigger → first action →
 * what to avoid → monitoring plan → report). Not data inference; a decision aid.
 */
type Play = {
  key: string; name: string; trigger: string; first: string; avoid: string;
  monitor: string; timing: string; report: any; icon: any;
};
const PLAYBOOKS: Play[] = [
  { key: "anger", name: "قفزة غضب عام", trigger: "مؤشّر الغضب > 70 وصاعد لأكثر من ١٢ ساعة.", first: "ولّد موجز أزمة وتحقّق من أعلى عناقيد الشكاوى.", avoid: "لا تُصدر نفياً عاماً قبل مراجعة الأدلّة.", monitor: "تابع تعليقات فيسبوك، تضخيم تيليجرام، والتقاط الأخبار لمدة ٢٤ ساعة.", timing: "ردّ خلال ٦ ساعات.", report: "anger", icon: "thermometer" },
  { key: "reputation", name: "هجوم على السمعة", trigger: "تراجع سمعة كيان + ارتفاع نبرة سلبية موجّهة.", first: "حدّد سطح الهجوم (أعلى منطقتي ضعف) وجهّز ردّاً مدعوماً.", avoid: "لا تتفاعل مع كل حساب فردياً.", monitor: "راقب أبرز المضخّمين والسرديات المتكرّرة.", timing: "خلال ١٢ ساعة.", report: "dossier", icon: "trendDown" },
  { key: "campaign", name: "حملة منسّقة", trigger: "درجة تنسيق > 60 مع شبكة حسابات متشابكة.", first: "تقصَّ المصدر والمضخّمين قبل أي رد عام.", avoid: "لا تضخّم الحملة بالرد المباشر عليها.", monitor: "تتبّع حلقات النسخ، دفعات النشر المتزامن، والحسابات الجديدة.", timing: "توثيق أولاً، ردّ لاحقاً.", report: "campaign", icon: "megaphone" },
  { key: "visual", name: "صورة مضلّلة", trigger: "انتشار صورة/فيديو مشكوك بصحّته.", first: "تحقّق بصرياً (مصدر، تاريخ، سياق) قبل التعليق.", avoid: "لا تُعِد نشر الصورة حتى للتكذيب دون تمويه.", monitor: "تتبّع أول ناشر ومسار الانتشار.", timing: "تحقّق فوري.", report: "campaign", icon: "network" },
  { key: "protest", name: "لغة تحوّل إلى فعل", trigger: "رصد دعوات احتجاج/مقاطعة/إضراب متصاعدة.", first: "أبلغ صانع القرار وقيّم الجغرافيا والحجم.", avoid: "لا تتجاهل الإشارة ولو كانت صغيرة إن كانت تتسارع.", monitor: "راقب المنصّة الأعلى والانتشار الجغرافي كل ساعة.", timing: "متابعة مكثّفة.", report: "crisis", icon: "siren" },
  { key: "news", name: "التقاط أخبار سلبي", trigger: "تغطية إعلامية سلبية بدأت تنتشر.", first: "جهّز نقاط ردّ موثّقة وحدّد المنافذ المؤثّرة.", avoid: "لا تتأخر — الفراغ يملؤه الطرف الآخر.", monitor: "تتبّع مسار التقاط الأخبار وتوسّعه.", timing: "خلال ٤ ساعات.", report: "executive", icon: "clip" },
  { key: "complaints", name: "موجة شكاوى عملاء", trigger: "ارتفاع مفاجئ في شكاوى الخدمة/المنتج.", first: "جمّع عناقيد الشكاوى وردّ علناً على الأكثر تكراراً.", avoid: "لا تحذف الشكاوى — يضاعف الغضب.", monitor: "راقب ريفيوات Google وتعليقات فيسبوك.", timing: "خلال ١٢ ساعة.", report: "corporate", icon: "trendDown" },
  { key: "election", name: "هجوم سردية انتخابية", trigger: "سردية موجّهة تستهدف مرشّحاً/كياناً انتخابياً.", first: "وثّق السردية والمضخّمين وجهّز سردية مضادة موثّقة.", avoid: "لا تدخل سجالاً يرفع ظهور الخصم.", monitor: "تتبّع حصّة الصوت والمؤثّرين المنحازين.", timing: "خلال ٦ ساعات.", report: "dossier", icon: "megaphone" },
  { key: "policy", name: "ردّ فعل على سياسة", trigger: "استقبال سلبي واسع لقرار/قانون.", first: "حلّل الدوافع وجهّز توضيحاً يعالج أكثرها إثارة.", avoid: "لا تكرّر الرسالة نفسها التي أثارت الرفض.", monitor: "راقب الغضب حسب القضية والمنصّة.", timing: "خلال ٢٤ ساعة.", report: "anger", icon: "alert" },
  { key: "competitor", name: "تضخيم من منافس", trigger: "إشارات تضخيم منسّق مرتبطة بمنافس.", first: "وثّق نمط التنسيق دون اتهام مباشر غير مثبت.", avoid: "لا تُطلق اتهامات بلا أدلّة قاطعة.", monitor: "قارن حصّة الصوت وأنماط المضخّمين.", timing: "توثيق مستمر.", report: "campaign", icon: "network" },
];

export default function IntelligencePlaybooks() {
  const [open, setOpen] = useState<string>("anger");
  return (
    <div>
      <h2 style={{ margin: 0 }}>أدلّة الاستجابة (Playbooks)</h2>
      <p className="muted" style={{ marginTop: 4 }}>خطط استجابة جاهزة لأكثر السيناريوهات شيوعاً — للتحرّك أسرع وأدقّ. مرجع إرشادي، لا بديل عن الحكم البشري.</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
        {PLAYBOOKS.map((p) => {
          const isOpen = open === p.key;
          return (
            <div key={p.key} className="cbox" style={{ padding: 0, overflow: "hidden" }}>
              <button onClick={() => setOpen(isOpen ? "" : p.key)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", background: "transparent", border: "none", color: "var(--text)", cursor: "pointer", fontFamily: "inherit", textAlign: "start" }}>
                <Icon name={p.icon} size={16} />
                <b style={{ flex: 1, fontSize: 14 }}>{p.name}</b>
                <span className="u-fine">{p.timing}</span>
                <span style={{ transform: isOpen ? "rotate(90deg)" : "none", transition: "transform .15s", opacity: .6 }}>›</span>
              </button>
              {isOpen && (
                <div style={{ padding: "0 14px 14px", fontSize: 13, lineHeight: 1.9 }}>
                  <div><b>الشرط:</b> {p.trigger}</div>
                  <div style={{ color: "var(--accent)" }}><b>الإجراء الأول:</b> {p.first}</div>
                  <div><b>تجنّب:</b> {p.avoid}</div>
                  <div><b>خطة المراقبة:</b> {p.monitor}</div>
                  <div style={{ marginTop: 10 }}><ReportGenerationButtons only={[p.report, "board"]} title="التقرير المناسب" /></div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
