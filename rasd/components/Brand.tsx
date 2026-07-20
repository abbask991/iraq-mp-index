"use client";
/**
 * Brand surfaces — every place the product identity shows. All read the tenant's
 * white-label branding via useOrg(); with no custom branding they render the
 * stock "Sentinel Intelligence" / "by Integrate Dynamics" identity unchanged.
 */
import Logo from "@/components/Logo";
import { useOrg, DEFAULT_BRAND_NAME } from "@/lib/org";

/** Logo mark — a client's custom logo_url, else the built-in vector logo. */
export function BrandLogo({ size = 24 }: { size?: number }) {
  const { logoUrl, brandName } = useOrg();
  if (logoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={logoUrl} alt={brandName} height={size} style={{ height: size, width: "auto", display: "block", objectFit: "contain" }} />;
  }
  return <Logo size={size} />;
}

/** Inline brand name for the top bar. Keeps the two-tone treatment for the
 *  default identity; a custom name renders as a single accented word group. */
export function BrandName() {
  const { brandName, isDefaultBrand } = useOrg();
  if (isDefaultBrand) {
    return (
      <span className="cb-brand">
        Sentinel<span className="cb-brand-2"> Intelligence</span>
      </span>
    );
  }
  return <span className="cb-brand cb-brand-2">{brandName}</span>;
}

/** Stacked brand + vendor block (sidebar footer). */
export function BrandStack() {
  const { brandName, vendorLine } = useOrg();
  return (
    <span className="t">
      <b>{brandName}</b>
      {vendorLine ? (
        <>
          <br />
          {vendorLine}
        </>
      ) : null}
    </span>
  );
}

/** One-line "Name by Vendor" string for report/brief footers. */
export function BrandLine() {
  const { brandName, vendorLine } = useOrg();
  return <>{vendorLine ? `${brandName} ${vendorLine}` : brandName}</>;
}

/** Just the brand name (report headers). */
export function BrandTitle() {
  const { brandName } = useOrg();
  return <>{brandName}</>;
}

export { DEFAULT_BRAND_NAME };
