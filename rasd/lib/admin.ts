import { supabase } from "./supabaseClient";

/** Is the signed-in user an admin? */
export async function isAdmin(): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await supabase.from("profiles").select("is_admin").eq("id", user.id).maybeSingle();
  return !!data?.is_admin;
}

/** Read a settings key (returns an array). */
export async function getSetting(key: string): Promise<string[]> {
  const { data } = await supabase.from("app_settings").select("value").eq("key", key).maybeSingle();
  return Array.isArray(data?.value) ? (data!.value as string[]) : [];
}

/** Write a settings key (admin only — enforced by RLS). */
export async function setSetting(key: string, value: string[]): Promise<string | null> {
  const { error } = await supabase.from("app_settings")
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
  return error ? error.message : null;
}
