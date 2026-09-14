import fs from "fs";
import path from "path";

import cors from "cors";
import express from "express";

import { errorHandler } from "./middleware/errorHandler";
import { adverseMediaArticlesRouter } from "./routes/adverseMediaArticles";
import { ctosEnquiriesRouter } from "./routes/ctosEnquiries";
import { dashboardRouter } from "./routes/dashboard";
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

  app.use("/api/dashboard", dashboardRouter);
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

  // Serve the built frontend SPA from the same process in production, so one
  // deployed service handles both the API and the UI - present only after
  // `npm run build` has run; in local dev the frontend runs on its own Vite
  // server instead, which proxies /api here, so this simply no-ops.
  const frontendDist = path.join(__dirname, "../../frontend/dist");
  if (fs.existsSync(frontendDist)) {
    app.use(express.static(frontendDist));
    // Anything that isn't an API route is a client-side SPA route - hand it
    // index.html and let React Router take over. Unmatched /api/* paths fall
    // through to Express's default 404 instead, same as today.
    app.get(/^(?!\/api\/).*/, (_req, res) => {
      res.sendFile(path.join(frontendDist, "index.html"));
    });
  }

  app.use(errorHandler);

  return app;
}
