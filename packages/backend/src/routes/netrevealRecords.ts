import fs from "fs/promises";
import path from "path";

import { Router } from "express";
import { z } from "zod";

import { parseExtractedDate } from "../lib/dates";
import { NotFoundError, ValidationError } from "../lib/errors";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../middleware/errorHandler";
import { UPLOAD_DIR } from "../middleware/upload";
import {
  ExtractionValidationError,
  extractNetrevealData,
} from "../services/extraction/netrevealExtractor";

export const netrevealRecordsRouter = Router();

netrevealRecordsRouter.post(
  "/:id/extract",
  asyncHandler(async (req, res) => {
    const record = await prisma.netrevealRecord.findUnique({ where: { id: req.params.id } });
    if (!record) throw new NotFoundError("NetReveal record not found");

    const document = await prisma.document.findUniqueOrThrow({ where: { id: record.documentId } });

    await prisma.document.update({
      where: { id: document.id },
      data: { uploadStatus: "extracting" },
    });

    let result;
    try {
      const pdfBuffer = await fs.readFile(path.join(UPLOAD_DIR, document.filePath));
      result = await extractNetrevealData(pdfBuffer);
    } catch (err) {
      // Every field on this record lives directly on it (unlike CTOS, where
      // only child rows get populated on success) - a failed extraction
      // leaves nothing worth keeping, and this record was only ever created
      // moments ago by the same upload-and-extract request, never reviewed.
      // Roll it back (record, document, and the uploaded file) rather than
      // leaving a blank "AI-extracted" card sitting in the watchlist
      // indistinguishable from real, just-empty, data.
      await prisma.netrevealRecord.delete({ where: { id: record.id } });
      await prisma.document.delete({ where: { id: document.id } });
      await fs.unlink(path.join(UPLOAD_DIR, document.filePath)).catch(() => {});

      if (err instanceof ExtractionValidationError) {
        res.status(422).json({ error: err.message });
        return;
      }
      throw err;
    }

    const [updatedRecord] = await prisma.$transaction([
      prisma.netrevealRecord.update({
        where: { id: record.id },
        data: {
          dobDoi: parseExtractedDate(result.dob_doi),
          nationality: result.nationality,
          checkName: result.check_name,
          uid: result.uid,
          watchpersonDetails: result.watchperson_details,
          isVerified: false,
        },
      }),
      prisma.document.update({
        where: { id: document.id },
        data: { uploadStatus: "extracted", rawExtractionJson: result },
      }),
    ]);

    res.json(updatedRecord);
  })
);

const netrevealUpdateSchema = z.object({
  dob_doi: z.string().nullable().optional(),
  nationality: z.string().nullable().optional(),
  check_name: z.string().nullable().optional(),
  uid: z.string().nullable().optional(),
  watchperson_details: z.string().nullable().optional(),
});

function toDate(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new ValidationError(`Invalid date: ${value}`);
  return parsed;
}

netrevealRecordsRouter.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const body = netrevealUpdateSchema.parse(req.body);
    const result = await prisma.netrevealRecord.updateMany({
      where: { id: req.params.id },
      data: {
        dobDoi: toDate(body.dob_doi),
        nationality: body.nationality,
        checkName: body.check_name,
        uid: body.uid,
        watchpersonDetails: body.watchperson_details,
        isVerified: true,
      },
    });
    if (result.count === 0) throw new NotFoundError("NetReveal record not found");

    const record = await prisma.netrevealRecord.findUnique({ where: { id: req.params.id } });
    res.json(record);
  })
);
