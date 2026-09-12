import { Router } from "express";
import { z } from "zod";

import { NotFoundError } from "../lib/errors";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../middleware/errorHandler";
import { getCurrentUserId } from "../services/currentUser";
import { indexTriageDecision } from "../services/knowledge/indexer";
import type { SourceType } from "../services/triage/triageEngine";

export const riskTriageRouter = Router();

const decisionSchema = z.object({
  decision: z.enum(["relevant", "false_positive"]),
});

// The underlying finding is denormalized across three possible tables
// (source_type + source_record_id, no DB-level FK - see schema.prisma).
// Only netreveal_records / ctos_legal_cases got a bare risk_decision column
// (Section 2.2); adverse_media_articles already had reviewer_decision plus
// reviewedBy/reviewedAt from Module 3, so those are kept in sync too.
function buildSourceDecisionUpdate(
  sourceType: SourceType,
  sourceRecordId: string,
  decision: "relevant" | "false_positive",
  reviewedById: string,
  reviewedAt: Date
) {
  if (sourceType === "netreveal") {
    return prisma.netrevealRecord.update({
      where: { id: sourceRecordId },
      data: { riskDecision: decision },
    });
  }
  if (sourceType === "ctos_legal_case") {
    return prisma.ctosLegalCase.update({
      where: { id: sourceRecordId },
      data: { riskDecision: decision },
    });
  }
  return prisma.adverseMediaArticle.update({
    where: { id: sourceRecordId },
    data: { reviewerDecision: decision, reviewedById, reviewedAt },
  });
}

// Module 4 (VISTA_module4_system_prompt.md Section 3): a decision made in
// the Triage queue must be reflected both in risk_triage_results (the source
// of truth for the triage UI) and back in the original Module 2/3 table
// (whose own pages read reviewer_decision / risk_decision directly) - done
// in one transaction so the two never disagree.
riskTriageRouter.put(
  "/:id/decision",
  asyncHandler(async (req, res) => {
    const body = decisionSchema.parse(req.body);
    const triageResult = await prisma.riskTriageResult.findUnique({ where: { id: req.params.id } });
    if (!triageResult) throw new NotFoundError("Risk triage result not found");

    const reviewedById = await getCurrentUserId();
    const reviewedAt = new Date();

    const [updatedTriageResult] = await prisma.$transaction([
      prisma.riskTriageResult.update({
        where: { id: triageResult.id },
        data: { reviewerFinalDecision: body.decision, reviewedById, reviewedAt },
      }),
      buildSourceDecisionUpdate(
        triageResult.sourceType as SourceType,
        triageResult.sourceRecordId,
        body.decision,
        reviewedById,
        reviewedAt
      ),
    ]);

    // Module 6/7 Section 5: indexing is additive to this endpoint, not a
    // required part of it - a transient embedding failure shouldn't block
    // the actual decision, since a reviewer can always reindex later.
    try {
      await indexTriageDecision(updatedTriageResult.id);
    } catch (err) {
      console.error(
        `Failed to index triage_decision ${updatedTriageResult.id} into the knowledge repository:`,
        err
      );
    }

    res.json(updatedTriageResult);
  })
);
