import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

// Monitor YouTube for mentions of a person/institution via the official
// YouTube Data API v3 (free). Requires a YOUTUBE_API_KEY env var. Returns the
// same hit shape as the other monitor endpoints (title/link/source/date/
// sentiment/type) plus engagement (likes+comments) and views.

async function classify(titles: string[]) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key || !titles.length) return null;
  const listed = titles.map((t, i) => `${i + 1}. ${t}`).join("\n");
  const prompt = `عناوين فيديوهات يوتيوب. صنّف كل عنوان. أعد JSON array فقط بنفس الترتيب (${titles.length} عنصر)، كل عنصر {"sentiment":"إيجابي|محايد|سلبي","type":"أمني/حادث|فساد/قضاء|تشريعي|رقابي|دبلوماسي/زيارة|تصريح|عام"}.\n\n${listed}`;
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
  const chunks: string[][] = [];
  for (let i = 0; i < titles.length; i += 25) chunks.push(titles.slice(i, i + 25));
  const results = await Promise.all(chunks.map((chunk) =>
    classify(chunk).then((r) => (r && r.length === chunk.length) ? r : chunk.map(() => ({ sentiment: "محايد", type: "عام" })))
  ));
  return results.flat();
}

async function searchYT(term: string, key: string, want: number) {
  // recent videos mentioning the term, Arabic, Iraq region; paginate to `want`
  const base = "https://www.googleapis.com/youtube/v3/search";
  const items: any[] = [];
  let page: string | undefined;
  let loops = 0;
  while (items.length < want && loops < 4) {
    const per = Math.min(50, want - items.length);
    const url = `${base}?part=snippet&type=video&order=date&relevanceLanguage=ar&regionCode=IQ` +
      `&maxResults=${per}&q=${encodeURIComponent(term)}&key=${key}` + (page ? `&pageToken=${page}` : "");
    const r = await fetch(url);
    if (!r.ok) {
      if (items.length) break;
      const body = await r.json().catch(() => ({}));
      return { error: r.status, reason: body?.error?.errors?.[0]?.reason || "" };
    }
    const j = await r.json();
    for (const it of j.items || []) {
      const s = it.snippet || {};
      items.push({
        term, _vid: it.id?.videoId,
        title: s.title,
        link: `https://www.youtube.com/watch?v=${it.id?.videoId}`,
        source: s.channelTitle || "YouTube",
        author: s.channelTitle || "",
        date: (s.publishedAt || "").slice(0, 10),
        engagement: 0, views: 0,
      });
    }
    page = j.nextPageToken;
    loops++;
    if (!page) break;
  }
  return { items };
}

async function attachStats(hits: any[], key: string) {
  // one cheap videos.list call per 50 ids → views/likes/comments
  for (let i = 0; i < hits.length; i += 50) {
    const ids = hits.slice(i, i + 50).map((h) => h._vid).filter(Boolean).join(",");
    if (!ids) continue;
    try {
      const r = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${ids}&key=${key}`);
      const j = await r.json();
      const st: Record<string, any> = {};
      for (const v of j.items || []) st[v.id] = v.statistics || {};
      for (const h of hits) {
        const s = st[h._vid];
        if (s) {
          h.views = +s.viewCount || 0;
          h.engagement = (+s.likeCount || 0) + (+s.commentCount || 0);
        }
      }
    } catch { /* keep zeros */ }
  }
}

export async function POST(req: NextRequest) {
  const { keywords, limit } = await req.json().catch(() => ({ keywords: [] }));
  if (!Array.isArray(keywords) || !keywords.length) return NextResponse.json({ hits: [] });
  const perKw = Math.min(200, Math.max(10, Number(limit) || 50));

  const key = process.env.YOUTUBE_API_KEY;
  if (!key) {
    return NextResponse.json({
      hits: [], count: 0, sources: 0, platform: "youtube",
      error: "YT_KEY_MISSING",
      message: "لتفعيل رصد يوتيوب أضِف متغيّر YOUTUBE_API_KEY (مفتاح مجاني من Google Cloud) في إعدادات المشروع.",
    });
  }

  let hits: any[] = [];
  let apiError: any = null;
  for (const k of keywords.slice(0, 5)) {
    const res = await searchYT(k, key, perKw);
    if ("error" in res) { apiError = res; continue; }
    hits = hits.concat(res.items);
  }

  if (!hits.length && apiError) {
    const msg = apiError.reason === "quotaExceeded" ? "تم تجاوز حصّة يوتيوب اليومية المجانية — جرّب غداً أو ارفع الحصّة من Google Cloud."
      : apiError.error === 400 || apiError.error === 403 ? "مفتاح يوتيوب غير صالح أو غير مفعّل — تأكد من YOUTUBE_API_KEY وتفعيل YouTube Data API v3."
      : `تعذّر الاتصال بيوتيوب (${apiError.error}).`;
    return NextResponse.json({ hits: [], count: 0, sources: 0, platform: "youtube", error: "YT_API_ERROR", message: msg });
  }

  const seen = new Set<string>();
  hits = hits.filter((h) => h.link && h.title && !seen.has(h.link) && seen.add(h.link));
  await attachStats(hits, key);
  hits.sort((a, b) => (b.date || "").localeCompare(a.date || "") || (b.engagement || 0) - (a.engagement || 0));
  hits = hits.slice(0, Math.min(200, perKw * keywords.length));

  const cls = await classifyAll(hits.map((h) => h.title));
  hits = hits.map((h, i) => {
    const { _vid, ...rest } = h;
    return { ...rest, sentiment: cls[i]?.sentiment || "محايد", type: cls[i]?.type || "عام" };
  });
  return NextResponse.json({ hits, count: hits.length, sources: new Set(hits.map((h) => h.source)).size, platform: "youtube" });
}
