import { createClient } from "@supabase/supabase-js";

// Browser Supabase client (Phase 1 uses client-side auth via magic link).
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export type MP = {
  id: number;
  name: string;
  governorate: string | null;
  bloc: string | null;
  committee: string | null;
  role: string | null;
  photo: string | null;
  facebook: string | null;
  x: string | null;
  instagram: string | null;
  telegram: string | null;
  website: string | null;
};

export type RatingStat = { mp_id: number; n_ratings: number; avg_stars: number };
