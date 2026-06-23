import { supabase } from "./supabaseClient";

export type Sub = {
  user_id: string;
  email: string | null;
  company: string | null;
  plan: "trial" | "basic" | "pro" | "enterprise";
  status: "active" | "pending" | "expired" | "disabled";
  expires_at: string | null;
  note: string | null;
};

export const PLAN_LABEL: Record<string, string> = {
  trial: "تجريبي",
  basic: "أساسي",
  pro: "احترافي",
  enterprise: "مؤسّسي",
};

/** The signed-in user's subscription (null if not signed in / none). */
export async function getMySub(): Promise<Sub | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("subscriptions").select("*").eq("user_id", user.id).maybeSingle();
  return (data as Sub) ?? null;
}

/** Active = status 'active' AND not past expiry. */
export function isActive(sub: Sub | null): boolean {
  if (!sub || sub.status !== "active") return false;
  if (sub.expires_at && new Date(sub.expires_at).getTime() < Date.now()) return false;
  return true;
}

/** Days left until expiry (null = unlimited). */
export function daysLeft(sub: Sub | null): number | null {
  if (!sub?.expires_at) return null;
  return Math.ceil((new Date(sub.expires_at).getTime() - Date.now()) / 86400000);
}
