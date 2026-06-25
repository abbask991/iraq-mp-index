// Central watchlist — the people/institutions tracked across the whole system.
// The list itself lives in the synced `monitors` table; per-entity preferences
// (type, pinned-primary, order) are kept in localStorage so no schema change is
// needed. Every section reads getTargets() so they all show the same watchlist,
// with the pinned "primary" first (that's what each section auto-loads on open).

import { supabase } from "./supabaseClient";

export type TargetType = "person" | "institution";
export type Target = {
  id: string;
  name: string;
  keywords: string[];
  type: TargetType;
  pinned: boolean;
  order: number;
};

const PREF_KEY = "rasd_target_prefs";
const FALLBACK = "محمد شياع السوداني";

type Pref = { type?: TargetType; pinned?: boolean; order?: number };

function loadPrefs(): Record<string, Pref> {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(PREF_KEY) || "{}"); } catch { return {}; }
}
function writePrefs(p: Record<string, Pref>) {
  try { localStorage.setItem(PREF_KEY, JSON.stringify(p)); } catch { /* ignore */ }
}
export function savePref(id: string, patch: Pref) {
  const p = loadPrefs(); p[id] = { ...p[id], ...patch }; writePrefs(p);
}

export async function getTargets(): Promise<Target[]> {
  const { data } = await supabase.from("monitors")
    .select("id,name,keywords").order("created_at", { ascending: true });
  const prefs = loadPrefs();
  const ts: Target[] = (data || []).map((m: any, i: number) => ({
    id: m.id, name: m.name, keywords: m.keywords || [],
    type: prefs[m.id]?.type || "person",
    pinned: !!prefs[m.id]?.pinned,
    order: prefs[m.id]?.order ?? i,
  }));
  ts.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || a.order - b.order);
  return ts;
}

export function primaryKeyword(ts: Target[]): string {
  const t = ts[0];
  return t ? (t.keywords[0] || t.name) : FALLBACK;
}

export async function addTarget(name: string, keywords: string[], type: TargetType) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("monitors")
    .insert({ owner: user.id, name, keywords }).select("id").single();
  if (data?.id) savePref(data.id, { type });
  return data?.id || null;
}

export async function removeTarget(id: string) {
  await supabase.from("monitors").delete().eq("id", id);
  const p = loadPrefs(); delete p[id]; writePrefs(p);
}

export async function setPrimary(id: string, all: Target[]) {
  // exactly one pinned primary
  const p = loadPrefs();
  for (const t of all) p[t.id] = { ...p[t.id], pinned: t.id === id };
  writePrefs(p);
}

// ---- coverage (how many tweets the Command Center scans per refresh) ----
export const COVERAGE_OPTIONS: { v: number; label: string; hint: string }[] = [
  { v: 500, label: "٥٠٠", hint: "خفيف · أسرع · أقل استهلاكاً للحصة" },
  { v: 1000, label: "١٬٠٠٠", hint: "متوازن (افتراضي)" },
  { v: 3000, label: "٣٬٠٠٠", hint: "تغطية أوسع · حصة أكبر" },
  { v: 5000, label: "٥٬٠٠٠", hint: "شامل · يستهلك حصة كبيرة · أبطأ" },
  { v: 10000, label: "١٠٬٠٠٠", hint: "أقصى تغطية · مكلف جداً وبطيء" },
];

export function getCoverage(): number {
  if (typeof window === "undefined") return 1000;
  const v = parseInt(localStorage.getItem("rasd_coverage") || "1000", 10);
  return COVERAGE_OPTIONS.some((o) => o.v === v) ? v : 1000;
}
export function setCoverage(v: number) {
  try { localStorage.setItem("rasd_coverage", String(v)); } catch { /* ignore */ }
}
