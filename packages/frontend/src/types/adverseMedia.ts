import type { SubjectType } from "./screening";

export const RISK_THEMES = [
  "financial_crime",
  "sanctions",
  "fraud",
  "regulatory_breach",
  "tax_offence",
  "esg",
  "operational_risk",
  "other",
] as const;
export type RiskTheme = (typeof RISK_THEMES)[number];

export const RISK_THEME_LABELS: Record<RiskTheme, string> = {
  financial_crime: "Financial Crime",
  sanctions: "Sanctions",
  fraud: "Fraud",
  regulatory_breach: "Regulatory Breach",
  tax_offence: "Tax Offence",
  esg: "ESG",
  operational_risk: "Operational Risk",
  other: "Other",
};

export interface AdverseMediaKeyword {
  id: string;
  keyword: string;
  riskTheme: RiskTheme;
  isActive: boolean;
  createdAt: string;
}

export interface AdverseMediaSearchRun {
  id: string;
  vendorId: string;
  subjectType: SubjectType;
  subjectName: string;
  relatedDirectorId: string | null;
  relatedShareholderId: string | null;
  keywordsUsed: string[];
  searchStatus: "pending" | "completed" | "failed";
  searchedById: string | null;
  searchedAt: string;
  _count?: { articles: number };
  articles?: AdverseMediaArticle[];
}

export type ReviewerDecision = "pending" | "relevant" | "false_positive";

export interface AdverseMediaArticle {
  id: string;
  searchId: string;
  vendorId: string;
  articleTitle: string;
  articleUrl: string;
  sourceDomain: string | null;
  publishedDate: string | null;
  riskTheme: RiskTheme;
  aiSummary: string;
  reviewerDecision: ReviewerDecision;
  reviewedById: string | null;
  reviewedAt: string | null;
  createdAt: string;
  search?: {
    id: string;
    subjectType: SubjectType;
    subjectName: string;
    searchedAt: string;
  };
}
