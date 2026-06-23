import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 45;

// Fetch and analyze the REPLIES (comments) on a given tweet, via the X API v2
// recent-search `conversation_id:<id> is:reply` query. Returns each reply with
// AI sentiment plus an aggregate breakdown — i.e. how the public reacted.

async function classify(titles: string[]) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key || !titles.length) return null;
  const listed = titles.map((t, i) => `${i + 1}. ${t}`).join("\n");
  const prompt = `ردود/تعليقات على تغريدة. صنّف نبرة كل تعليق تجاه موضوعه. أعد JSON array فقط بنفس الترتيب (${titles.length} عنصر)، كل عنصر {"sentiment":"إيجابي|محايد|سلبي"}.\n\n${listed}`;
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 1500, messages: [{ role: "user", content: prompt }] }),
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
    classify(chunk).then((r) => (r && r.length === chunk.length) ? r : chunk.map(() => ({ sentiment: "محايد" })))
  ));
  return results.flat();
}

export async function POST(req: NextRequest) {
  const { tweetId, limit } = await req.json().catch(() => ({}));
  const token = process.env.X_BEARER_TOKEN;
  if (!token) return NextResponse.json({ replies: [], error: "X_TOKEN_MISSING" });
  if (!tweetId) return NextResponse.json({ replies: [] });
  const want = Math.min(100, Math.max(10, Number(limit) || 60));

  const fields = "tweet.fields=created_at,public_metrics&expansions=author_id&user.fields=username,name";
  const q = encodeURIComponent(`conversation_id:${tweetId} is:reply`);
  const replies: any[] = [];
  let next: string | undefined;
  let loops = 0;
  try {
    while (replies.length < want && loops < 3) {
      const per = Math.min(100, want - replies.length);
      const url = `https://api.twitter.com/2/tweets/search/recent?query=${q}&max_results=${per}&${fields}` +
        (next ? `&next_token=${next}` : "");
      const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) {
        if (replies.length) break;
        return NextResponse.json({ replies: [], error: "X_API_ERROR", status: r.status });
      }
      const j = await r.json();
      const users: Record<string, any> = {};
      for (const u of j.includes?.users || []) users[u.id] = u;
      for (const t of j.data || []) {
        const u = users[t.author_id] || {};
        const m = t.public_metrics || {};
        replies.push({
          text: t.text,
          author: u.name || u.username || "",
          source: u.username ? `@${u.username}` : "",
          date: (t.created_at || "").slice(0, 10),
          engagement: (m.like_count || 0) + (m.reply_count || 0),
          link: u.username ? `https://x.com/${u.username}/status/${t.id}` : "",
        });
      }
      next = j.meta?.next_token;
      loops++;
      if (!next) break;
    }
  } catch {
    return NextResponse.json({ replies: [], error: "X_API_ERROR" });
  }

  const cls = await classifyAll(replies.map((x) => x.text));
  replies.forEach((x, i) => (x.sentiment = cls[i]?.sentiment || "محايد"));
  const neg = replies.filter((x) => x.sentiment === "سلبي").length;
  const pos = replies.filter((x) => x.sentiment === "إيجابي").length;
  replies.sort((a, b) => (b.engagement || 0) - (a.engagement || 0));
  return NextResponse.json({ replies, count: replies.length, pos, neg, neu: replies.length - pos - neg });
}
