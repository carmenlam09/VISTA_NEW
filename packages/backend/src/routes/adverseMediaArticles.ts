import { Router } from "express";
import { z } from "zod";

import { NotFoundError } from "../lib/errors";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../middleware/errorHandler";
import { getCurrentUserId } from "../services/currentUser";

export const adverseMediaArticlesRouter = Router();

const decisionSchema = z.object({
  decision: z.enum(["relevant", "false_positive"]),
});

adverseMediaArticlesRouter.put(
  "/:id/decision",
  asyncHandler(async (req, res) => {
    const body = decisionSchema.parse(req.body);
    const reviewedById = await getCurrentUserId();

    const result = await prisma.adverseMediaArticle.updateMany({
      where: { id: req.params.id },
      data: {
        reviewerDecision: body.decision,
        reviewedById,
        reviewedAt: new Date(),
      },
    });
    if (result.count === 0) throw new NotFoundError("Article not found");

    const article = await prisma.adverseMediaArticle.findUnique({ where: { id: req.params.id } });
    res.json(article);
  })
);
