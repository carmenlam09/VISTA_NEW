import cors from "cors";
import express from "express";

import { errorHandler } from "./middleware/errorHandler";
import { adverseMediaArticlesRouter } from "./routes/adverseMediaArticles";
import { ctosEnquiriesRouter } from "./routes/ctosEnquiries";
import { documentsRouter } from "./routes/documents";
import { filesRouter } from "./routes/files";
import { keywordLibraryRouter } from "./routes/keywordLibrary";
import { knowledgeRepositoryRouter } from "./routes/knowledgeRepository";
import { kyvReportsRouter } from "./routes/kyvReports";
import { netrevealRecordsRouter } from "./routes/netrevealRecords";
import { reportTemplatesRouter } from "./routes/reportTemplates";
import { riskTriageRouter } from "./routes/riskTriage";
import { vendorsRouter } from "./routes/vendors";

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/api/vendors", vendorsRouter);
  app.use("/api/documents", documentsRouter);
  app.use("/api/files", filesRouter);
  app.use("/api/ctos-enquiries", ctosEnquiriesRouter);
  app.use("/api/netreveal-records", netrevealRecordsRouter);
  app.use("/api/keyword-library", keywordLibraryRouter);
  app.use("/api/adverse-media-articles", adverseMediaArticlesRouter);
  app.use("/api/risk-triage", riskTriageRouter);
  app.use("/api/kyv-reports", kyvReportsRouter);
  app.use("/api/report-templates", reportTemplatesRouter);
  app.use("/api/knowledge-repository", knowledgeRepositoryRouter);

  app.use(errorHandler);

  return app;
}
