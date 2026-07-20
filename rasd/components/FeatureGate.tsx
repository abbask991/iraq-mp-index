"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { getMySub } from "@/lib/subscription";
import { isAdminEmail } from "@/lib/nav";
import { Icon } from "@/components/ui";
import { planAllows, FEATURE_META, minPlanAr, type FeatureKey } from "@/lib/packages";

/**
 * FeatureGate — component-level package gate. Renders its children when the tenant's
 * plan covers the feature (the main admin always passes); otherwise shows a locked
 * card with the feature name, its value, and an upgrade CTA. Fails OPEN on any
 * error (never blocks a paying user because a check hiccuped).
 */
export default function FeatureGate({ feature, children }: { feature: FeatureKey; children: React.ReactNode }) {
  const [plan, setPlan] = useState<string | null>(null);
  const [admin, setAdmin] = useState(false);

  useEffect(() => {
    getMySub().then((s) => setPlan((s?.plan as string) || "trial")).catch(() => setPlan("trial"));
    supabase.auth.getUser().then(({ data }) => setAdmin(isAdminEmail(data.user?.email))).catch(() => {});
  }, []);

  if (plan === null) return null; // resolving — don't flash a lock
  if (admin || planAllows(plan, feature)) return <>{children}</>;

  const meta = FEATURE_META[feature];
  return (
    <div className="cbox" style={{ borderStyle: "dashed", textAlign: "center" }}>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 700 }}>
        <Icon name="alert" size={15} /> {meta.name} — ميزة {minPlanAr(feature)}
      </div>
      <p className="muted" style={{ fontSize: 13, margin: "6px 0 10px" }}>{meta.value}</p>
      <Link href="/monitor/system?tab=account" className="u-btn" data-variant="primary" style={{ display: "inline-flex" }}>ترقية الباقة</Link>
    </div>
  );
}
