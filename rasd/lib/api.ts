// Monitoring API endpoint resolver.
// If NEXT_PUBLIC_API_BASE is set (the FastAPI backend on Render), calls go there;
// otherwise they fall back to the built-in Next.js serverless routes. This makes
// the backend migration a single env-var flip with zero code change.

const BASE = process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, "") || "";

type Kind = "news" | "x" | "x-replies" | "summarize" | "youtube" | "risk" | "network" | "index" | "trends" | "discover" | "campaign" | "campaign-scan" | "new-accounts" | "sov" | "overview" | "bigdata" | "content" | "dossier" | "ingest" | "archive" | "telegram";

// FastAPI path  vs  Next.js fallback path
const MAP: Record<Kind, { fast: string; next: string }> = {
  news:        { fast: "/monitor/news",       next: "/api/monitor-fetch" },
  x:           { fast: "/monitor/x",          next: "/api/x-fetch" },
  "x-replies": { fast: "/monitor/x-replies",  next: "/api/x-replies" },
  summarize:   { fast: "/monitor/summarize",  next: "/api/summarize" },
  // risk (early-warning) + network (big-data) only exist on the FastAPI backend
  risk:        { fast: "/monitor/risk",       next: "/monitor/risk" },
  network:     { fast: "/monitor/network",    next: "/monitor/network" },
  bigdata:     { fast: "/monitor/bigdata",    next: "/monitor/bigdata" },
  index:       { fast: "/monitor/index",      next: "/monitor/index" },
  trends:      { fast: "/monitor/trends",     next: "/monitor/trends" },
  discover:    { fast: "/monitor/discover",   next: "/monitor/discover" },
  campaign:    { fast: "/monitor/campaign",   next: "/monitor/campaign" },
  "campaign-scan": { fast: "/monitor/campaign-scan", next: "/monitor/campaign-scan" },
  "new-accounts": { fast: "/monitor/new-accounts", next: "/monitor/new-accounts" },
  sov:         { fast: "/monitor/sov",        next: "/monitor/sov" },
  overview:    { fast: "/monitor/overview",   next: "/monitor/overview" },
  content:     { fast: "/monitor/content",    next: "/monitor/content" },
  dossier:     { fast: "/monitor/dossier",    next: "/monitor/dossier" },
  ingest:      { fast: "/monitor/ingest",     next: "/monitor/ingest" },
  archive:     { fast: "/monitor/archive",    next: "/monitor/archive" },
  telegram:    { fast: "/monitor/telegram",   next: "/monitor/telegram" },
  // YouTube is not on the FastAPI backend yet → always use the Next route
  youtube:     { fast: "",                    next: "/api/youtube-fetch" },
};

// ---- Intelligence API (FastAPI only, /api/intelligence/*) ----
function intelUrl(path: string): string {
  return (BASE || "") + "/api/intelligence" + path;
}

export async function intelGet(path: string): Promise<any> {
  // Attach the session JWT — harmless on open intel routes, and required by the
  // ones that are tenant-scoped (e.g. /report crisis reads the owner's picture).
  const res = await fetch(intelUrl(path), { headers: { ...(await authHeaders()) } });
  return res.json();
}

export async function intelPost(path: string, body: unknown): Promise<any> {
  const res = await fetch(intelUrl(path), {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeaders()) },
    body: JSON.stringify(body),
  });
  return res.json();
}

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

// Fire-and-forget usage event — records a real client action for the ROI / client
// success metrics. Never throws and never blocks the action it is logging.
export async function logEvent(type: string, meta: Record<string, unknown> = {}): Promise<void> {
  try {
    await fetch((BASE || "") + "/api/usage/log", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await authHeaders()) },
      body: JSON.stringify({ type, meta }),
    });
  } catch { /* ignore — logging must never disrupt UX */ }
}

// Generic GET to a backend /monitor/* path (e.g. "/monitor/status").
// Attach the Supabase session JWT so protected backend routes can verify the user.
async function authHeaders(): Promise<Record<string, string>> {
  if (typeof window === "undefined") return {};
  try {
    const { supabase } = await import("./supabaseClient");
    const { data } = await supabase.auth.getSession();
    const t = data.session?.access_token;
    return t ? { Authorization: `Bearer ${t}` } : {};
  } catch {
    return {};
  }
}

export async function apiGet(path: string): Promise<any> {
  const res = await fetch((BASE || "") + path, { headers: { ...(await authHeaders()) } });
  return res.json();
}

// Generic JSON request to any absolute backend path (settings, etc.).
export async function apiSend(path: string, method: "POST" | "PUT" | "PATCH" | "DELETE", body?: unknown): Promise<any> {
  const res = await fetch((BASE || "") + path, {
    method,
    headers: { "Content-Type": "application/json", ...(await authHeaders()) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return res.json();
}
