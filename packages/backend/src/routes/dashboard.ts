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
