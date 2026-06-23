import { NextRequest, NextResponse } from "next/server";

const IRAQI = ["shafaq.com","ina.iq","baghdadtoday.news","almadapaper.net","ninanews.com",
  "mawazin.net","sotaliraq.com","basnews.com","nrttv.com","kurdistan24.net","almasalah.com",
  "alghadpress.com","964media.com","rudaw.net","alaalem.com","burathanews.com","alsharqiya.com",
  "almustakbalpaper.net"];

function unesc(s: string) {
  return s.replace(/<!\[CDATA\[|\]\]>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&").trim();
}

async function fetchTerm(term: string) {
  const site = "(" + IRAQI.map((d) => `site:${d}`).join(" OR ") + ")";
  const q = encodeURIComponent(`"${term}" ${site}`);
  const url = `https://news.google.com/rss/search?q=${q}&hl=ar&gl=IQ&ceid=IQ:ar`;
  const xml = await (await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } })).text();
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 50);
  return items.map((m) => {
    const b = m[1];
    const pick = (re: RegExp) => { const x = b.match(re); return x ? unesc(x[1]) : ""; };
    const date = pick(/<pubDate>([\s\S]*?)<\/pubDate>/);
    const dt = new Date(date);
    return {
      term,
      title: pick(/<title>([\s\S]*?)<\/title>/),
      link: pick(/<link>([\s\S]*?)<\/link>/),
      source: pick(/<source[^>]*>([\s\S]*?)<\/source>/),
      date: isNaN(dt.getTime()) ? "" : dt.toISOString().slice(0, 10),
    };
  });
}

async function classify(titles: string[]) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key || !titles.length) return null;
  const listed = titles.map((t, i) => `${i + 1}. ${t}`).join("\n");
  const prompt = `عناوين أخبار. صنّف كل عنوان. أعد JSON array فقط بنفس الترتيب (${titles.length} عنصر)، كل عنصر {"sentiment":"إيجابي|محايد|سلبي","type":"أمني/حادث|فساد/قضاء|تشريعي|رقابي|دبلوماسي/زيارة|تصريح|عام"}.\n\n${listed}`;
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

export async function POST(req: NextRequest) {
  const { keywords } = await req.json().catch(() => ({ keywords: [] }));
  if (!Array.isArray(keywords) || !keywords.length) return NextResponse.json({ hits: [] });
  let hits: any[] = [];
  for (const k of keywords.slice(0, 10)) { try { hits = hits.concat(await fetchTerm(k)); } catch {} }
  const seen = new Set<string>();
  hits = hits.filter((h) => h.link && !seen.has(h.link) && seen.add(h.link));
  hits.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  hits = hits.slice(0, 80); // cap for performance
  const cls = await classifyAll(hits.map((h) => h.title));
  hits = hits.map((h, i) => ({ ...h, sentiment: cls[i]?.sentiment || "محايد", type: cls[i]?.type || "عام" }));
  return NextResponse.json({ hits });
}
