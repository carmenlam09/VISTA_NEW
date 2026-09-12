import { Router } from "express";
import { z } from "zod";

import { NotFoundError } from "../lib/errors";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../middleware/errorHandler";
import { RISK_THEMES } from "../services/categorization/adverseMediaCategorizer";

export const keywordLibraryRouter = Router();

const listQuerySchema = z.object({
  risk_theme: z.enum(RISK_THEMES).optional(),
  is_active: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
});

keywordLibraryRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const query = listQuerySchema.parse(req.query);
    const keywords = await prisma.adverseMediaKeywordLibrary.findMany({
      where: {
        riskTheme: query.risk_theme,
        isActive: query.is_active,
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(keywords);
  })
);

const createKeywordSchema = z.object({
  keyword: z.string().min(1, "keyword is required"),
  risk_theme: z.enum(RISK_THEMES),
});

keywordLibraryRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const body = createKeywordSchema.parse(req.body);
    const keyword = await prisma.adverseMediaKeywordLibrary.create({
      data: { keyword: body.keyword, riskTheme: body.risk_theme },
    });
    res.status(201).json(keyword);
  })
);

const updateKeywordSchema = z.object({
  keyword: z.string().min(1).optional(),
  risk_theme: z.enum(RISK_THEMES).optional(),
  is_active: z.boolean().optional(),
});

keywordLibraryRouter.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const body = updateKeywordSchema.parse(req.body);
    const result = await prisma.adverseMediaKeywordLibrary.updateMany({
      where: { id: req.params.id },
      data: {
        keyword: body.keyword,
        riskTheme: body.risk_theme,
        isActive: body.is_active,
      },
    });
    if (result.count === 0) throw new NotFoundError("Keyword not found");

    const keyword = await prisma.adverseMediaKeywordLibrary.findUnique({
      where: { id: req.params.id },
    });
    res.json(keyword);
  })
);
