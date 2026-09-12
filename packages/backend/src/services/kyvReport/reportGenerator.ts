import { mapWithConcurrency } from "../../lib/concurrency";
import { NotFoundError, ValidationError } from "../../lib/errors";
import { prisma } from "../../lib/prisma";
import { getCurrentUserId } from "../currentUser";
import { draftSection } from "./sectionDrafter";

interface TemplateSection {
  section_key: string;
  title: string;
  instructions: string;
}

// Everything confirmed about a vendor across Modules 1-4, scoped to only
// relevant-decision findings (VISTA_module5_system_prompt.md Section 3). Sent
// to the AI in full for every section - the section's own `instructions`
// (not custom per-key slicing here) is what tells it what to draft, so this
// generalizes to whatever sections the active template defines.
async function buildDataPackage(vendorId: string) {
  const [vendor, financialHighlights, relevantLegalCases, tradeReferences, relevantNetreveal, relevantArticles, triageResults] =
    await Promise.all([
      prisma.vendor.findUnique({
        where: { id: vendorId },
        include: { corporateInfo: true, directors: true, shareholders: true },
      }),
      prisma.ctosFinancialHighlights.findFirst({
        where: { ctosEnquiry: { vendorId, subjectType: "company" } },
        orderBy: { ctosEnquiry: { createdAt: "desc" } },
      }),
      prisma.ctosLegalCase.findMany({
        where: { riskDecision: "relevant", ctosEnquiry: { vendorId } },
        include: { ctosEnquiry: { select: { subjectType: true, subjectName: true } } },
      }),
      // No risk_decision field exists on trade references (Module 4 didn't add
      // one) - included as-is, there's nothing to filter by.
      prisma.ctosTradeReference.findMany({
        where: { ctosEnquiry: { vendorId } },
        include: { ctosEnquiry: { select: { subjectType: true, subjectName: true } } },
      }),
      prisma.netrevealRecord.findMany({ where: { vendorId, riskDecision: "relevant" } }),
      prisma.adverseMediaArticle.findMany({
        where: { vendorId, reviewerDecision: "relevant" },
        include: { search: { select: { subjectType: true, subjectName: true } } },
      }),
      prisma.riskTriageResult.findMany({ where: { vendorId } }),
    ]);

  if (!vendor) throw new NotFoundError("Vendor not found");

  const rationaleFor = (sourceType: string, sourceRecordId: string): string | null =>
    triageResults.find((t) => t.sourceType === sourceType && t.sourceRecordId === sourceRecordId)
      ?.aiRationale ?? null;

  return {
    vendor: {
      companyName: vendor.companyName,
      registrationNo: vendor.registrationNo,
      corporateInfo: vendor.corporateInfo,
      directors: vendor.directors,
      shareholders: vendor.shareholders,
    },
    financialHighlights,
    legalCases: relevantLegalCases.map((c) => ({
      subjectType: c.ctosEnquiry.subjectType,
      subjectName: c.ctosEnquiry.subjectName,
      caseType: c.caseType,
      plaintiff: c.plaintiff,
      defendant: c.defendant,
      caseNo: c.caseNo,
      remark: c.remark,
      triageRationale: rationaleFor("ctos_legal_case", c.id),
    })),
    tradeReferences: tradeReferences.map((r) => ({
      subjectType: r.ctosEnquiry.subjectType,
      subjectName: r.ctosEnquiry.subjectName,
      referee: r.referee,
      accountNo: r.accountNo,
      capacity: r.capacity,
      statementDate: r.statementDate,
      defaultAmount: r.defaultAmount,
    })),
    netrevealRecords: relevantNetreveal.map((r) => ({
      subjectType: r.subjectType,
      subjectName: r.subjectName,
      nationality: r.nationality,
      checkName: r.checkName,
      watchpersonDetails: r.watchpersonDetails,
      triageRationale: rationaleFor("netreveal", r.id),
    })),
    adverseMediaArticles: relevantArticles.map((a) => ({
      subjectType: a.search?.subjectType ?? null,
      subjectName: a.search?.subjectName ?? null,
      articleTitle: a.articleTitle,
      sourceDomain: a.sourceDomain,
      riskTheme: a.riskTheme,
      aiSummary: a.aiSummary,
      triageRationale: rationaleFor("adverse_media", a.id),
    })),
  };
}

// The validation rule from Section 3: don't hard-block generation, just warn.
async function countPendingFindings(vendorId: string): Promise<number> {
  const [netrevealPending, legalCasePending, articlePending] = await Promise.all([
    prisma.netrevealRecord.count({ where: { vendorId, riskDecision: "pending" } }),
    prisma.ctosLegalCase.count({ where: { riskDecision: "pending", ctosEnquiry: { vendorId } } }),
    prisma.adverseMediaArticle.count({ where: { vendorId, reviewerDecision: "pending" } }),
  ]);
  return netrevealPending + legalCasePending + articlePending;
}

const REPORT_SECTION_CONCURRENCY = Number(process.env.KYV_REPORT_SECTION_CONCURRENCY ?? 3);

export async function generateKyvReport(vendorId: string) {
  const activeTemplate = await prisma.reportTemplate.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: "desc" },
  });
  if (!activeTemplate) {
    throw new ValidationError("No active report template is configured");
  }

  const [dataPackage, pendingCount] = await Promise.all([
    buildDataPackage(vendorId),
    countPendingFindings(vendorId),
  ]);

  const sections = activeTemplate.sections as unknown as TemplateSection[];

  // Bounded concurrency, not Promise.all - same rate-limit-avoidance pattern
  // used for triage scoring. Throws on the first section that fails (after
  // its own Groq->Gemini fallback already failed) rather than silently
  // producing a report missing a section.
  const draftedSections = await mapWithConcurrency(
    sections,
    REPORT_SECTION_CONCURRENCY,
    async (section, index) => {
      const { content, model } = await draftSection(section.instructions, dataPackage);
      return {
        sectionKey: section.section_key,
        title: section.title,
        content,
        sectionOrder: index,
        model,
      };
    }
  );

  const preparedById = await getCurrentUserId();
  const modelsUsed = Array.from(new Set(draftedSections.map((s) => s.model))).join(", ");

  const report = await prisma.kyvReport.create({
    data: {
      vendorId,
      templateId: activeTemplate.id,
      status: "draft",
      preparedById,
      generatedByModel: modelsUsed,
      sections: {
        create: draftedSections.map(({ sectionKey, title, content, sectionOrder }) => ({
          sectionKey,
          title,
          content,
          sectionOrder,
        })),
      },
    },
    include: { sections: { orderBy: { sectionOrder: "asc" } } },
  });

  const warnings: string[] = [];
  if (pendingCount > 0) {
    warnings.push(
      `${pendingCount} finding${pendingCount === 1 ? " is" : "s are"} still pending triage decision and ${pendingCount === 1 ? "was" : "were"} excluded from this report`
    );
  }

  return { report, warnings };
}
