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

// ---------------------------------------------------------------------------
// Dashboard overview - trends, derived vendor risk, and the alert queue.
// ---------------------------------------------------------------------------
//
// RISK SCORING METHODOLOGY - read before trusting any number this produces.
//
// This is a transparent, rule-based composite derived entirely from Module 4
// triage output. It is NOT a validated bank risk model, and it is not
// calibrated against any real loss data - it exists so the dashboard can rank
// and group vendors by the evidence VISTA has actually collected. Replace it
// with the bank's own model before this is used for real credit or onboarding
// decisions. Every input is a real stored record; nothing here is synthesized.
//
// Each triage finding contributes `confidenceScore x weight` points, where the
// weight reflects how settled the finding is:
//
//   reviewer confirmed "relevant"        1.0  - a human stands behind it
//   pending, AI suggested "relevant"     0.5  - credible but unreviewed
//   pending, AI said "needs_review"      0.3  - ambiguous, unreviewed
//   reviewer marked "false_positive"     0.0  - explicitly cleared
//
// The sum is divided by SCORE_DIVISOR and capped at 100, so roughly two
// confirmed high-confidence findings put a vendor in the High band.
const RISK_WEIGHTS = {
  confirmedRelevant: 1.0,
  pendingSuggestedRelevant: 0.5,
  pendingNeedsReview: 0.3,
  falsePositive: 0,
} as const;
const SCORE_DIVISOR = 2;
const HIGH_RISK_MIN = 70;
const MEDIUM_RISK_MIN = 40;

export type RiskTier = "high" | "medium" | "low" | "unassessed";

function tierFor(score: number, hasFindings: boolean): RiskTier {
  // A vendor nobody has screened is not low risk - it is unknown risk. Folding
  // those into "low" would let an unscreened vendor look safe, which is the
  // exact failure mode a KYV dashboard has to avoid.
  if (!hasFindings) return "unassessed";
  if (score >= HIGH_RISK_MIN) return "high";
  if (score >= MEDIUM_RISK_MIN) return "medium";
  return "low";
}

function weightFor(finding: { reviewerFinalDecision: string; suggestedDecision: string }): number {
  if (finding.reviewerFinalDecision === "relevant") return RISK_WEIGHTS.confirmedRelevant;
  if (finding.reviewerFinalDecision === "false_positive") return RISK_WEIGHTS.falsePositive;
  if (finding.suggestedDecision === "relevant") return RISK_WEIGHTS.pendingSuggestedRelevant;
  if (finding.suggestedDecision === "needs_review") return RISK_WEIGHTS.pendingNeedsReview;
  return 0;
}

const MONTHS_OF_HISTORY = 6;

/** Start-of-month boundaries, oldest first, covering MONTHS_OF_HISTORY. */
function monthBoundaries(): Date[] {
  const out: Date[] = [];
  for (let back = MONTHS_OF_HISTORY - 1; back >= 0; back--) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(1);
    d.setMonth(d.getMonth() - back);
    out.push(d);
  }
  return out;
}

/** Running total of `dates` as at the end of each month bucket. */
function cumulativeByMonth(dates: Date[], buckets: Date[]): number[] {
  return buckets.map((_, i) => {
    const end = i + 1 < buckets.length ? buckets[i + 1] : null;
    return dates.filter((d) => (end ? d < end : true)).length;
  });
}

/** Per-month (non-cumulative) counts, for queue/workload style metrics. */
function perMonth(dates: Date[], buckets: Date[]): number[] {
  return buckets.map((start, i) => {
    const end = i + 1 < buckets.length ? buckets[i + 1] : null;
    return dates.filter((d) => d >= start && (end ? d < end : true)).length;
  });
}

/**
 * Percent change between the final two buckets. Returns null rather than a
 * fake 0% or 100% when the prior period was empty - "up 100%" from a base of
 * zero would be meaningless, and the UI omits the delta instead.
 */
function deltaPct(series: number[]): number | null {
  if (series.length < 2) return null;
  const prev = series[series.length - 2];
  const curr = series[series.length - 1];
  if (prev === 0) return null;
  return Math.round(((curr - prev) / prev) * 100);
}

