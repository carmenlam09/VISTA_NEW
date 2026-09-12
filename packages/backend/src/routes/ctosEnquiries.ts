import fs from "fs/promises";
import path from "path";

import { Router } from "express";
import { z } from "zod";

import { parseExtractedDate } from "../lib/dates";
import { NotFoundError, ValidationError } from "../lib/errors";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../middleware/errorHandler";
import { UPLOAD_DIR } from "../middleware/upload";
import { ExtractionValidationError, extractCtosData } from "../services/extraction/ctosExtractor";

export const ctosEnquiriesRouter = Router();

function toDate(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new ValidationError(`Invalid date: ${value}`);
  return parsed;
}

ctosEnquiriesRouter.post(
  "/:id/extract",
  asyncHandler(async (req, res) => {
    const enquiry = await prisma.ctosEnquiry.findUnique({ where: { id: req.params.id } });
    if (!enquiry) throw new NotFoundError("CTOS enquiry not found");

    const document = await prisma.document.findUniqueOrThrow({ where: { id: enquiry.documentId } });

    await prisma.document.update({
      where: { id: document.id },
      data: { uploadStatus: "extracting" },
    });

    let result;
    try {
      const pdfBuffer = await fs.readFile(path.join(UPLOAD_DIR, document.filePath));
      result = await extractCtosData(pdfBuffer);
    } catch (err) {
      await prisma.document.update({
        where: { id: document.id },
        data: {
          uploadStatus: "failed",
          rawExtractionJson:
            err instanceof ExtractionValidationError
              ? { error: err.message }
              : { error: "Extraction failed" },
        },
      });
      if (err instanceof ExtractionValidationError) {
        res.status(422).json({ error: err.message });
        return;
      }
      throw err;
    }

    await prisma.$transaction([
      // financial_highlights only applies to a company-subject enquiry.
      ...(enquiry.subjectType === "company"
        ? [
            prisma.ctosFinancialHighlights.upsert({
              where: { ctosEnquiryId: enquiry.id },
              create: {
                ctosEnquiryId: enquiry.id,
                totalIssuedOrdinary: result.financial_highlights.total_issued_ordinary,
                totalIssuedPreference: result.financial_highlights.total_issued_preference,
                totalIssuedOthers: result.financial_highlights.total_issued_others,
                revenueTurnover: result.financial_highlights.revenue_turnover,
                netIncome: result.financial_highlights.net_income,
                currentAssets: result.financial_highlights.current_assets,
                currentLiabilities: result.financial_highlights.current_liabilities,
                currentRatio: result.financial_highlights.current_ratio,
                debtToEquityRatio: result.financial_highlights.debt_to_equity_ratio,
              },
              update: {
                totalIssuedOrdinary: result.financial_highlights.total_issued_ordinary,
                totalIssuedPreference: result.financial_highlights.total_issued_preference,
                totalIssuedOthers: result.financial_highlights.total_issued_others,
                revenueTurnover: result.financial_highlights.revenue_turnover,
                netIncome: result.financial_highlights.net_income,
                currentAssets: result.financial_highlights.current_assets,
                currentLiabilities: result.financial_highlights.current_liabilities,
                currentRatio: result.financial_highlights.current_ratio,
                debtToEquityRatio: result.financial_highlights.debt_to_equity_ratio,
                isVerified: false,
              },
            }),
          ]
        : []),
      // Re-extraction replaces prior auto-extracted rows but preserves anything
      // a reviewer has already confirmed.
      prisma.ctosLegalCase.deleteMany({ where: { ctosEnquiryId: enquiry.id, isVerified: false } }),
      prisma.ctosTradeReference.deleteMany({
        where: { ctosEnquiryId: enquiry.id, isVerified: false },
      }),
      ...(result.legal_cases.length > 0
        ? [
            prisma.ctosLegalCase.createMany({
              data: result.legal_cases.map((legalCase) => ({
                ctosEnquiryId: enquiry.id,
                caseType: legalCase.case_type,
                plaintiff: legalCase.plaintiff,
                defendant: legalCase.defendant,
                caseNo: legalCase.case_no,
                remark: legalCase.remark,
              })),
            }),
          ]
        : []),
      ...(result.trade_references.length > 0
        ? [
            prisma.ctosTradeReference.createMany({
              data: result.trade_references.map((ref) => ({
                ctosEnquiryId: enquiry.id,
                referee: ref.referee,
                accountNo: ref.account_no,
                capacity: ref.capacity,
                statementDate: parseExtractedDate(ref.statement_date),
                defaultAmount: ref.default_amount,
              })),
            }),
          ]
        : []),
      prisma.document.update({
        where: { id: document.id },
        data: { uploadStatus: "extracted", rawExtractionJson: result },
      }),
    ]);

    const updatedEnquiry = await prisma.ctosEnquiry.findUnique({
      where: { id: enquiry.id },
      include: {
        document: true,
        financialHighlights: true,
        legalCases: true,
        tradeReferences: true,
      },
    });

    res.json(updatedEnquiry);
  })
);

const financialHighlightsSchema = z.object({
  total_issued_ordinary: z.number().nullable().optional(),
  total_issued_preference: z.number().nullable().optional(),
  total_issued_others: z.number().nullable().optional(),
  revenue_turnover: z.number().nullable().optional(),
  net_income: z.number().nullable().optional(),
  current_assets: z.number().nullable().optional(),
  current_liabilities: z.number().nullable().optional(),
  current_ratio: z.number().nullable().optional(),
  debt_to_equity_ratio: z.number().nullable().optional(),
});

