import { prisma } from "../../lib/prisma";
import { generateEmbedding, toVectorLiteral } from "./embeddings";

interface UpsertEntryParams {
  vendorId: string;
  sourceType: string;
  sourceId: string;
  subjectType: string | null;
  subjectName: string | null;
  riskTheme: string | null;
  decision: string | null;
  summaryText: string;
}

// Re-indexing the same source (e.g. a report gets re-approved after edits)
// updates the existing row for that source_type+source_id rather than
// inserting a duplicate - same upsert pattern as Module 4's
// risk_triage_results. The embedding column is Unsupported in Prisma Client
// (pgvector isn't natively typed), so both branches go through raw SQL.
async function upsertEntry(params: UpsertEntryParams): Promise<void> {
  const embeddingValues = await generateEmbedding(params.summaryText);
  const vectorLiteral = toVectorLiteral(embeddingValues);

  const existing = await prisma.knowledgeRepositoryEntry.findFirst({
    where: { sourceType: params.sourceType, sourceId: params.sourceId },
    select: { id: true },
  });

  if (existing) {
    await prisma.$executeRawUnsafe(
      `UPDATE knowledge_repository_entries
       SET vendor_id = $1::uuid, subject_type = $2, subject_name = $3, risk_theme = $4,
           decision = $5, summary_text = $6, embedding = $7::vector, indexed_at = now()
       WHERE id = $8::uuid`,
      params.vendorId,
      params.subjectType,
      params.subjectName,
      params.riskTheme,
      params.decision,
      params.summaryText,
      vectorLiteral,
      existing.id
    );
    return;
  }

  await prisma.$executeRawUnsafe(
    `INSERT INTO knowledge_repository_entries
       (vendor_id, source_type, source_id, subject_type, subject_name, risk_theme, decision, summary_text, embedding)
     VALUES ($1::uuid, $2, $3::uuid, $4, $5, $6, $7, $8, $9::vector)`,
    params.vendorId,
    params.sourceType,
    params.sourceId,
    params.subjectType,
    params.subjectName,
    params.riskTheme,
    params.decision,
    params.summaryText,
    vectorLiteral
  );
}

// Module 5's PUT /kyv-reports/:id/approve calls this after setting
// status = 'approved'. summary_text is built from the executive_summary and
// risk_assessment_recommendation sections specifically (per
// VISTA_module6_system_prompt.md Section 5) - falls back to every section's
// content if a custom template doesn't use those exact section_keys.
export async function indexKyvReport(reportId: string): Promise<void> {
  const report = await prisma.kyvReport.findUnique({
    where: { id: reportId },
    include: {
      vendor: { select: { companyName: true } },
      sections: { select: { sectionKey: true, content: true } },
    },
  });
  if (!report) return;

  const executiveSummary = report.sections.find((s) => s.sectionKey === "executive_summary");
  const riskAssessment = report.sections.find(
    (s) => s.sectionKey === "risk_assessment_recommendation"
  );

  const summaryText =
    executiveSummary || riskAssessment
      ? [executiveSummary?.content, riskAssessment?.content].filter(Boolean).join("\n\n")
      : report.sections.map((s) => s.content).join("\n\n");

  await upsertEntry({
    vendorId: report.vendorId,
    sourceType: "kyv_report",
    sourceId: report.id,
    subjectType: "company",
    subjectName: report.vendor.companyName,
    riskTheme: null,
    decision: "approved",
    summaryText,
  });
}

const SOURCE_TYPE_LABELS: Record<string, string> = {
  netreveal: "NetReveal watchlist",
  ctos_legal_case: "CTOS legal case",
  adverse_media: "Adverse media",
};

// Module 4's PUT /risk-triage/:id/decision calls this after the decision is
// finalized (relevant or false_positive). summary_text is built from the
// triage's ai_rationale plus its subject/finding context.
export async function indexTriageDecision(triageResultId: string): Promise<void> {
  const triageResult = await prisma.riskTriageResult.findUnique({
    where: { id: triageResultId },
  });
  if (!triageResult) return;

  let riskTheme: string | null = null;
  if (triageResult.sourceType === "adverse_media") {
    const article = await prisma.adverseMediaArticle.findUnique({
      where: { id: triageResult.sourceRecordId },
      select: { riskTheme: true },
    });
    riskTheme = article?.riskTheme ?? null;
  }

  const sourceLabel = SOURCE_TYPE_LABELS[triageResult.sourceType] ?? triageResult.sourceType;
  const summaryText = `${sourceLabel} finding for ${triageResult.subjectType} "${triageResult.subjectName}" (confidence ${triageResult.confidenceScore}): ${triageResult.aiRationale}`;

  await upsertEntry({
    vendorId: triageResult.vendorId,
    sourceType: "triage_decision",
    sourceId: triageResult.id,
    subjectType: triageResult.subjectType,
    subjectName: triageResult.subjectName,
    riskTheme,
    decision: triageResult.reviewerFinalDecision,
    summaryText,
  });
}