dashboardRouter.get(
  "/overview",
  asyncHandler(async (_req, res) => {
    const buckets = monthBoundaries();
    const windowStart = buckets[0];

    const [vendors, screeningEnquiries, screeningNetreveal, triageFindings, reports, articles] =
      await Promise.all([
        prisma.vendor.findMany({ select: { id: true, companyName: true, status: true, createdAt: true } }),
        prisma.ctosEnquiry.findMany({ select: { vendorId: true, createdAt: true } }),
        // NetReveal stamps searchedAt rather than createdAt; normalized below.
        prisma.netrevealRecord.findMany({ select: { vendorId: true, searchedAt: true } }),
        prisma.riskTriageResult.findMany({
          select: {
            id: true,
            vendorId: true,
            subjectName: true,
            sourceType: true,
            confidenceScore: true,
            suggestedDecision: true,
            reviewerFinalDecision: true,
            triagedAt: true,
          },
        }),
        prisma.kyvReport.findMany({
          select: { id: true, vendorId: true, status: true, generatedAt: true, reviewedAt: true },
        }),
        prisma.adverseMediaArticle.findMany({
          select: { id: true, vendorId: true, articleTitle: true, reviewerDecision: true, createdAt: true },
        }),
      ]);

    const vendorNameById = new Map(vendors.map((v) => [v.id, v.companyName]));

    // ---- Per-vendor risk, from triage findings only -----------------------
    const findingsByVendor = new Map<string, typeof triageFindings>();
    for (const f of triageFindings) {
      const list = findingsByVendor.get(f.vendorId);
      if (list) list.push(f);
      else findingsByVendor.set(f.vendorId, [f]);
    }

    const byVendor = vendors.map((v) => {
      const findings = findingsByVendor.get(v.id) ?? [];
      const raw = findings.reduce(
        (sum, f) => sum + Number(f.confidenceScore) * weightFor(f),
        0
      );
      const score = Math.min(100, Math.round(raw / SCORE_DIVISOR));
      return {
        vendorId: v.id,
        companyName: v.companyName,
        status: v.status,
        createdAt: v.createdAt,
        score: findings.length > 0 ? score : null,
        tier: tierFor(score, findings.length > 0),
        findingCount: findings.length,
        openFindingCount: findings.filter((f) => f.reviewerFinalDecision === "pending").length,
      };
    });

    const distribution = { high: 0, medium: 0, low: 0, unassessed: 0 };
    for (const v of byVendor) distribution[v.tier]++;

    // Portfolio posture is the mean of the vendors that actually have
    // findings - averaging in unassessed vendors as zero would understate it.
    const scored = byVendor.filter((v) => v.score !== null);
    const portfolioScore =
      scored.length > 0
        ? Math.round(scored.reduce((s, v) => s + (v.score as number), 0) / scored.length)
        : null;

    // ---- KPI series --------------------------------------------------------
    // First-screening date per vendor, so "screened" counts distinct vendors
    // over time rather than raw screening records.
    const firstScreenedAt = new Map<string, Date>();
    const screeningEvents = [
      ...screeningEnquiries.map((r) => ({ vendorId: r.vendorId, at: r.createdAt })),
      ...screeningNetreveal.map((r) => ({ vendorId: r.vendorId, at: r.searchedAt })),
    ];
    for (const row of screeningEvents) {
      const existing = firstScreenedAt.get(row.vendorId);
      if (!existing || row.at < existing) firstScreenedAt.set(row.vendorId, row.at);
    }

    const vendorSeries = cumulativeByMonth(vendors.map((v) => v.createdAt), buckets);
    const screenedSeries = cumulativeByMonth([...firstScreenedAt.values()], buckets);
    // Triage is a queue, not a running total, so this shows findings triaged
    // per month (workload) while the headline number is the live pending count.
    const triageSeries = perMonth(triageFindings.map((f) => f.triagedAt), buckets);
    // Dated by when the checker actually signed off, falling back to
    // generation for older rows that predate reviewedAt being populated.
    const approvedSeries = cumulativeByMonth(
      reports.filter((r) => r.status === "approved").map((r) => r.reviewedAt ?? r.generatedAt),
      buckets
    );

    // ---- Alerts ------------------------------------------------------------
    // Real records only, each carrying its own stored timestamp.
    const alerts = [
      ...triageFindings
        .filter((f) => f.reviewerFinalDecision === "pending" && Number(f.confidenceScore) >= HIGH_RISK_MIN)
        .map((f) => ({
          id: `triage:${f.id}`,
          severity: "high" as const,
          title: "High-confidence risk finding awaiting triage",
          detail: `${f.subjectName} · ${vendorNameById.get(f.vendorId) ?? "Unknown vendor"}`,
          at: f.triagedAt,
        })),
      ...articles
        .filter((a) => a.reviewerDecision === "pending")
        .map((a) => ({
          id: `article:${a.id}`,
          severity: "medium" as const,
          title: "Adverse media article pending review",
          detail: `${a.articleTitle.slice(0, 80)} · ${vendorNameById.get(a.vendorId) ?? "Unknown vendor"}`,
          at: a.createdAt,
        })),
      ...reports
        .filter((r) => r.status === "pending_checker_review")
        .map((r) => ({
          id: `report:${r.id}`,
          severity: "low" as const,
          title: "KYV report awaiting checker review",
          detail: `Maker-checker sign-off outstanding · ${vendorNameById.get(r.vendorId) ?? "Unknown vendor"}`,
          at: r.generatedAt,
        })),
    ]
      .sort((a, b) => b.at.getTime() - a.at.getTime())
      .slice(0, 6);

    res.json({
      generatedAt: new Date().toISOString(),
      windowStart: windowStart.toISOString(),
      months: buckets.map((b) => b.toISOString()),
      kpis: {
        totalVendors: {
          value: vendors.length,
          series: vendorSeries,
          deltaPct: deltaPct(vendorSeries),
          basis: "cumulative" as const,
        },
        vendorsScreened: {
          value: firstScreenedAt.size,
          series: screenedSeries,
          deltaPct: deltaPct(screenedSeries),
          basis: "cumulative" as const,
        },
        pendingTriage: {
          value: triageFindings.filter((f) => f.reviewerFinalDecision === "pending").length,
          series: triageSeries,
          deltaPct: deltaPct(triageSeries),
          basis: "per_month" as const,
        },
        reportsApproved: {
          value: reports.filter((r) => r.status === "approved").length,
          series: approvedSeries,
          deltaPct: deltaPct(approvedSeries),
          basis: "cumulative" as const,
        },
      },
      risk: {
        portfolioScore,
        portfolioTier: portfolioScore === null ? "unassessed" : tierFor(portfolioScore, true),
        distribution,
        totalExposures: triageFindings.filter((f) => weightFor(f) > 0).length,
        byVendor: byVendor.map(({ createdAt: _createdAt, ...rest }) => rest),
        methodology: {
          weights: RISK_WEIGHTS,
          divisor: SCORE_DIVISOR,
          highRiskMin: HIGH_RISK_MIN,
          mediumRiskMin: MEDIUM_RISK_MIN,
        },
      },
      alerts,
    });
  })
);

