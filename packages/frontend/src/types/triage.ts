import type { SubjectType } from "./screening";

export const SOURCE_TYPES = ["netreveal", "ctos_legal_case", "adverse_media"] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

export const SOURCE_TYPE_LABELS: Record<SourceType, string> = {
  netreveal: "NetReveal",
  ctos_legal_case: "CTOS Legal Case",
  adverse_media: "Adverse Media",
};

export const SUGGESTED_DECISIONS = ["relevant", "false_positive", "needs_review"] as const;
export type SuggestedDecision = (typeof SUGGESTED_DECISIONS)[number];

export type TriageDecision = "pending" | "relevant" | "false_positive";

export interface RiskTriageResult {
  id: string;
  vendorId: string;
  sourceType: SourceType;
  sourceRecordId: string;
  subjectType: SubjectType;
  subjectName: string;
  confidenceScore: string; // Prisma Decimal serialized as string
  aiRationale: string;
  suggestedDecision: SuggestedDecision;
  reviewerFinalDecision: TriageDecision;
  reviewedById: string | null;
  reviewedAt: string | null;
  triagedAt: string;
}

export interface TriageRunSummary {
  triagedCount: number;
  skippedCount: number;
  results: RiskTriageResult[];
}
