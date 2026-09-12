import fs from "fs/promises";
import path from "path";

import { Router } from "express";

import { NotFoundError } from "../lib/errors";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../middleware/errorHandler";
import { UPLOAD_DIR } from "../middleware/upload";
import { ExtractionValidationError, extractSsmData } from "../services/extraction/ssmExtractor";

export const documentsRouter = Router();

documentsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const document = await prisma.document.findUnique({ where: { id: req.params.id } });
    if (!document) throw new NotFoundError("Document not found");
    res.json(document);
  })
);

documentsRouter.post(
  "/:id/extract",
  asyncHandler(async (req, res) => {
    const document = await prisma.document.findUnique({ where: { id: req.params.id } });
    if (!document) throw new NotFoundError("Document not found");

    await prisma.document.update({
      where: { id: document.id },
      data: { uploadStatus: "extracting" },
    });

    let result;
    try {
      const pdfBuffer = await fs.readFile(path.join(UPLOAD_DIR, document.filePath));
      result = await extractSsmData(pdfBuffer);
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
      prisma.ssmCorporateInfo.upsert({
        where: { vendorId: document.vendorId },
        create: {
          vendorId: document.vendorId,
          documentId: document.id,
          companyName: result.corporate_info.company_name,
          formerCompanyName: result.corporate_info.former_company_name,
          dateOfNameChange: result.corporate_info.date_of_name_change
            ? new Date(result.corporate_info.date_of_name_change)
            : null,
          dateOfIncorporation: result.corporate_info.date_of_incorporation
            ? new Date(result.corporate_info.date_of_incorporation)
            : null,
          companyStatus: result.corporate_info.company_status,
          natureOfBusiness: result.corporate_info.nature_of_business,
        },
        update: {
          documentId: document.id,
          companyName: result.corporate_info.company_name,
          formerCompanyName: result.corporate_info.former_company_name,
          dateOfNameChange: result.corporate_info.date_of_name_change
            ? new Date(result.corporate_info.date_of_name_change)
            : null,
          dateOfIncorporation: result.corporate_info.date_of_incorporation
            ? new Date(result.corporate_info.date_of_incorporation)
            : null,
          companyStatus: result.corporate_info.company_status,
          natureOfBusiness: result.corporate_info.nature_of_business,
          isVerified: false,
        },
      }),
      prisma.ssmShareCapital.upsert({
        where: { vendorId: document.vendorId },
        create: {
          vendorId: document.vendorId,
          documentId: document.id,
          paidUpCapital: result.share_capital.paid_up_capital,
        },
        update: {
          documentId: document.id,
          paidUpCapital: result.share_capital.paid_up_capital,
          isVerified: false,
        },
      }),
      // Re-extraction replaces prior auto-extracted rows but preserves anything
      // a reviewer has already confirmed.
      prisma.ssmDirector.deleteMany({
        where: { vendorId: document.vendorId, isVerified: false },
      }),
      prisma.ssmShareholder.deleteMany({
        where: { vendorId: document.vendorId, isVerified: false },
      }),
      ...(result.directors.length > 0
        ? [
            prisma.ssmDirector.createMany({
              data: result.directors.map((director) => ({
                vendorId: document.vendorId,
                documentId: document.id,
                name: director.name,
                icPassportNo: director.ic_passport_no,
                designation: director.designation,
              })),
            }),
          ]
        : []),
      ...(result.shareholders.length > 0
        ? [
            prisma.ssmShareholder.createMany({
              data: result.shareholders.map((shareholder) => ({
                vendorId: document.vendorId,
                documentId: document.id,
                name: shareholder.name,
                icPassportRegistrationNo: shareholder.ic_passport_registration_no,
                totalShares: shareholder.total_shares,
              })),
            }),
          ]
        : []),
      prisma.document.update({
        where: { id: document.id },
        data: { uploadStatus: "extracted", rawExtractionJson: result },
      }),
    ]);

    const vendor = await prisma.vendor.findUnique({
      where: { id: document.vendorId },
      include: {
        corporateInfo: true,
        shareCapital: true,
        directors: true,
        shareholders: true,
      },
    });

    res.json(vendor);
  })
);
