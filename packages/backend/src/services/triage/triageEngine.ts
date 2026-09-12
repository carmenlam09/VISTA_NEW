import { mapSettledWithConcurrency } from "../../lib/concurrency";
import { prisma } from "../../lib/prisma";
import type { SubjectType } from "../subjects";
import { scoreTriageFinding } from "./triageScorer";

export const SOURCE_TYPES = ["netreveal", "ctos_legal_case", "adverse_media"] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

interface PendingFinding {
  sourceType: SourceType;
  sourceRecordId: string;
  subjectType: SubjectType;
  subjectName: string;
  relatedDirectorId: string | null;
  relatedShareholderId: string | null;
  findingSummary: string;
}

// Gathers every not-yet-decided finding across the three source tables
// (VISTA_module4_system_prompt.md Section 3). Each source has its own
// "pending" definition and its own path back to the Module 1 subject.
async function collectPendingFindings(vendorId: string): Promise<PendingFinding[]> {
  const [netrevealRows, ctosLegalCaseRows, articleRows] = await Promise.all([
    prisma.netrevealRecord.findMany({
      where: {
        vendorId,
        riskDecision: "pending",
        watchpersonDetails: { not: null },
        NOT: { watchpersonDetails: "" },
      },
    }),
    prisma.ctosLegalCase.findMany({
      where: { riskDecision: "pending", ctosEnquiry: { vendorId } },
      include: {
        ctosEnquiry: {
          select: {
            subjectType: true,
            subjectName: true,
            relatedDirectorId: true,
            relatedShareholderId: true,
          },
        },
      },
    }),
    prisma.adverseMediaArticle.findMany({
      where: { vendorId, reviewerDecision: "pending" },
      include: {
        search: {
          select: {
            subjectType: true,
            subjectName: true,
            relatedDirectorId: true,
            relatedShareholderId: true,
          },
        },
      },
    }),
  ]);

  const netreveal: PendingFinding[] = netrevealRows.map((r) => ({
    sourceType: "netreveal",
    sourceRecordId: r.id,
    subjectType: r.subjectType as SubjectType,
    subjectName: r.subjectName,
    relatedDirectorId: r.relatedDirectorId,
    relatedShareholderId: r.relatedShareholderId,
    findingSummary: [
      "Source: NetReveal watchlist search",
      `Watchperson details: ${r.watchpersonDetails}`,
      `Nationality (per NetReveal): ${r.nationality ?? "unknown"}`,
      `Check name used: ${r.checkName ?? r.subjectName}`,
      `DOB/DOI: ${r.dobDoi ? r.dobDoi.toISOString().slice(0, 10) : "unknown"}`,
      `UID: ${r.uid ?? "none"}`,
    ].join("\n"),
  }));

  const ctosLegalCases: PendingFinding[] = ctosLegalCaseRows.map((c) => ({
    sourceType: "ctos_legal_case",
    sourceRecordId: c.id,
    subjectType: c.ctosEnquiry.subjectType as SubjectType,
    subjectName: c.ctosEnquiry.subjectName,
    relatedDirectorId: c.ctosEnquiry.relatedDirectorId,
    relatedShareholderId: c.ctosEnquiry.relatedShareholderId,
    findingSummary: [
      "Source: CTOS legal case",
      `Case type: ${c.caseType} (${c.caseType === "defendant" ? "D1 - subject is defendant" : "D2 - subject is plaintiff"})`,
      `Case No.: ${c.caseNo ?? "unknown"}`,
      `Plaintiff: ${c.plaintiff ?? "unknown"}`,
      `Defendant: ${c.defendant ?? "unknown"}`,
      `Remark: ${c.remark ?? "none"}`,
    ].join("\n"),
  }));

  const adverseMedia: PendingFinding[] = articleRows.map((a) => ({
    sourceType: "adverse_media",
    sourceRecordId: a.id,
    subjectType: a.search.subjectType as SubjectType,
    subjectName: a.search.subjectName,
    relatedDirectorId: a.search.relatedDirectorId,
    relatedShareholderId: a.search.relatedShareholderId,
    findingSummary: [
      "Source: Adverse media article",
      `Title: ${a.articleTitle}`,
      `Source domain: ${a.sourceDomain ?? "unknown"}`,
      `Risk theme: ${a.riskTheme}`,
      `AI summary: ${a.aiSummary}`,
    ].join("\n"),
  }));

  return [...netreveal, ...ctosLegalCases, ...adverseMedia];
}

