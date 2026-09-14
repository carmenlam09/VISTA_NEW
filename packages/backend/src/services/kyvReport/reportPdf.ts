import { execFile } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { promisify } from "util";

import puppeteer, { type Browser } from "puppeteer";

const execFileAsync = promisify(execFile);

// Matches Puppeteer's own default cache location resolution - overridable
// via PUPPETEER_CACHE_DIR, same env var Puppeteer itself reads.
const PUPPETEER_CACHE_DIR =
  process.env.PUPPETEER_CACHE_DIR ?? path.join(os.homedir(), ".cache", "puppeteer");

export interface ReportForPdf {
  id: string;
  status: string;
  generatedAt: Date;
  generatedByModel: string | null;
  reviewedAt: Date | null;
  reviewerComments: string | null;
  vendor: { companyName: string; registrationNo: string | null };
  template: { name: string; version: string };
  sections: Array<{ title: string; content: string; sectionOrder: number }>;
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  pending_checker_review: "Pending Checker Review",
  approved: "Approved",
  rejected: "Rejected",
};

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// AI-drafted / reviewer-edited content is plain text with blank-line
// paragraph breaks - render each as its own <p>, not one giant block. The
// model is asked for prose, not markdown, but still occasionally emits
// **bold** emphasis - convert it rather than let literal asterisks through.
function renderParagraphs(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((paragraph) => {
      const withBold = escapeHtml(paragraph.trim()).replace(
        /\*\*(.+?)\*\*/g,
        "<strong>$1</strong>"
      );
      return `<p>${withBold.replace(/\n/g, "<br>")}</p>`;
    })
    .join("\n");
}

function buildHtml(report: ReportForPdf): string {
  const sectionsHtml = [...report.sections]
    .sort((a, b) => a.sectionOrder - b.sectionOrder)
    .map(
      (section) => `
        <section>
          <h2>${escapeHtml(section.title)}</h2>
          ${renderParagraphs(section.content)}
        </section>`
    )
    .join("\n");

  const rejectionNoticeHtml =
    report.status === "rejected" && report.reviewerComments
      ? `<div class="comments"><strong>Reviewer comments:</strong> ${escapeHtml(report.reviewerComments)}</div>`
      : "";

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { font-family: Arial, Helvetica, sans-serif; color: #1a1a1a; padding: 0 8px; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .meta { font-size: 12px; color: #555; margin-bottom: 24px; }
  .meta div { margin-bottom: 2px; }
  h2 { font-size: 15px; border-bottom: 1px solid #ccc; padding-bottom: 4px; margin-top: 28px; }
  p { font-size: 12px; line-height: 1.5; }
  .comments { margin-top: 28px; padding: 12px; background: #fdf2f2; border: 1px solid #f3caca; font-size: 12px; }
</style>
</head>
<body>
  <h1>KYV Report - ${escapeHtml(report.vendor.companyName)}</h1>
  <div class="meta">
    <div>Registration No.: ${escapeHtml(report.vendor.registrationNo ?? "-")}</div>
    <div>Status: ${STATUS_LABELS[report.status] ?? report.status}</div>
    <div>Template: ${escapeHtml(report.template.name)} (${escapeHtml(report.template.version)})</div>
    <div>Generated: ${report.generatedAt.toISOString().slice(0, 10)}${report.generatedByModel ? ` - ${escapeHtml(report.generatedByModel)}` : ""}</div>
    ${report.reviewedAt ? `<div>Reviewed: ${report.reviewedAt.toISOString().slice(0, 10)}</div>` : ""}
  </div>
  ${sectionsHtml}
  ${rejectionNoticeHtml}
</body>
</html>`;
}

// Lazily launched, reused across requests - same "construct on first real
// use, not at module load" convention as the Gemini/Groq clients, so a
// missing/broken Chromium install only breaks the export endpoint, and app
// startup/health checks never wait on a Chrome download.
//
// The npx install below is a fallback, not the primary path - Chrome is
// expected to already be present (e.g. from a platform-level buildpack
// step). If it's missing, or a prior install was interrupted mid-download
// and left a corrupt partial build behind, clear and reinstall once here,
// then retry the launch.
async function launchBrowser(): Promise<Browser> {
  try {
    return await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
  } catch (err) {
    console.error("Puppeteer launch failed, attempting to (re)install Chrome:", err);
    // Remove any partial/corrupt install ourselves via fs, rather than
    // shelling out to `puppeteer browsers clear` - that CLI command can
    // prompt for confirmation, which hangs forever with no attached stdin.
    fs.rmSync(PUPPETEER_CACHE_DIR, { recursive: true, force: true });
    // shell: true - on Windows npx is npx.cmd, which execFile can't spawn
    // directly without going through a shell. Args here are a hardcoded
    // literal, not user input, so unescaped shell concatenation is safe.
    await execFileAsync("npx", ["puppeteer", "browsers", "install", "chrome"], { shell: true });
    return await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
  }
}

let browserPromise: Promise<Browser> | null = null;
function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    // Don't cache a rejected promise - if this attempt fails, let the next
    // request try again from scratch instead of permanently wedging the
    // export endpoint until the process restarts.
    browserPromise = launchBrowser().catch((err) => {
      browserPromise = null;
      throw err;
    });
  }
  return browserPromise;
}

// A basic HTML-to-PDF render is enough for this phase
// (VISTA_module5_system_prompt.md Section 3).
export async function renderReportPdf(report: ReportForPdf): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(buildHtml(report), { waitUntil: "load" });
    const pdf = await page.pdf({
      format: "a4",
      margin: { top: "20mm", bottom: "20mm", left: "15mm", right: "15mm" },
    });
    return Buffer.from(pdf);
  } finally {
    await page.close();
  }
}
