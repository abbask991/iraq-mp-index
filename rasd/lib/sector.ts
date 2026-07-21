// Sector adaptation — one codebase, per-tenant framing driven by org.org_type.
// Adapts sidebar terminology and which module leads, without forking. 'general'
// is the neutral default (current wording), so an unset/synthetic org is
// unchanged.

export type OrgType =
  | "general" | "government" | "ministry" | "security_institution" | "embassy"
  | "international_organization" | "corporate" | "research_center"
  | "political_actor" | "media_organization" | "investor" | "other"
  // legacy short values kept so existing orgs keep resolving
  | "media" | "political";

export const ORG_TYPES: { key: OrgType; ar: string }[] = [
  { key: "general", ar: "عام" },
  { key: "government", ar: "حكومي / سيادي" },
  { key: "ministry", ar: "وزارة" },
  { key: "security_institution", ar: "مؤسسة أمنية" },
  { key: "embassy", ar: "سفارة / بعثة" },
  { key: "international_organization", ar: "منظمة دولية" },
  { key: "corporate", ar: "شركات / علامة تجارية" },
  { key: "research_center", ar: "مركز أبحاث" },
  { key: "political_actor", ar: "سياسي / انتخابي" },
  { key: "media_organization", ar: "إعلام" },
  { key: "investor", ar: "مستثمر" },
  { key: "other", ar: "أخرى" },
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

const GENERAL: Sector = { primaryGroup: "ops", groupLabels: {}, entityNoun: "الكيانات" };
const MEDIA: Sector = {
  primaryGroup: "media",
  groupLabels: { entities: "الجهات والمؤثّرون", media: "الرصد الإعلامي" },
  entityNoun: "الجهات",
};
const CORPORATE: Sector = {
  primaryGroup: "corporate",
  groupLabels: {
    entities: "العلامات والمنافسون",
    corporate: "استخبارات العلامة والسوق",
    risk: "مخاطر السمعة والأزمات",
  },
  entityNoun: "العلامات",
};
const GOVERNMENT: Sector = {
  primaryGroup: "risk",
  groupLabels: { entities: "الجهات والملفّات", risk: "الإنذار المبكر والاستقرار" },
  entityNoun: "الملفّات",
};
const POLITICAL: Sector = {
  primaryGroup: "entities",
  groupLabels: { entities: "المرشّحون والتأثير", narratives: "السرديات والمعركة الانتخابية" },
  entityNoun: "المرشّحون",
};

const SECTORS: Partial<Record<OrgType, Sector>> = {
  general: GENERAL,
  other: GENERAL,
  media: MEDIA,
  media_organization: MEDIA,
  corporate: CORPORATE,
  government: GOVERNMENT,
  political: POLITICAL,
  political_actor: POLITICAL,
  ministry: {
    primaryGroup: "risk",
    groupLabels: { entities: "الجهات والملفّات", risk: "شكاوى الخدمات والإنذار المبكر" },
    entityNoun: "الملفّات",
  },
  security_institution: {
    primaryGroup: "risk",
    groupLabels: { entities: "الجهات والأهداف", risk: "التهديدات والإنذار المبكر" },
    entityNoun: "الأهداف",
  },
  embassy: {
    primaryGroup: "entities",
    groupLabels: { entities: "الدول والجهات", risk: "المخاطر السياسية والأمنية" },
    entityNoun: "الجهات",
  },
  international_organization: {
    primaryGroup: "analysis",
    groupLabels: { entities: "القضايا والجهات", risk: "المخاطر الإقليمية" },
    entityNoun: "القضايا",
  },
  research_center: {
    primaryGroup: "analysis",
    groupLabels: { entities: "الكيانات والملفّات", analysis: "مختبر التحليل والأبحاث" },
    entityNoun: "الكيانات",
  },
  investor: {
    primaryGroup: "corporate",
    groupLabels: { entities: "الأسواق والجهات", risk: "مخاطر الدولة والسوق", corporate: "استخبارات السوق" },
    entityNoun: "الجهات",
  },
};

export function sector(orgType?: string | null): Sector {
  return SECTORS[(orgType as OrgType)] || GENERAL;
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
