"use client";
import { Icon } from "@/components/ui";

/**
 * Telegram tab — honest placeholder. There is NO Telegram collector in the
 * pipeline yet (the Telegram token is outbound-alerts only). Rather than fake
 * channels/first-push data, this states plainly what Telegram WILL contribute
 * once a collector is built, and what it needs. No fabricated metrics.
 */
const STRENGTHS = [
  "الإشارات المبكرة — تيليجرام غالباً أول من يدفع السردية قبل بقية المنصّات",
  "السرديات المنظّمة والرسائل المعاد توجيهها (forwarded) بين القنوات",
  "النشر المنسّق ولغة الدعاية عبر شبكات القنوات",
];

export default function TelegramView() {
  return (
    <div>
      <h2 style={{ margin: 0 }}>تيليجرام</h2>
      <p className="muted" style={{ marginTop: 4 }}>الأقوى للإشارات المبكرة، السرديات المنظّمة، والتنسيق.</p>

      <div className="cbox" style={{ marginTop: 14, borderInlineStart: "4px solid #f59e0b", display: "flex", gap: 12, alignItems: "flex-start" }}>
        <span style={{ marginTop: 2 }}><Icon name="alert" size={18} /></span>
        <div>
          <b>قيد الإنشاء — لا يوجد جامع تيليجرام بعد</b>
          <p className="muted" style={{ fontSize: 13, lineHeight: 1.9, margin: "6px 0 0" }}>
            لا نعرض بيانات تيليجرام لأنها غير مجموعة فعلياً حتى الآن — رمز البوت الحالي للتنبيهات الصادرة فقط، لا للجمع.
            بدل اختلاق أرقام، هذه الصفحة تبقى صريحة: لا تُظهر إشارة إلا حين يوجد جامع حقيقي.
          </p>
        </div>
      </div>

      <div className="cbox" style={{ marginTop: 14 }}>
        <h4 style={{ marginTop: 0 }}>ماذا سيضيف تيليجرام للصورة الاستخباراتية</h4>
        <ul style={{ margin: 0, paddingInlineStart: 18, lineHeight: 2, fontSize: 13.5 }}>
          {STRENGTHS.map((s, i) => <li key={i}>{s}</li>)}
        </ul>
      </div>

      <div className="cbox" style={{ marginTop: 14 }}>
        <h4 style={{ marginTop: 0 }}>ما يتطلّبه التفعيل</h4>
        <p className="muted" style={{ fontSize: 13, lineHeight: 1.9, margin: 0 }}>
          جامع قنوات تيليجرام (عبر Telethon/MTProto أو مزوّد مثل Bright Data)، يخزّن الرسائل في جدول الإشارات الموحّد
          مع طوابع زمنية — عندها ينضمّ تيليجرام تلقائياً إلى الصورة الموحّدة، مستكشف الأدلّة، ومسار انتشار القضية عبر المنصّات.
        </p>
      </div>
    </div>
  );
}
