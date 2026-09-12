import path from "path";

import { Router } from "express";

import { NotFoundError } from "../lib/errors";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../middleware/errorHandler";
import { UPLOAD_DIR } from "../middleware/upload";

export const filesRouter = Router();

const CONTENT_TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

filesRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const document = await prisma.document.findUnique({ where: { id: req.params.id } });
    if (!document) throw new NotFoundError("Document not found");

    const ext = path.extname(document.filePath).toLowerCase();
    const safeFileName = document.fileName.replace(/[\r\n"]/g, "");
    res.setHeader("Content-Type", CONTENT_TYPES[ext] ?? "application/octet-stream");
    res.setHeader("Content-Disposition", `inline; filename="${safeFileName}"`);
    res.sendFile(path.join(UPLOAD_DIR, document.filePath));
  })
);
