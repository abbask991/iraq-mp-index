import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

const IRAQI = [
  "shafaq.com", "ina.iq", "baghdadtoday.news", "almadapaper.net", "ninanews.com", "mawazin.net",
  "sotaliraq.com", "basnews.com", "nrttv.com", "kurdistan24.net", "almasalah.com", "alghadpress.com",
  "964media.com", "rudaw.net", "alaalem.com", "burathanews.com", "alsharqiya.com", "almustakbalpaper.net",
  "alsabaah.iq", "imn.iq", "almothaqaf.com", "alrabiaa.tv", "ultrairaq.ultrasawt.com", "altaghier.tv",
  "shafaqna.com", "ishtartv.com",
  "aljazeera.net", "alarabiya.net", "aawsat.com", "youm7.com", "alquds.co.uk", "al-ain.com",
  "arabic.rt.com", "skynewsarabia.com", "arabi21.com", "almayadeen.net", "independentarabia.com",
  "france24.com", "dw.com", "alhurra.com", "alkhaleejonline.net", "alquds.com", "aljarida.com",
  "akhbaralaan.net", "alaraby.co.uk"];

function unesc(s: string) {
  return s.replace(/<!\[CDATA\[|\]\]>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&").trim();
}

function parseItems(xml: string, term: string, limit: number) {
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, limit);
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

async function fetchOne(term: string, domain: string) {
  const q = encodeURIComponent(`"${term}" site:${domain}`);
  const url = `https://news.google.com/rss/search?q=${q}&hl=ar&gl=IQ&ceid=IQ:ar`;
  // cap each source at 6s so one slow/hanging site can't drag the whole request
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 6000);
  try {
    const xml = await (await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, signal: ac.signal })).text();
    return parseItems(xml, term, 12);
  } catch { return []; }
  finally { clearTimeout(timer); }
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
  // batches of 25, run ALL batches in parallel (was sequential → main slowdown)
  const chunks: string[][] = [];
  for (let i = 0; i < titles.length; i += 25) chunks.push(titles.slice(i, i + 25));
  const results = await Promise.all(chunks.map((chunk) =>
    classify(chunk).then((r) => (r && r.length === chunk.length) ? r : chunk.map(() => ({ sentiment: "محايد", type: "عام" })))
  ));
  return results.flat();
}

export async function POST(req: NextRequest) {
  const { keywords } = await req.json().catch(() => ({ keywords: [] }));
  if (!Array.isArray(keywords) || !keywords.length) return NextResponse.json({ hits: [] });

  // query EACH Iraqi source separately (forces diversity & depth), in parallel chunks
  const jobs: (() => Promise<any[]>)[] = [];
  for (const k of keywords.slice(0, 6)) for (const d of IRAQI) jobs.push(() => fetchOne(k, d));
  let hits: any[] = [];
  for (let i = 0; i < jobs.length; i += 45) {
    const batch = await Promise.all(jobs.slice(i, i + 45).map((f) => f()));
    hits = hits.concat(...batch);
  }

  const seen = new Set<string>();
  hits = hits.filter((h) => h.link && h.title && !seen.has(h.link) && seen.add(h.link));
  hits.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  hits = hits.slice(0, 120);

  const cls = await classifyAll(hits.map((h) => h.title));
  hits = hits.map((h, i) => ({ ...h, sentiment: cls[i]?.sentiment || "محايد", type: cls[i]?.type || "عام" }));
  return NextResponse.json({ hits, count: hits.length, sources: new Set(hits.map((h) => h.source)).size });
}