// The subject's Module 1 profile fields relevant to identity matching -
// full name and IC/passport number (nationality isn't captured in Module 1).
async function resolveIdentity(
  vendorId: string,
  subjectType: SubjectType,
  relatedDirectorId: string | null,
  relatedShareholderId: string | null,
  fallbackName: string
): Promise<{ name: string; icPassportNo: string | null }> {
  if (subjectType === "company") {
    const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } });
    return { name: vendor?.companyName ?? fallbackName, icPassportNo: vendor?.registrationNo ?? null };
  }
  if (subjectType === "director" && relatedDirectorId) {
    const director = await prisma.ssmDirector.findUnique({ where: { id: relatedDirectorId } });
    if (director) return { name: director.name, icPassportNo: director.icPassportNo };
  }
  if (subjectType === "shareholder" && relatedShareholderId) {
    const shareholder = await prisma.ssmShareholder.findUnique({ where: { id: relatedShareholderId } });
    if (shareholder) return { name: shareholder.name, icPassportNo: shareholder.icPassportRegistrationNo };
  }
  return { name: fallbackName, icPassportNo: null };
}

interface CrossVendorLink {
  name: string;
  vendorId: string;
  vendorName: string;
  role: "director" | "shareholder";
}

// Cross-vendor relationships: is this same person (by IC/passport number) a
// director or shareholder of another vendor already in VISTA? Scoped to
// *other* vendors only - being both a director and a shareholder of the
// same vendor (common in the seed data) isn't a cross-vendor relationship.
async function findCrossVendorLinks(
  icPassportNo: string | null,
  currentVendorId: string
): Promise<CrossVendorLink[]> {
  if (!icPassportNo?.trim()) return [];

  const [directors, shareholders] = await Promise.all([
    prisma.ssmDirector.findMany({
      where: { icPassportNo, vendorId: { not: currentVendorId } },
      include: { vendor: { select: { id: true, companyName: true } } },
    }),
    prisma.ssmShareholder.findMany({
      where: { icPassportRegistrationNo: icPassportNo, vendorId: { not: currentVendorId } },
      include: { vendor: { select: { id: true, companyName: true } } },
    }),
  ]);

  return [
    ...directors.map((d) => ({
      name: d.name,
      vendorId: d.vendorId,
      vendorName: d.vendor.companyName,
      role: "director" as const,
    })),
    ...shareholders.map((s) => ({
      name: s.name,
      vendorId: s.vendorId,
      vendorName: s.vendor.companyName,
      role: "shareholder" as const,
    })),
  ];
}

// Historical outcomes: past risk_triage_results rows for the same subject
// name across any vendor. Cross-vendor links widen the name search so a
// past triage recorded under a linked identity's name (e.g. a slightly
// different spelling on another vendor's document) still surfaces - this is
// the "better, matching IC/passport number" resolution the spec describes,
// done by expanding the search via the IC-linked identity rather than by
// storing IC directly on risk_triage_results.
async function findHistoricalOutcomes(
  names: string[],
  excludeSourceType: SourceType,
  excludeSourceRecordId: string
) {
  if (names.length === 0) return [];
  return prisma.riskTriageResult.findMany({
    where: {
      OR: names.map((name) => ({ subjectName: { equals: name, mode: "insensitive" as const } })),
      NOT: { sourceType: excludeSourceType, sourceRecordId: excludeSourceRecordId },
    },
    include: { vendor: { select: { companyName: true } } },
    orderBy: { triagedAt: "desc" },
    take: 5,
  });
}

type HistoricalOutcome = Awaited<ReturnType<typeof findHistoricalOutcomes>>[number];

function formatCrossVendorContext(links: CrossVendorLink[]): string {
  if (links.length === 0) return "No other vendor relationships found for this identity.";
  return links
    .map((l) => `- ${l.name} is also a ${l.role} of "${l.vendorName}" (vendor ${l.vendorId})`)
    .join("\n");
}