// Cross-vendor relationship graph for the dashboard's network visualization
// (VISTA_module1_system_prompt.md's captured directors/shareholders are the
// only real relationship data we have - no UBO/bank data exists anywhere in
// the schema, so this deliberately only surfaces Company/Director/Shareholder
// nodes rather than fabricating entity types the app doesn't actually track).
//
// A person is the same node across vendors when they share a usable
// IC/passport number - SSM reports sometimes redact these as literal masked
// placeholders (e.g. "XXXXXX-10-XXXX"), which are identical across genuinely
// different people, so a masked value is never used as a match key. With no
// usable ID on either side, records fall back to matching by exact
// normalized name - a heuristic surfaced to the reviewer to verify, not an
// assertion of fact, same spirit as every other AI-suggested finding in
// this app.
function normalizeIc(ic: string | null): string | null {
  if (!ic) return null;
  const trimmed = ic.trim();
  if (!trimmed || /x/i.test(trimmed)) return null;
  return trimmed.toUpperCase();
}

function personMatchKey(name: string, ic: string | null): string {
  const usableIc = normalizeIc(ic);
  return usableIc ? `ic:${usableIc}` : `name:${name.trim().toUpperCase()}`;
}

interface PersonRole {
  vendorId: string;
  vendorName: string;
  role: "director" | "shareholder";
  designation: string | null;
  totalShares: string | null;
}

dashboardRouter.get(
  "/network",
  asyncHandler(async (_req, res) => {
    const vendors = await prisma.vendor.findMany({
      select: {
        id: true,
        companyName: true,
        registrationNo: true,
        status: true,
        directors: { select: { id: true, name: true, icPassportNo: true, designation: true } },
        shareholders: {
          select: { id: true, name: true, icPassportRegistrationNo: true, totalShares: true },
        },
      },
    });

    const companyNodes = vendors.map((v) => ({
      id: `vendor:${v.id}`,
      kind: "company" as const,
      label: v.companyName,
      vendorId: v.id,
      registrationNo: v.registrationNo,
      status: v.status,
    }));

    const personByKey = new Map<
      string,
      { id: string; name: string; icPassportNo: string | null; roles: PersonRole[] }
    >();
    const edgeSet = new Set<string>();
    const edges: { source: string; target: string }[] = [];

    function addPersonRole(
      vendorId: string,
      vendorName: string,
      name: string,
      ic: string | null,
      role: PersonRole["role"],
      designation: string | null,
      totalShares: string | null
    ) {
      const key = personMatchKey(name, ic);
      let person = personByKey.get(key);
      if (!person) {
        person = { id: `person:${key}`, name, icPassportNo: normalizeIc(ic), roles: [] };
        personByKey.set(key, person);
      }
      person.roles.push({ vendorId, vendorName, role, designation, totalShares });

      const edgeKey = `vendor:${vendorId}|${person.id}`;
      if (!edgeSet.has(edgeKey)) {
        edgeSet.add(edgeKey);
        edges.push({ source: `vendor:${vendorId}`, target: person.id });
      }
    }

    for (const v of vendors) {
      for (const d of v.directors) {
        addPersonRole(v.id, v.companyName, d.name, d.icPassportNo, "director", d.designation, null);
      }
      for (const s of v.shareholders) {
        addPersonRole(
          v.id,
          v.companyName,
          s.name,
          s.icPassportRegistrationNo,
          "shareholder",
          null,
          s.totalShares?.toString() ?? null
        );
      }
    }

    const personNodes = Array.from(personByKey.values()).map((p) => ({
      id: p.id,
      // A person holding a director role anywhere is colored as a director -
      // that's the more compliance-relevant role when someone holds both.
      kind: (p.roles.some((r) => r.role === "director") ? "director" : "shareholder") as
        | "director"
        | "shareholder",
      label: p.name,
      icPassportNo: p.icPassportNo,
      roles: p.roles,
      linkedCompanyCount: new Set(p.roles.map((r) => r.vendorId)).size,
    }));

    res.json({ nodes: [...companyNodes, ...personNodes], edges });
  })
);
