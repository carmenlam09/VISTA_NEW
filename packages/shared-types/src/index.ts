// Shared types for the VISTA app shell. Module-specific domain types
// (vendors, documents, extraction results, etc.) are added when each
// module's backend/frontend work begins.

export const MODULE_SLUGS = [
  "intake",
  "screening",
  "adverse-media",
  "triage",
  "kyv-report",
  "knowledge-repository",
] as const;

export type ModuleSlug = (typeof MODULE_SLUGS)[number];

export interface ModuleDefinition {
  slug: ModuleSlug;
  label: string;
  /** Module number per the VISTA spec (Module 6/7 are merged into one Knowledge Repository tab). */
  moduleNumber: string;
  implemented: boolean;
}

export const MODULES: ModuleDefinition[] = [
  { slug: "intake", label: "Intake & Extraction", moduleNumber: "1", implemented: true },
  { slug: "screening", label: "Screening Intelligence", moduleNumber: "2", implemented: true },
  { slug: "adverse-media", label: "Adverse Media", moduleNumber: "3", implemented: true },
  { slug: "triage", label: "Triage", moduleNumber: "4", implemented: true },
  { slug: "kyv-report", label: "KYV Report", moduleNumber: "5", implemented: true },
  { slug: "knowledge-repository", label: "Knowledge Repository", moduleNumber: "6", implemented: true },
];
