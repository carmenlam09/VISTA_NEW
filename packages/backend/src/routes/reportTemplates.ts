import { Router } from "express";
import { z } from "zod";

import { NotFoundError } from "../lib/errors";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../middleware/errorHandler";

export const reportTemplatesRouter = Router();

// VISTA_module5_system_prompt.md Section 3: lets an admin see/manage which
// template is active.
reportTemplatesRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const templates = await prisma.reportTemplate.findMany({
      orderBy: { createdAt: "desc" },
    });
    res.json(templates);
  })
);

const sectionSchema = z.object({
  section_key: z.string().min(1),
  title: z.string().min(1),
  instructions: z.string().min(1),
});

const createTemplateSchema = z.object({
  name: z.string().min(1),
  version: z.string().min(1),
  sections: z.array(sectionSchema).min(1, "sections must have at least one entry"),
});

// For when the real bank template arrives. Always created inactive -
// activating is a separate, explicit step (PUT /:id/activate) so adding a
// template never silently changes what the next generated report contains
// until a reviewer chooses to switch to it.
reportTemplatesRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const body = createTemplateSchema.parse(req.body);
    const template = await prisma.reportTemplate.create({
      data: {
        name: body.name,
        version: body.version,
        sections: body.sections,
        isActive: false,
      },
    });
    res.status(201).json(template);
  })
);

// Marks one template active and implicitly deactivates the others, in one
// transaction, so there's never a moment with zero or multiple active
// templates.
reportTemplatesRouter.put(
  "/:id/activate",
  asyncHandler(async (req, res) => {
    const template = await prisma.reportTemplate.findUnique({ where: { id: req.params.id } });
    if (!template) throw new NotFoundError("Report template not found");

    const [, activated] = await prisma.$transaction([
      prisma.reportTemplate.updateMany({
        where: { id: { not: template.id } },
        data: { isActive: false },
      }),
      prisma.reportTemplate.update({
        where: { id: template.id },
        data: { isActive: true },
      }),
    ]);

    res.json(activated);
  })
);
