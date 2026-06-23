import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

// Monitor X (Twitter) for mentions of a person/institution via the official
// X API v2 recent-search endpoint. Requires a paid tier (Basic+) bearer token
// set as the X_BEARER_TOKEN env var. Returns the SAME hit shape as
// /api/monitor-fetch (title/link/source/date/sentiment/type) plus engagement,
// so the monitor dashboard renders it with no changes.

async function classify(titles: string[]) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key || !titles.length) return null;
  const listed = titles.map((t, i) => `${i + 1}. ${t}`).join("\n");
  const prompt = `تغريدات. صنّف كل تغريدة. أعد JSON array فقط بنفس الترتيب (${titles.length} عنصر)، كل عنصر {"sentiment":"إيجابي|محايد|سلبي","type":"أمني/حادث|فساد/قضاء|تشريعي|رقابي|دبلوماسي/زيارة|تصريح|عام"}.\n\n${listed}`;
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 2000, messages: [{ role: "user", content: prompt }] }),
    });
    const j = await r.json();
    const txt = j.content[0].text as string;
    return JSON.parse(txt.slice(txt.indexOf("["), txt.lastIndexOf("]") + 1));
  } catch { return null; }
}

async function classifyAll(titles: string[]) {
  const out: any[] = [];
  for (let i = 0; i < titles.length; i += 25) {
    const chunk = titles.slice(i, i + 25);
    const r = await classify(chunk);
    if (r && r.length === chunk.length) out.push(...r);
    else out.push(...chunk.map(() => ({ sentiment: "محايد", type: "عام" })));
  }
  return out;
}

async function searchX(term: string, token: string) {
  // last-7-days recent search; Arabic, exclude retweets, English-name fallback kept simple
  const q = encodeURIComponent(`"${term}" -is:retweet`);
  const fields = "tweet.fields=created_at,public_metrics,lang&expansions=author_id&user.fields=username,name,verified";
  const url = `https://api.twitter.com/2/tweets/search/recent?query=${q}&max_results=50&${fields}`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) return { error: r.status, body: await r.text().catch(() => "") };
  const j = await r.json();
  const users: Record<string, any> = {};
  for (const u of j.includes?.users || []) users[u.id] = u;
  return {
    items: (j.data || []).map((t: any) => {
      const u = users[t.author_id] || {};
      const m = t.public_metrics || {};
      return {
        term,
        title: t.text,
        link: `https://x.com/${u.username || "i/web"}/status/${t.id}`,
        source: u.username ? `@${u.username}` : "X",
        author: u.name || u.username || "",
        date: (t.created_at || "").slice(0, 10),
        engagement: (m.like_count || 0) + (m.retweet_count || 0) + (m.reply_count || 0) + (m.quote_count || 0),
        likes: m.like_count || 0,
        retweets: m.retweet_count || 0,
      };
    }),
  };
}

export async function POST(req: NextRequest) {
  const { keywords } = await req.json().catch(() => ({ keywords: [] }));
  if (!Array.isArray(keywords) || !keywords.length) return NextResponse.json({ hits: [] });

  const token = process.env.X_BEARER_TOKEN;
  if (!token) {
    return NextResponse.json({
      hits: [], count: 0, sources: 0, platform: "x",
      error: "X_TOKEN_MISSING",
      message: "لتفعيل رصد X أضِف متغيّر X_BEARER_TOKEN (من خطة X API المدفوعة) في إعدادات المشروع.",
    });
  }

  let hits: any[] = [];
  let apiError: any = null;
  for (const k of keywords.slice(0, 5)) {
    const res = await searchX(k, token);
    if ("error" in res) { apiError = res; continue; }
    hits = hits.concat(res.items);
  }

  if (!hits.length && apiError) {
    const msg = apiError.error === 401 ? "توكن X غير صالح (401) — تأكد من X_BEARER_TOKEN."
      : apiError.error === 429 ? "تم تجاوز حد الطلبات لخطة X الحالية (429) — جرّب لاحقاً أو رقِّ الخطة."
      : apiError.error === 403 ? "خطة X الحالية لا تسمح بالبحث (403) — تحتاج خطة Basic أو أعلى."
      : `تعذّر الاتصال بـX (${apiError.error}).`;
    return NextResponse.json({ hits: [], count: 0, sources: 0, platform: "x", error: "X_API_ERROR", message: msg });
  }

  const seen = new Set<string>();
  hits = hits.filter((h) => h.link && h.title && !seen.has(h.link) && seen.add(h.link));
  hits.sort((a, b) => (b.date || "").localeCompare(a.date || "") || (b.engagement || 0) - (a.engagement || 0));
  hits = hits.slice(0, 120);

  const cls = await classifyAll(hits.map((h) => h.title));
  hits = hits.map((h, i) => ({ ...h, sentiment: cls[i]?.sentiment || "محايد", type: cls[i]?.type || "عام" }));
  return NextResponse.json({ hits, count: hits.length, sources: new Set(hits.map((h) => h.source)).size, platform: "x" });
}
