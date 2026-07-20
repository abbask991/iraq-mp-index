"use client";
/**
 * OrgProvider — the signed-in tenant's org + white-label branding, fetched once
 * and shared across the console. Every brand surface (sidebar, report footers)
 * reads from here so a client's `branding` jsonb ({ name, logo_url, primary,
 * hide_vendor }) drives the UI. When branding is empty (synthetic org / not set)
 * the DEFAULTS below reproduce the stock "Sentinel Intelligence by Integrate
 * Dynamics" identity exactly, so nothing changes visually until a client is
 * actually white-labelled.
 */
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { apiGet } from "@/lib/api";

export const DEFAULT_BRAND_NAME = "Sentinel Intelligence";
export const DEFAULT_VENDOR = "Integrate Dynamics";

type Branding = {
  name?: string;
  logo_url?: string;
  primary?: string;
  hide_vendor?: boolean;
};

type Org = {
  id: string;
  name?: string;
  plan?: string;
  org_type?: string;
  branding?: Branding;
  status?: string;
  synthetic?: boolean;
};

export type OrgCtx = {
  ready: boolean;
  org: Org | null;
  role: string;
  /** Full brand name to display (custom or the default). */
  brandName: string;
  /** True when the org has NOT set a custom brand name — lets surfaces render
   *  the stock two-tone "Sentinel Intelligence" treatment. */
  isDefaultBrand: boolean;
  /** "by Integrate Dynamics", or "" when the client hides the vendor. */
  vendorLine: string;
  /** Custom brand accent (hex) or null. */
  primary: string | null;
  /** Custom logo URL or null (null → use the built-in <Logo/>). */
  logoUrl: string | null;
  /** Sector — drives terminology + lead module. "general" = neutral default. */
  orgType: string;
};

const DEFAULT_CTX: OrgCtx = {
  ready: false,
  org: null,
  role: "member",
  brandName: DEFAULT_BRAND_NAME,
  isDefaultBrand: true,
  vendorLine: `by ${DEFAULT_VENDOR}`,
  primary: null,
  logoUrl: null,
  orgType: "general",
};

const Ctx = createContext<OrgCtx>(DEFAULT_CTX);

function derive(org: Org | null, role: string): OrgCtx {
  const b = org?.branding || {};
  const customName = (b.name || "").trim();
  return {
    ready: true,
    org,
    role,
    brandName: customName || DEFAULT_BRAND_NAME,
    isDefaultBrand: !customName,
    vendorLine: b.hide_vendor ? "" : `by ${DEFAULT_VENDOR}`,
    primary: (b.primary || "").trim() || null,
    logoUrl: (b.logo_url || "").trim() || null,
    orgType: (org?.org_type || "general").trim() || "general",
  };
}

export function OrgProvider({ children }: { children: ReactNode }) {
  const [ctx, setCtx] = useState<OrgCtx>(DEFAULT_CTX);

  useEffect(() => {
    let alive = true;
    apiGet("/api/orgs/me")
      .then((r) => {
        if (!alive) return;
        setCtx(derive(r?.org ?? null, r?.role || "member"));
      })
      .catch(() => {
        // On failure keep the stock brand — never blank the UI.
        if (alive) setCtx((c) => ({ ...c, ready: true }));
      });
    return () => {
      alive = false;
    };
  }, []);

  // Drive the app accent from the client's brand colour when set. These are the
  // two vars the whole design system reads (globals.css), so one override
  // white-labels every accent without touching component styles.
  useEffect(() => {
    const root = document.documentElement;
    if (ctx.primary) {
      root.style.setProperty("--accent2", ctx.primary);
      root.style.setProperty("--brand", ctx.primary);
    } else {
      root.style.removeProperty("--brand");
    }
  }, [ctx.primary]);

  return <Ctx.Provider value={ctx}>{children}</Ctx.Provider>;
}

export function useOrg(): OrgCtx {
  return useContext(Ctx);
}

export type HostBrand = {
  name: string;
  isDefaultBrand: boolean;
  vendorLine: string;
  primary: string | null;
  logoUrl: string | null;
  orgType: string;
};

/** Resolve white-label branding from the current hostname — public, no auth,
 *  so the LOGIN page (outside OrgProvider) can render a client's brand before
 *  sign-in. Returns null on the platform's own hosts / unmapped domains, so the
 *  caller keeps the default identity. */
export async function fetchHostBrand(): Promise<HostBrand | null> {
  try {
    const host = typeof window !== "undefined" ? window.location.hostname : "";
    const r = await apiGet(`/api/orgs/by-host?host=${encodeURIComponent(host)}`);
    if (!r?.found) return null;
    const b: Branding = r.branding || {};
    const customName = (b.name || "").trim();
    return {
      name: customName || DEFAULT_BRAND_NAME,
      isDefaultBrand: !customName,
      vendorLine: b.hide_vendor ? "" : `by ${DEFAULT_VENDOR}`,
      primary: (b.primary || "").trim() || null,
      logoUrl: (b.logo_url || "").trim() || null,
      orgType: (r.org_type || "general").trim() || "general",
    };
  } catch {
    return null;
  }
}
