import { Prisma } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";

import { mapSettledWithConcurrency } from "../lib/concurrency";
import { ValidationError } from "../lib/errors";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../middleware/errorHandler";
import { generateEmbedding, toVectorLiteral } from "../services/knowledge/embeddings";
import { indexKyvReport, indexTriageDecision } from "../services/knowledge/indexer";
import { synthesizeSearchAnswer } from "../services/knowledge/synthesizer";

export const knowledgeRepositoryRouter = Router();

const searchQuerySchema = z.object({
  q: z.string().min(1, "q is required"),
  risk_theme: z.string().optional(),
  decision: z.enum(["approved", "relevant", "false_positive"]).optional(),
  subject_name: z.string().optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
});

function parseDateParam(value: string | undefined, paramName: string): Date | undefined {
  if (value === undefined) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new ValidationError(`Invalid date for ${paramName}: ${value}`);
  }
  return parsed;
}

interface RawSearchRow {
  id: string;
  source_type: string;
  source_id: string;
  vendor_id: string;
  vendor_name: string;
  subject_type: string | null;
  subject_name: string | null;
  risk_theme: string | null;
  decision: string | null;
  summary_text: string;
  indexed_at: Date;
  distance: number;
}

// Below this cosine distance, a result is no longer meaningfully related to
// the query. Calibrated against live searches against real indexed data:
// genuinely relevant/borderline matches landed at distance 0.20-0.51, while
// a deliberately unrelated query ("chocolate chip cookies") against the same
// corpus landed at 0.58-0.63 - 0.55 sits in the gap between those two
// clusters. Tunable without a code change; revisit as more real entries
// accumulate and this gets more data to calibrate against.
const MAX_RELEVANT_DISTANCE = Number(process.env.KNOWLEDGE_SEARCH_MAX_DISTANCE ?? 0.55);
const RESULT_LIMIT = 20;

knowledgeRepositoryRouter.get(
  "/search",
  asyncHandler(async (req, res) => {
    const query = searchQuerySchema.parse(req.query);
    const dateFrom = parseDateParam(query.date_from, "date_from");
    const dateTo = parseDateParam(query.date_to, "date_to");

    const embedding = await generateEmbedding(query.q);
    const vectorLiteral = toVectorLiteral(embedding);

    const conditions: Prisma.Sql[] = [];
    if (query.risk_theme) conditions.push(Prisma.sql`kre.risk_theme = ${query.risk_theme}`);
    if (query.decision) conditions.push(Prisma.sql`kre.decision = ${query.decision}`);
    if (query.subject_name) {
      conditions.push(Prisma.sql`kre.subject_name ILIKE ${`%${query.subject_name}%`}`);
    }
    if (dateFrom) conditions.push(Prisma.sql`kre.indexed_at >= ${dateFrom}`);
    if (dateTo) conditions.push(Prisma.sql`kre.indexed_at <= ${dateTo}`);

    const whereClause =
      conditions.length > 0 ? Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}` : Prisma.empty;

    const rows = await prisma.$queryRaw<RawSearchRow[]>`
      SELECT
        kre.id, kre.source_type, kre.source_id, kre.vendor_id, v.company_name AS vendor_name,
        kre.subject_type, kre.subject_name, kre.risk_theme, kre.decision, kre.summary_text, kre.indexed_at,
        kre.embedding <=> ${vectorLiteral}::vector AS distance
      FROM knowledge_repository_entries kre
      JOIN vendors v ON v.id = kre.vendor_id
      ${whereClause}
      ORDER BY distance ASC
      LIMIT ${RESULT_LIMIT}
    `;

    const relevantRows = rows.filter((r) => r.distance <= MAX_RELEVANT_DISTANCE);

    if (relevantRows.length === 0) {
      res.json({
        results: [],
        ai_synthesis: "No relevant past reports or decisions were found for this query.",
      });
      return;
    }

    const results = relevantRows.map((r) => ({
      id: r.id,
      sourceType: r.source_type,
      sourceId: r.source_id,
      vendorId: r.vendor_id,
      vendorName: r.vendor_name,
      subjectType: r.subject_type,
      subjectName: r.subject_name,
      riskTheme: r.risk_theme,
      decision: r.decision,
      summaryText: r.summary_text,
      indexedAt: r.indexed_at,
      similarity: 1 - r.distance,
    }));

    // Only the summary_text values go to the AI, not the raw rows - the
    // synthesis prompt is grounded solely in what's shown to the reviewer.
    const aiSynthesis = await synthesizeSearchAnswer(
      query.q,
      results.map((r) => ({ sourceType: r.sourceType, vendorName: r.vendorName, summaryText: r.summaryText }))
    );

    res.json({ results, ai_synthesis: aiSynthesis });
  })
);

const REINDEX_CONCURRENCY = Number(process.env.KNOWLEDGE_REINDEX_CONCURRENCY ?? 3);

// Admin/utility endpoint: rebuilds every knowledge_repository_entries row
// from scratch, from every currently-approved kyv_reports row and every
// finalized (relevant/false_positive) risk_triage_results row - useful for
// backfilling after this module is first deployed, or after an
// embedding-model change (VISTA_module6_system_prompt.md Section 3). Reuses
// the same indexer functions the approve/decision endpoints call, so a
// re-run is just as safe (upserts by source_type+source_id, never
// duplicates). Bounded concurrency, not Promise.all - same rate-limit
// avoidance as the other AI-heavy batch operations in this app.
knowledgeRepositoryRouter.post(
  "/reindex",
  asyncHandler(async (req, res) => {
    const [approvedReports, finalizedTriageResults] = await Promise.all([
      prisma.kyvReport.findMany({ where: { status: "approved" }, select: { id: true } }),
      prisma.riskTriageResult.findMany({
        where: { reviewerFinalDecision: { in: ["relevant", "false_positive"] } },
        select: { id: true },
      }),
    ]);

    const reportOutcomes = await mapSettledWithConcurrency(
      approvedReports,
      REINDEX_CONCURRENCY,
      (report) => indexKyvReport(report.id)
    );
    const triageOutcomes = await mapSettledWithConcurrency(
      finalizedTriageResults,
      REINDEX_CONCURRENCY,
      (triageResult) => indexTriageDecision(triageResult.id)
    );

    const allOutcomes = [...reportOutcomes, ...triageOutcomes];
    let indexed = 0;
    let failed = 0;
    allOutcomes.forEach((outcome, i) => {
      if (outcome.status === "fulfilled") {
        indexed++;
        return;
      }
      failed++;
      console.error(`Reindex failed for item ${i}:`, outcome.reason);
    });

    res.json({ indexed, failed, total: allOutcomes.length });
  })
);
