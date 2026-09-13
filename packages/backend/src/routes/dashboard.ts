import { Router } from "express";

import { prisma } from "../lib/prisma";
import { asyncHandler } from "../middleware/errorHandler";

export const dashboardRouter = Router();

const VENDOR_STATUSES = ["draft", "in_review", "approved", "rejected"] as const;
const TRIAGE_DECISIONS = ["pending", "relevant", "false_positive"] as const;
const KYV_REPORT_STATUSES = ["draft", "pending_checker_review", "approved", "rejected"] as const;

function countByGroup<K extends string>(
  keys: readonly K[],
  rows: { count: number; key: string }[]
): Record<K, number> {
  const base = Object.fromEntries(keys.map((k) => [k, 0])) as Record<K, number>;
  for (const row of rows) {
    if ((keys as readonly string[]).includes(row.key)) {
      base[row.key as K] = row.count;
    }
  }
  return base;
}

// Aggregate counts across every module for the home page dashboard - all
// read-only counts, run concurrently since none depend on each other.
dashboardRouter.get(
  "/stats",
  asyncHandler(async (_req, res) => {
    const [
      vendorsTotal,
      vendorsByStatusRaw,
      vendorsScreened,
      documentsTotal,
      ctosEnquiriesTotal,
      netrevealRecordsTotal,
      adverseMediaArticlesTotal,
      adverseMediaSearchesTotal,
      triageByDecisionRaw,
      kyvReportsByStatusRaw,
      knowledgeRepositoryTotal,
    ] = await Promise.all([
      prisma.vendor.count(),
      prisma.vendor.groupBy({ by: ["status"], _count: true }),
      prisma.vendor.count({
        where: { OR: [{ ctosEnquiries: { some: {} } }, { netrevealRecords: { some: {} } }] },
      }),
      prisma.document.count(),
      prisma.ctosEnquiry.count(),
      prisma.netrevealRecord.count(),
      prisma.adverseMediaArticle.count(),
      prisma.adverseMediaSearch.count(),
      prisma.riskTriageResult.groupBy({ by: ["reviewerFinalDecision"], _count: true }),
      prisma.kyvReport.groupBy({ by: ["status"], _count: true }),
      prisma.knowledgeRepositoryEntry.count(),
    ]);

    const vendorsByStatus = countByGroup(
      VENDOR_STATUSES,
      vendorsByStatusRaw.map((r) => ({ key: r.status, count: r._count }))
    );
    const triageByDecision = countByGroup(
      TRIAGE_DECISIONS,
      triageByDecisionRaw.map((r) => ({ key: r.reviewerFinalDecision, count: r._count }))
    );
    const kyvReportsByStatus = countByGroup(
      KYV_REPORT_STATUSES,
      kyvReportsByStatusRaw.map((r) => ({ key: r.status, count: r._count }))
    );
    const triageTotal = TRIAGE_DECISIONS.reduce((sum, k) => sum + triageByDecision[k], 0);
    const kyvReportsTotal = KYV_REPORT_STATUSES.reduce((sum, k) => sum + kyvReportsByStatus[k], 0);

    res.json({
      vendors: { total: vendorsTotal, byStatus: vendorsByStatus, screened: vendorsScreened },
      documents: { total: documentsTotal },
      screening: { ctosEnquiries: ctosEnquiriesTotal, netrevealRecords: netrevealRecordsTotal },
      adverseMedia: {
        articlesTotal: adverseMediaArticlesTotal,
        searchesTotal: adverseMediaSearchesTotal,
      },
      triage: { total: triageTotal, byDecision: triageByDecision },
      kyvReports: { total: kyvReportsTotal, byStatus: kyvReportsByStatus },
      knowledgeRepository: { total: knowledgeRepositoryTotal },
    });
  })
);
