import type { RiskTheme } from "./adverseMedia";
import type { SubjectType } from "./screening";

export const KNOWLEDGE_SOURCE_TYPES = ["kyv_report", "triage_decision"] as const;
export type KnowledgeSourceType = (typeof KNOWLEDGE_SOURCE_TYPES)[number];

export const KNOWLEDGE_DECISIONS = ["approved", "relevant", "false_positive"] as const;
export type KnowledgeDecision = (typeof KNOWLEDGE_DECISIONS)[number];

export interface KnowledgeRepositoryResult {
  id: string;
  sourceType: KnowledgeSourceType;
  sourceId: string;
  vendorId: string;
  vendorName: string;
  subjectType: SubjectType | null;
  subjectName: string | null;
  riskTheme: RiskTheme | null;
  decision: KnowledgeDecision | null;
  summaryText: string;
  indexedAt: string;
  similarity: number;
}

export interface KnowledgeRepositorySearchResponse {
  results: KnowledgeRepositoryResult[];
  ai_synthesis: string;
}

export interface KnowledgeRepositorySearchParams {
  q: string;
  riskTheme?: RiskTheme;
  decision?: KnowledgeDecision;
  subjectName?: string;
  dateFrom?: string;
  dateTo?: string;
}
