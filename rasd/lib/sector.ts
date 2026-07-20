// Sector adaptation — one codebase, per-tenant framing driven by org.org_type.
// Adapts sidebar terminology and which module leads, without forking. 'general'
// is the neutral default (current wording), so an unset/synthetic org is
// unchanged.

export type OrgType = "general" | "media" | "corporate" | "government" | "political";

export const ORG_TYPES: { key: OrgType; ar: string }[] = [
  { key: "general", ar: "عام" },
  { key: "media", ar: "إعلام" },
  { key: "corporate", ar: "شركات / علامة تجارية" },
  { key: "government", ar: "حكومي / سيادي" },
  { key: "political", ar: "سياسي / انتخابي" },
];

export const ORG_TYPE_AR: Record<string, string> =
  Object.fromEntries(ORG_TYPES.map((t) => [t.key, t.ar]));

type Sector = {
  /** Which nav group leads for this sector (opened + surfaced first). */
  primaryGroup: string;
  /** Per-group Arabic label overrides (keyed by NavGroup.key). */
  groupLabels: Record<string, string>;
  /** The word this sector uses for a monitored subject. */
  entityNoun: string;
};

const SECTORS: Record<OrgType, Sector> = {
  general: {
    primaryGroup: "ops",
    groupLabels: {},
    entityNoun: "الكيانات",
  },
  media: {
    primaryGroup: "media",
    groupLabels: {
      entities: "الجهات والمؤثّرون",
      media: "الرصد الإعلامي",
    },
    entityNoun: "الجهات",
  },
  corporate: {
    primaryGroup: "corporate",
    groupLabels: {
      entities: "العلامات والمنافسون",
      corporate: "استخبارات العلامة والسوق",
      risk: "مخاطر السمعة والأزمات",
    },
    entityNoun: "العلامات",
  },
  government: {
    primaryGroup: "risk",
    groupLabels: {
      entities: "الجهات والملفّات",
      risk: "الإنذار المبكر والاستقرار",
    },
    entityNoun: "الملفّات",
  },
  political: {
    primaryGroup: "entities",
    groupLabels: {
      entities: "المرشّحون والتأثير",
      narratives: "السرديات والمعركة الانتخابية",
    },
    entityNoun: "المرشّحون",
  },
};

export function sector(orgType?: string | null): Sector {
  return SECTORS[(orgType as OrgType)] || SECTORS.general;
}

/** Apply a sector's terminology + lead-module emphasis to nav groups.
 *  Pure: returns a new array; unknown/general org types return the input as-is. */
export function applySector<T extends { key: string; ar: string; defaultOpen?: boolean }>(
  groups: T[],
  orgType?: string | null,
): T[] {
  const s = sector(orgType);
  return groups.map((g) => ({
    ...g,
    ar: s.groupLabels[g.key] || g.ar,
    defaultOpen: g.key === s.primaryGroup ? true : g.defaultOpen,
  }));
}
