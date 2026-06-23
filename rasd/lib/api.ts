// Monitoring API endpoint resolver.
// If NEXT_PUBLIC_API_BASE is set (the FastAPI backend on Render), calls go there;
// otherwise they fall back to the built-in Next.js serverless routes. This makes
// the backend migration a single env-var flip with zero code change.

const BASE = process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, "") || "";

type Kind = "news" | "x" | "x-replies" | "summarize" | "youtube" | "risk" | "network" | "index";

// FastAPI path  vs  Next.js fallback path
const MAP: Record<Kind, { fast: string; next: string }> = {
  news:        { fast: "/monitor/news",       next: "/api/monitor-fetch" },
  x:           { fast: "/monitor/x",          next: "/api/x-fetch" },
  "x-replies": { fast: "/monitor/x-replies",  next: "/api/x-replies" },
  summarize:   { fast: "/monitor/summarize",  next: "/api/summarize" },
  // risk (early-warning) + network (big-data) only exist on the FastAPI backend
  risk:        { fast: "/monitor/risk",       next: "/monitor/risk" },
  network:     { fast: "/monitor/network",    next: "/monitor/network" },
  index:       { fast: "/monitor/index",      next: "/monitor/index" },
  // YouTube is not on the FastAPI backend yet → always use the Next route
  youtube:     { fast: "",                    next: "/api/youtube-fetch" },
};

export function apiUrl(kind: Kind): string {
  const m = MAP[kind];
  return BASE && m.fast ? BASE + m.fast : m.next;
}

export async function apiPost(kind: Kind, body: unknown): Promise<any> {
  const res = await fetch(apiUrl(kind), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}
