"use client";
import { Icon } from "@/components/ui";
import { clientType } from "@/lib/workspace";

/**
 * Client-Language Adapter — frames the SAME real insight in the language that fits
 * the client type. Deterministic templating around a real base insight (never a
 * new AI-invented claim) — it changes emphasis and framing, not facts.
 */
const FRAME: Record<string, (b: string) => string> = {
  research_center: (b) => `من زاوية بحثية: ${b} وقد يتطوّر إلى نقاش سياساتي حول أداء الخدمات والحوكمة.`,
  government: (b) => `كإشارة ضغط عام: ${b} وقد يستدعي تواصلاً خدمياً واستجابة مبكرة.`,
  corporate: (b) => `كضغط على السمعة: ${b} وقد يتطلّب توضيحاً موجّهاً للعملاء.`,
  political_actor: (b) => `كأثر سياسي: ${b} وقد يضعف الثقة لدى الجمهور الحسّاس للخدمات.`,
  media: (b) => `كزاوية تحريرية: ${b} — قصّة قابلة للتغطية مع توثيق المصادر.`,
  embassy: (b) => `كمؤشّر استقرار: ${b} يستحق المتابعة ضمن قراءة المخاطر.`,
  investor: (b) => `كإشارة مخاطر: ${b} وقد يؤثّر على البيئة التشغيلية والسمعة القطاعية.`,
};

export function adaptLanguage(base: string, clientKey?: string): string {
  const f = clientKey ? FRAME[clientKey] : null;
  return f ? f(base) : base;
}

export default function ClientLanguageAdapter({ base, clientKey }: { base: string; clientKey?: string }) {
  if (!base) return null;
  const cfg = clientType(clientKey);
  const framed = adaptLanguage(base, clientKey);
  return (
    <div className="cbox" style={{ borderInlineStart: "3px solid var(--accent)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <Icon name="brain" size={14} />
        <b style={{ fontSize: 13.5 }}>صياغة مخصّصة{cfg ? ` — ${cfg.ar}` : ""}</b>
      </div>
      <p style={{ fontSize: 13.5, lineHeight: 1.9, margin: 0 }}>{framed}</p>
      {!cfg && <p className="u-fine" style={{ marginTop: 6 }}>اختر نوع العميل لتخصيص الصياغة.</p>}
    </div>
  );
}
