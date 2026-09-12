import { Router } from "express";
import { z } from "zod";

import { NotFoundError, ValidationError } from "../lib/errors";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../middleware/errorHandler";
import { getCurrentUserId } from "../services/currentUser";
import { indexKyvReport } from "../services/knowledge/indexer";
import { renderReportPdf } from "../services/kyvReport/reportPdf";

export const kyvReportsRouter = Router();

kyvReportsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const report = await prisma.kyvReport.findUnique({
      where: { id: req.params.id },
      include: {
        template: { select: { name: true, version: true } },
        sections: { orderBy: { sectionOrder: "asc" } },
      },
    });
    if (!report) throw new NotFoundError("KYV report not found");
    res.json(report);
  })
);

// A report's content can only move while it's in the Maker's hands - once a
// Checker has it (or has approved it), editing or resubmitting would let the
// document underneath the review shift without the Checker knowing.
const EDITABLE_STATUSES = ["draft", "rejected"];

const sectionEditSchema = z.object({
  content: z.string().min(1, "content is required"),
});

// VISTA_module5_system_prompt.md Section 3: reviewer edits a section's
// content, sets is_edited = true.
kyvReportsRouter.put(
  "/:id/sections/:sectionId",
  asyncHandler(async (req, res) => {
    const report = await prisma.kyvReport.findUnique({ where: { id: req.params.id } });
    if (!report) throw new NotFoundError("KYV report not found");
    if (!EDITABLE_STATUSES.includes(report.status)) {
      throw new ValidationError(`Cannot edit a section on a report with status '${report.status}'`);
    }

    const body = sectionEditSchema.parse(req.body);

    const result = await prisma.kyvReportSection.updateMany({
      where: { id: req.params.sectionId, reportId: report.id },
      data: { content: body.content, isEdited: true },
    });
    if (result.count === 0) throw new NotFoundError("Report section not found");

    const section = await prisma.kyvReportSection.findUnique({
      where: { id: req.params.sectionId },
    });
    res.json(section);
  })
);

// Maker submits a draft (or a previously rejected report, edited and
// resubmitted) for Checker approval. Clears any prior rejection's
// reviewedBy/reviewedAt/reviewerComments - those fields describe the latest
// review action, and there isn't one yet for this new cycle.
kyvReportsRouter.put(
  "/:id/submit-for-review",
  asyncHandler(async (req, res) => {
    const report = await prisma.kyvReport.findUnique({ where: { id: req.params.id } });
    if (!report) throw new NotFoundError("KYV report not found");
    if (!EDITABLE_STATUSES.includes(report.status)) {
      throw new ValidationError(`Cannot submit a report with status '${report.status}' for review`);
    }

    const updated = await prisma.kyvReport.update({
      where: { id: report.id },
      data: {
        status: "pending_checker_review",
        reviewedById: null,
        reviewedAt: null,
        reviewerComments: null,
      },
      include: { sections: { orderBy: { sectionOrder: "asc" } } },
    });
    res.json(updated);
  })
);

kyvReportsRouter.put(
  "/:id/approve",
  asyncHandler(async (req, res) => {
    const report = await prisma.kyvReport.findUnique({ where: { id: req.params.id } });
    if (!report) throw new NotFoundError("KYV report not found");
    if (report.status !== "pending_checker_review") {
      throw new ValidationError(
        `Cannot approve a report with status '${report.status}' - it must be pending checker review`
      );
    }

    const reviewedById = await getCurrentUserId();
    const updated = await prisma.kyvReport.update({
      where: { id: report.id },
      data: { status: "approved", reviewedById, reviewedAt: new Date() },
      include: { sections: { orderBy: { sectionOrder: "asc" } } },
    });

    // Module 6/7 Section 5: indexing is additive to this endpoint, not a
    // required part of it - a transient embedding failure shouldn't block
    // the actual approval, since a reviewer can always reindex later.
    try {
      await indexKyvReport(updated.id);
    } catch (err) {
      console.error(`Failed to index kyv_report ${updated.id} into the knowledge repository:`, err);
    }

    res.json(updated);
  })
);

const rejectSchema = z.object({
  comments: z.string().min(1, "comments is required when rejecting a report"),
});

kyvReportsRouter.put(
  "/:id/reject",
  asyncHandler(async (req, res) => {
    const report = await prisma.kyvReport.findUnique({ where: { id: req.params.id } });
    if (!report) throw new NotFoundError("KYV report not found");
    if (report.status !== "pending_checker_review") {
      throw new ValidationError(
        `Cannot reject a report with status '${report.status}' - it must be pending checker review`
      );
    }

    const body = rejectSchema.parse(req.body);
    const reviewedById = await getCurrentUserId();
    const updated = await prisma.kyvReport.update({
      where: { id: report.id },
      data: {
        status: "rejected",
        reviewedById,
        reviewedAt: new Date(),
        reviewerComments: body.comments,
      },
      include: { sections: { orderBy: { sectionOrder: "asc" } } },
    });
    res.json(updated);
  })
);

kyvReportsRouter.get(
  "/:id/export",
  asyncHandler(async (req, res) => {
    const report = await prisma.kyvReport.findUnique({
      where: { id: req.params.id },
      include: {
        vendor: { select: { companyName: true, registrationNo: true } },
        template: { select: { name: true, version: true } },
        sections: { orderBy: { sectionOrder: "asc" } },
      },
    });
    if (!report) throw new NotFoundError("KYV report not found");

    const pdf = await renderReportPdf(report);

    const safeCompanyName = report.vendor.companyName.replace(/[^a-z0-9]+/gi, "_");
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="KYV_Report_${safeCompanyName}_${report.id.slice(0, 8)}.pdf"`
    );
    res.send(pdf);
  })
);