ctosEnquiriesRouter.put(
  "/:id/financial-highlights",
  asyncHandler(async (req, res) => {
    const enquiry = await prisma.ctosEnquiry.findUnique({ where: { id: req.params.id } });
    if (!enquiry) throw new NotFoundError("CTOS enquiry not found");

    const body = financialHighlightsSchema.parse(req.body);
    const data = {
      totalIssuedOrdinary: body.total_issued_ordinary,
      totalIssuedPreference: body.total_issued_preference,
      totalIssuedOthers: body.total_issued_others,
      revenueTurnover: body.revenue_turnover,
      netIncome: body.net_income,
      currentAssets: body.current_assets,
      currentLiabilities: body.current_liabilities,
      currentRatio: body.current_ratio,
      debtToEquityRatio: body.debt_to_equity_ratio,
      isVerified: true,
    };

    const financialHighlights = await prisma.ctosFinancialHighlights.upsert({
      where: { ctosEnquiryId: enquiry.id },
      create: { ctosEnquiryId: enquiry.id, ...data },
      update: data,
    });

    res.json(financialHighlights);
  })
);

const legalCaseSchema = z.object({
  case_type: z.enum(["defendant", "plaintiff"]),
  plaintiff: z.string().nullable().optional(),
  defendant: z.string().nullable().optional(),
  case_no: z.string().nullable().optional(),
  remark: z.string().nullable().optional(),
  is_verified: z.boolean().optional(),
});

ctosEnquiriesRouter.post(
  "/:id/legal-cases",
  asyncHandler(async (req, res) => {
    const enquiry = await prisma.ctosEnquiry.findUnique({ where: { id: req.params.id } });
    if (!enquiry) throw new NotFoundError("CTOS enquiry not found");

    const body = legalCaseSchema.parse(req.body);
    const legalCase = await prisma.ctosLegalCase.create({
      data: {
        ctosEnquiryId: enquiry.id,
        caseType: body.case_type,
        plaintiff: body.plaintiff,
        defendant: body.defendant,
        caseNo: body.case_no,
        remark: body.remark,
        isVerified: true,
      },
    });

    res.status(201).json(legalCase);
  })
);

ctosEnquiriesRouter.put(
  "/:id/legal-cases/:caseId",
  asyncHandler(async (req, res) => {
    const body = legalCaseSchema.partial().parse(req.body);
    const result = await prisma.ctosLegalCase.updateMany({
      where: { id: req.params.caseId, ctosEnquiryId: req.params.id },
      data: {
        caseType: body.case_type,
        plaintiff: body.plaintiff,
        defendant: body.defendant,
        caseNo: body.case_no,
        remark: body.remark,
        isVerified: body.is_verified,
      },
    });
    if (result.count === 0) throw new NotFoundError("Legal case not found");

    const legalCase = await prisma.ctosLegalCase.findUnique({ where: { id: req.params.caseId } });
    res.json(legalCase);
  })
);

ctosEnquiriesRouter.delete(
  "/:id/legal-cases/:caseId",
  asyncHandler(async (req, res) => {
    const result = await prisma.ctosLegalCase.deleteMany({
      where: { id: req.params.caseId, ctosEnquiryId: req.params.id },
    });
    if (result.count === 0) throw new NotFoundError("Legal case not found");
    res.status(204).send();
  })
);

const tradeReferenceSchema = z.object({
  referee: z.string().nullable().optional(),
  account_no: z.string().nullable().optional(),
  capacity: z.string().nullable().optional(),
  statement_date: z.string().nullable().optional(),
  default_amount: z.number().nullable().optional(),
  is_verified: z.boolean().optional(),
});

ctosEnquiriesRouter.post(
  "/:id/trade-references",
  asyncHandler(async (req, res) => {
    const enquiry = await prisma.ctosEnquiry.findUnique({ where: { id: req.params.id } });
    if (!enquiry) throw new NotFoundError("CTOS enquiry not found");

    const body = tradeReferenceSchema.parse(req.body);
    const tradeReference = await prisma.ctosTradeReference.create({
      data: {
        ctosEnquiryId: enquiry.id,
        referee: body.referee,
        accountNo: body.account_no,
        capacity: body.capacity,
        statementDate: toDate(body.statement_date),
        defaultAmount: body.default_amount,
        isVerified: true,
      },
    });

    res.status(201).json(tradeReference);
  })
);

ctosEnquiriesRouter.put(
  "/:id/trade-references/:refId",
  asyncHandler(async (req, res) => {
    const body = tradeReferenceSchema.partial().parse(req.body);
    const result = await prisma.ctosTradeReference.updateMany({
      where: { id: req.params.refId, ctosEnquiryId: req.params.id },
      data: {
        referee: body.referee,
        accountNo: body.account_no,
        capacity: body.capacity,
        statementDate: toDate(body.statement_date),
        defaultAmount: body.default_amount,
        isVerified: body.is_verified,
      },
    });
    if (result.count === 0) throw new NotFoundError("Trade reference not found");

    const tradeReference = await prisma.ctosTradeReference.findUnique({
      where: { id: req.params.refId },
    });
    res.json(tradeReference);
  })
);

ctosEnquiriesRouter.delete(
  "/:id/trade-references/:refId",
  asyncHandler(async (req, res) => {
    const result = await prisma.ctosTradeReference.deleteMany({
      where: { id: req.params.refId, ctosEnquiryId: req.params.id },
    });
    if (result.count === 0) throw new NotFoundError("Trade reference not found");
    res.status(204).send();
  })
);
