import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 30;

// Generate a short Arabic executive summary of a monitoring period for a target,
// for the PDF report. Input: target name + aggregate stats + sample headlines.

export async function POST(req: NextRequest) {
  const { name, stats, samples } = await req.json().catch(() => ({}));
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key || !name) return NextResponse.json({ summary: "" });

  const lines = (samples || []).slice(0, 40).map((s: any, i: number) =>
    `${i + 1}. [${s.sentiment || "?"}] ${s.title}`).join("\n");
  const prompt = `أنت محلّل رصد إعلامي محترف. اكتب ملخّصاً تنفيذياً موجزاً (4 إلى 6 جُمل) بالعربية الفصحى عن التغطية الإعلامية لـ«${name}» خلال الفترة المرصودة.

الإحصاءات: إجمالي ${stats?.total || 0} منشور — إيجابي ${stats?.pos || 0}، محايد ${stats?.neu || 0}، سلبي ${stats?.neg || 0}. المؤشر الإعلامي ${stats?.idx ?? "-"}/100.

عيّنة من العناوين:
${lines}

غطِّ في الملخّص: النبرة العامة، أبرز المواضيع/القضايا المتكررة، أبرز نقطة إيجابية وأبرز نقطة سلبية إن وُجدت، وجملة ختامية تقييمية. اكتب نصاً متّصلاً احترافياً بدون عناوين أو نقاط أو تمهيد، ابدأ مباشرة بالمحتوى.`;

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 700, messages: [{ role: "user", content: prompt }] }),
    });
    const j = await r.json();
    return NextResponse.json({ summary: (j.content?.[0]?.text || "").trim() });
  } catch {
    return NextResponse.json({ summary: "" });
  }
}