function formatHistoricalContext(results: HistoricalOutcome[]): string {
  if (results.length === 0) return "No prior triage history found for this identity.";
  return results
    .map((r) => {
      const decision =
        r.reviewerFinalDecision !== "pending"
          ? `reviewer decided: ${r.reviewerFinalDecision}`
          : `AI suggested: ${r.suggestedDecision} (not yet reviewed)`;
      return `- [${r.triagedAt.toISOString().slice(0, 10)}] ${r.sourceType} for "${r.subjectName}" at "${r.vendor.companyName}": confidence ${r.confidenceScore}, ${decision}`;
    })
    .join("\n");
}

// Re-runnable: updates the existing row for this source_type + source_record_id
// rather than inserting a duplicate. The reviewer's own decision fields are
// left untouched on update - only the AI assessment moves forward.
async function upsertTriageResult(params: {
  vendorId: string;
  sourceType: SourceType;
  sourceRecordId: string;
  subjectType: SubjectType;
  subjectName: string;
  score: { confidence_score: number; ai_rationale: string; suggested_decision: string };
}) {
  const existing = await prisma.riskTriageResult.findFirst({
    where: { sourceType: params.sourceType, sourceRecordId: params.sourceRecordId },
  });

  const scoreData = {
    confidenceScore: params.score.confidence_score,
    aiRationale: params.score.ai_rationale,
    suggestedDecision: params.score.suggested_decision,
  };

  if (existing) {
    return prisma.riskTriageResult.update({
      where: { id: existing.id },
      data: { ...scoreData, triagedAt: new Date() },
    });
  }

  return prisma.riskTriageResult.create({
    data: {
      vendorId: params.vendorId,
      sourceType: params.sourceType,
      sourceRecordId: params.sourceRecordId,
      subjectType: params.subjectType,
      subjectName: params.subjectName,
      ...scoreData,
    },
  });
}

export interface TriageRunSummary {
  triagedCount: number;
  skippedCount: number;
  results: Awaited<ReturnType<typeof upsertTriageResult>>[];
}

// Bounded concurrency, not Promise.all - mirrors the SERP/categorization
// pattern in lib/concurrency.ts, since firing every finding's AI call at
// once risks tripping the provider's rate limit.
const TRIAGE_CONCURRENCY = Number(process.env.TRIAGE_CONCURRENCY ?? 3);

export async function runTriageForVendor(vendorId: string): Promise<TriageRunSummary> {
  const findings = await collectPendingFindings(vendorId);

  const outcomes = await mapSettledWithConcurrency(findings, TRIAGE_CONCURRENCY, async (finding) => {
    const identity = await resolveIdentity(
      vendorId,
      finding.subjectType,
      finding.relatedDirectorId,
      finding.relatedShareholderId,
      finding.subjectName
    );

    const crossVendorLinks = await findCrossVendorLinks(identity.icPassportNo, vendorId);

    const namesToSearch = Array.from(
      new Set([finding.subjectName, identity.name, ...crossVendorLinks.map((l) => l.name)])
    );
    const historicalResults = await findHistoricalOutcomes(
      namesToSearch,
      finding.sourceType,
      finding.sourceRecordId
    );

    const score = await scoreTriageFinding({
      subjectType: finding.subjectType,
      subjectName: finding.subjectName,
      identityIcPassportNo: identity.icPassportNo,
      findingSummary: finding.findingSummary,
      historicalContext: formatHistoricalContext(historicalResults),
      crossVendorContext: formatCrossVendorContext(crossVendorLinks),
    });

    return upsertTriageResult({
      vendorId,
      sourceType: finding.sourceType,
      sourceRecordId: finding.sourceRecordId,
      subjectType: finding.subjectType,
      subjectName: finding.subjectName,
      score,
    });
  });

  const results: TriageRunSummary["results"] = [];
  let skippedCount = 0;
  outcomes.forEach((outcome, index) => {
    if (outcome.status === "fulfilled") {
      results.push(outcome.value);
      return;
    }
    skippedCount += 1;
    const finding = findings[index];
    console.error(
      `Triage skipped for ${finding.sourceType}/${finding.sourceRecordId}:`,
      outcome.reason instanceof Error ? outcome.reason.message : outcome.reason
    );
  });

  results.sort((a, b) => b.confidenceScore.toNumber() - a.confidenceScore.toNumber());

  return { triagedCount: results.length, skippedCount, results };
}
