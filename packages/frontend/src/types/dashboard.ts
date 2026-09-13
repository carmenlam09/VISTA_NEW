export interface DashboardStats {
  vendors: {
    total: number;
    byStatus: { draft: number; in_review: number; approved: number; rejected: number };
    screened: number;
  };
  documents: { total: number };
  screening: { ctosEnquiries: number; netrevealRecords: number };
  adverseMedia: { articlesTotal: number; searchesTotal: number };
  triage: {
    total: number;
    byDecision: { pending: number; relevant: number; false_positive: number };
  };
  kyvReports: {
    total: number;
    byStatus: {
      draft: number;
      pending_checker_review: number;
      approved: number;
      rejected: number;
    };
  };
  knowledgeRepository: { total: number };
}
