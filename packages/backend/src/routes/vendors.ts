import { Router } from "express";
import { z } from "zod";

import { mapWithConcurrency } from "../lib/concurrency";
import { NotFoundError, ValidationError } from "../lib/errors";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../middleware/errorHandler";
import { upload } from "../middleware/upload";
import {
  type CategorizationResult,
  categorizeArticle,
} from "../services/categorization/adverseMediaCategorizer";
import { generateKyvReport } from "../services/kyvReport/reportGenerator";
import { SummaryGenerationError, generateScreeningSummary } from "../services/screeningSummary";
import { SerpSearchError, type SerpOrganicResult, searchGoogle } from "../services/search/serpClient";
import { SUBJECT_TYPES, resolveSubject } from "../services/subjects";
import { getCurrentUserId } from "../services/currentUser";
import { SOURCE_TYPES, runTriageForVendor } from "../services/triage/triageEngine";

export const vendorsRouter = Router();

const DOC_TYPES = ["ssm_report", "supplier_registration_form", "vendor_confirmation_letter"] as const;

// Multipart fields arrive as strings; an omitted optional field may come
// through as "" rather than absent, so treat "" as undefined.
const optionalUuid = z.preprocess((v) => (v === "" ? undefined : v), z.string().uuid().optional());

const subjectUploadSchema = z.object({
  subject_type: z.enum(SUBJECT_TYPES),
  related_director_id: optionalUuid,
  related_shareholder_id: optionalUuid,
});

const createVendorSchema = z.object({
  company_name: z.string().min(1, "company_name is required"),
});

vendorsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const body = createVendorSchema.parse(req.body);
    const createdById = await getCurrentUserId();

    const vendor = await prisma.vendor.create({
      data: { companyName: body.company_name, createdById },
    });

    res.status(201).json(vendor);
  })
);

vendorsRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const vendors = await prisma.vendor.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        companyName: true,
        registrationNo: true,
        status: true,
        createdAt: true,
      },
    });
    res.json(vendors);
  })
);

vendorsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const vendor = await prisma.vendor.findUnique({
      where: { id: req.params.id },
      include: {
        documents: true,
        corporateInfo: true,
        shareCapital: true,
        directors: true,
        shareholders: true,
      },
    });
    if (!vendor) throw new NotFoundError("Vendor not found");
    res.json(vendor);
  })
);

// Removes an obsolete or wrongly-created vendor. All Module 1-3 child
// records cascade via the vendor_id foreign keys in schema.prisma.
vendorsRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const result = await prisma.vendor.deleteMany({ where: { id: req.params.id } });
    if (result.count === 0) throw new NotFoundError("Vendor not found");
    res.status(204).send();
  })
);

// Module 2 (Screening Intelligence) Section 4: lets the "who is this enquiry
// about" picker populate from Module 1 data without duplicating logic.
vendorsRouter.get(
  "/:id/subjects",
  asyncHandler(async (req, res) => {
    const vendor = await prisma.vendor.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        companyName: true,
        directors: { select: { id: true, name: true } },
        shareholders: { select: { id: true, name: true } },
      },
    });
    if (!vendor) throw new NotFoundError("Vendor not found");

    const subjects = [
      { id: vendor.id, type: "company" as const, name: vendor.companyName },
      ...vendor.directors.map((d) => ({ id: d.id, type: "director" as const, name: d.name })),
      ...vendor.shareholders.map((s) => ({
        id: s.id,
        type: "shareholder" as const,
        name: s.name,
      })),
    ];

    res.json(subjects);
  })
);

vendorsRouter.post(
  "/:id/documents",
  upload.single("file"),
  asyncHandler(async (req, res) => {
    const vendorId = req.params.id;
    const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } });
    if (!vendor) throw new NotFoundError("Vendor not found");

    const docType = z.enum(DOC_TYPES).safeParse(req.body.doc_type);
    if (!docType.success) {
      throw new ValidationError(`doc_type must be one of: ${DOC_TYPES.join(", ")}`);
    }
    if (!req.file) {
      throw new ValidationError("file is required");
    }

    const uploadedById = await getCurrentUserId();
    const document = await prisma.document.create({
      data: {
        vendorId,
        docType: docType.data,
        fileName: req.file.originalname,
        filePath: req.file.filename,
        uploadedById,
      },
    });

    res.status(201).json(document);
  })
);

const corporateInfoSchema = z.object({
  company_name: z.string().nullable().optional(),
  former_company_name: z.string().nullable().optional(),
  date_of_name_change: z.string().nullable().optional(),
  date_of_incorporation: z.string().nullable().optional(),
  company_status: z.string().nullable().optional(),
  nature_of_business: z.string().nullable().optional(),
});

function toDate(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new ValidationError(`Invalid date: ${value}`);
  return parsed;
}

vendorsRouter.put(
  "/:id/corporate-info",
  asyncHandler(async (req, res) => {
    const vendorId = req.params.id;
    const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } });
    if (!vendor) throw new NotFoundError("Vendor not found");

    const body = corporateInfoSchema.parse(req.body);

    const data = {
      companyName: body.company_name,
      formerCompanyName: body.former_company_name,
      dateOfNameChange: toDate(body.date_of_name_change),
      dateOfIncorporation: toDate(body.date_of_incorporation),
      companyStatus: body.company_status,
      natureOfBusiness: body.nature_of_business,
      isVerified: true,
    };

    const [corporateInfo] = await prisma.$transaction([
      prisma.ssmCorporateInfo.upsert({
        where: { vendorId },
        create: { vendorId, ...data },
        update: data,
      }),
      // Keep the vendor's canonical display name in sync with confirmed SSM data.
      ...(body.company_name
        ? [prisma.vendor.update({ where: { id: vendorId }, data: { companyName: body.company_name } })]
        : []),
    ]);

    res.json(corporateInfo);
  })
);

const shareCapitalSchema = z.object({
  paid_up_capital: z.number().nullable().optional(),
});

vendorsRouter.put(
  "/:id/share-capital",
  asyncHandler(async (req, res) => {
    const vendorId = req.params.id;
    const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } });
    if (!vendor) throw new NotFoundError("Vendor not found");

    const body = shareCapitalSchema.parse(req.body);
    const data = { paidUpCapital: body.paid_up_capital, isVerified: true };

    const shareCapital = await prisma.ssmShareCapital.upsert({
      where: { vendorId },
      create: { vendorId, ...data },
      update: data,
    });

    res.json(shareCapital);
  })
);

const directorSchema = z.object({
  name: z.string().min(1),
  ic_passport_no: z.string().nullable().optional(),
  designation: z.string().nullable().optional(),
  is_verified: z.boolean().optional(),
});

vendorsRouter.post(
  "/:id/directors",
  asyncHandler(async (req, res) => {
    const vendorId = req.params.id;
    const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } });
    if (!vendor) throw new NotFoundError("Vendor not found");

    const body = directorSchema.parse(req.body);
    const director = await prisma.ssmDirector.create({
      data: {
        vendorId,
        name: body.name,
        icPassportNo: body.ic_passport_no,
        designation: body.designation,
        isVerified: body.is_verified ?? false,
      },
    });

    res.status(201).json(director);
  })
);

vendorsRouter.put(
  "/:id/directors/:directorId",
  asyncHandler(async (req, res) => {
    const body = directorSchema.partial().parse(req.body);
    // Editing the actual content of an already-verified row must reopen it for
    // review — unless the same request explicitly re-confirms it.
    const touchesContent =
      body.name !== undefined || body.ic_passport_no !== undefined || body.designation !== undefined;
    const isVerified = touchesContent && body.is_verified !== true ? false : body.is_verified;
    const result = await prisma.ssmDirector.updateMany({
      where: { id: req.params.directorId, vendorId: req.params.id },
      data: {
        name: body.name,
        icPassportNo: body.ic_passport_no,
        designation: body.designation,
        isVerified,
      },
    });
    if (result.count === 0) throw new NotFoundError("Director not found");

    const director = await prisma.ssmDirector.findUnique({ where: { id: req.params.directorId } });
    res.json(director);
  })
);

vendorsRouter.delete(
  "/:id/directors/:directorId",
  asyncHandler(async (req, res) => {
    const result = await prisma.ssmDirector.deleteMany({
      where: { id: req.params.directorId, vendorId: req.params.id },
    });
    if (result.count === 0) throw new NotFoundError("Director not found");
    res.status(204).send();
  })
);

const shareholderSchema = z.object({
  name: z.string().min(1),
  ic_passport_registration_no: z.string().nullable().optional(),
  total_shares: z.number().nullable().optional(),
  is_verified: z.boolean().optional(),
});

vendorsRouter.post(
  "/:id/shareholders",
  asyncHandler(async (req, res) => {
    const vendorId = req.params.id;
    const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } });
    if (!vendor) throw new NotFoundError("Vendor not found");

    const body = shareholderSchema.parse(req.body);
    const shareholder = await prisma.ssmShareholder.create({
      data: {
        vendorId,
        name: body.name,
        icPassportRegistrationNo: body.ic_passport_registration_no,
        totalShares: body.total_shares,
        isVerified: body.is_verified ?? false,
      },
    });

    res.status(201).json(shareholder);
  })
);

vendorsRouter.put(
  "/:id/shareholders/:shareholderId",
  asyncHandler(async (req, res) => {
    const body = shareholderSchema.partial().parse(req.body);
    // Editing the actual content of an already-verified row must reopen it for
    // review — unless the same request explicitly re-confirms it.
    const touchesContent =
      body.name !== undefined ||
      body.ic_passport_registration_no !== undefined ||
      body.total_shares !== undefined;
    const isVerified = touchesContent && body.is_verified !== true ? false : body.is_verified;
    const result = await prisma.ssmShareholder.updateMany({
      where: { id: req.params.shareholderId, vendorId: req.params.id },
      data: {
        name: body.name,
        icPassportRegistrationNo: body.ic_passport_registration_no,
        totalShares: body.total_shares,
        isVerified,
      },
    });
    if (result.count === 0) throw new NotFoundError("Shareholder not found");

    const shareholder = await prisma.ssmShareholder.findUnique({
      where: { id: req.params.shareholderId },
    });
    res.json(shareholder);
  })
);

vendorsRouter.delete(
  "/:id/shareholders/:shareholderId",
  asyncHandler(async (req, res) => {
    const result = await prisma.ssmShareholder.deleteMany({
      where: { id: req.params.shareholderId, vendorId: req.params.id },
    });
    if (result.count === 0) throw new NotFoundError("Shareholder not found");
    res.status(204).send();
  })
);

// ---------------------------------------------------------------------------
// Module 2 - Screening Intelligence (VISTA_module2_system_prompt.md Section 3)
// ---------------------------------------------------------------------------

vendorsRouter.post(
  "/:id/ctos-enquiries",
  upload.single("file"),
  asyncHandler(async (req, res) => {
    const vendorId = req.params.id;
    const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } });
    if (!vendor) throw new NotFoundError("Vendor not found");
    if (!req.file) throw new ValidationError("file is required");

    const body = subjectUploadSchema.parse(req.body);
    const subject = await resolveSubject(vendorId, {
      subjectType: body.subject_type,
      relatedDirectorId: body.related_director_id,
      relatedShareholderId: body.related_shareholder_id,
    });

    const uploadedById = await getCurrentUserId();
    const document = await prisma.document.create({
      data: {
        vendorId,
        docType: "ctos_report",
        fileName: req.file.originalname,
        filePath: req.file.filename,
        uploadedById,
      },
    });

    const enquiry = await prisma.ctosEnquiry.create({
      data: {
        vendorId,
        subjectType: body.subject_type,
        subjectName: subject.subjectName,
        relatedDirectorId: subject.relatedDirectorId,
        relatedShareholderId: subject.relatedShareholderId,
        documentId: document.id,
      },
    });

    res.status(201).json(enquiry);
  })
);

vendorsRouter.get(
  "/:id/ctos-enquiries",
  asyncHandler(async (req, res) => {
    const vendor = await prisma.vendor.findUnique({ where: { id: req.params.id } });
    if (!vendor) throw new NotFoundError("Vendor not found");

    const enquiries = await prisma.ctosEnquiry.findMany({
      where: { vendorId: req.params.id },
      orderBy: { createdAt: "desc" },
      include: {
        document: true,
        financialHighlights: true,
        legalCases: true,
        tradeReferences: true,
      },
    });

    res.json(enquiries);
  })
);

vendorsRouter.post(
  "/:id/netreveal-records",
  upload.single("file"),
  asyncHandler(async (req, res) => {
    const vendorId = req.params.id;
    const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } });
    if (!vendor) throw new NotFoundError("Vendor not found");
    if (!req.file) throw new ValidationError("file is required");

    const body = subjectUploadSchema.parse(req.body);
    const subject = await resolveSubject(vendorId, {
      subjectType: body.subject_type,
      relatedDirectorId: body.related_director_id,
      relatedShareholderId: body.related_shareholder_id,
    });

    const uploadedById = await getCurrentUserId();
    const document = await prisma.document.create({
      data: {
        vendorId,
        docType: "netreveal_report",
        fileName: req.file.originalname,
        filePath: req.file.filename,
        uploadedById,
      },
    });

    const record = await prisma.netrevealRecord.create({
      data: {
        vendorId,
        subjectType: body.subject_type,
        subjectName: subject.subjectName,
        relatedDirectorId: subject.relatedDirectorId,
        relatedShareholderId: subject.relatedShareholderId,
        documentId: document.id,
      },
    });

    res.status(201).json(record);
  })
);

vendorsRouter.get(
  "/:id/screening",
  asyncHandler(async (req, res) => {
    const vendorId = req.params.id;
    const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } });
    if (!vendor) throw new NotFoundError("Vendor not found");

    const [financialHighlights, legalCases, tradeReferences, netrevealRecords, screeningSummary] =
      await Promise.all([
        prisma.ctosFinancialHighlights.findFirst({
          where: { ctosEnquiry: { vendorId, subjectType: "company" } },
          orderBy: { ctosEnquiry: { createdAt: "desc" } },
          include: {
            ctosEnquiry: { select: { id: true, subjectType: true, subjectName: true, createdAt: true } },
          },
        }),
        prisma.ctosLegalCase.findMany({
          where: { ctosEnquiry: { vendorId } },
          orderBy: { createdAt: "desc" },
          include: { ctosEnquiry: { select: { id: true, subjectType: true, subjectName: true } } },
        }),
        prisma.ctosTradeReference.findMany({
          where: { ctosEnquiry: { vendorId } },
          orderBy: { createdAt: "desc" },
          include: { ctosEnquiry: { select: { id: true, subjectType: true, subjectName: true } } },
        }),
        prisma.netrevealRecord.findMany({
          where: { vendorId },
          orderBy: { searchedAt: "desc" },
        }),
        prisma.screeningSummary.findFirst({
          where: { vendorId },
          orderBy: { generatedAt: "desc" },
        }),
      ]);

    res.json({
      financialHighlights,
      legalCases,
      tradeReferences,
      netrevealRecords,
      screeningSummary,
    });
  })
);

vendorsRouter.post(
  "/:id/screening-summary",
  asyncHandler(async (req, res) => {
    const vendorId = req.params.id;
    const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } });
    if (!vendor) throw new NotFoundError("Vendor not found");

    let result;
    try {
      result = await generateScreeningSummary(vendorId);
    } catch (err) {
      if (err instanceof SummaryGenerationError) {
        res.status(422).json({ error: err.message });
        return;
      }
      throw err;
    }

    const summary = await prisma.screeningSummary.create({
      data: {
        vendorId,
        summaryText: result.summaryText,
        generatedByModel: result.model,
      },
    });

    res.status(201).json(summary);
  })
);

// ---------------------------------------------------------------------------
// Module 3 - Adverse Media Screening Engine (VISTA_module3_system_prompt.md Section 3)
// ---------------------------------------------------------------------------

function extractDomain(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

// How many SERP queries / AI categorization calls run in flight at once for
// a single search. Kept low and env-tunable since SerpApi accounts typically
// cap concurrent requests well below the number of keywords a search can use.
const SERP_SEARCH_CONCURRENCY = Number(process.env.SERP_SEARCH_CONCURRENCY ?? 3);
const CATEGORIZATION_CONCURRENCY = Number(process.env.CATEGORIZATION_CONCURRENCY ?? 3);

const runAdverseMediaSearchSchema = z.object({
  subject_type: z.enum(SUBJECT_TYPES),
  related_director_id: z.string().uuid().nullable().optional(),
  related_shareholder_id: z.string().uuid().nullable().optional(),
  extra_keywords: z.array(z.string().min(1)).optional(),
  // Narrows which active library keywords are used (e.g. the reviewer
  // unchecked some pre-selected defaults in the search panel). Omit to use
  // every active keyword, which is also the fallback if this list is empty.
  keyword_ids: z.array(z.string().uuid()).optional(),
});

vendorsRouter.post(
  "/:id/adverse-media-searches",
  asyncHandler(async (req, res) => {
    const vendorId = req.params.id;
    const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } });
    if (!vendor) throw new NotFoundError("Vendor not found");

    const body = runAdverseMediaSearchSchema.parse(req.body);
    const subject = await resolveSubject(vendorId, {
      subjectType: body.subject_type,
      relatedDirectorId: body.related_director_id,
      relatedShareholderId: body.related_shareholder_id,
    });

    // keyword_ids omitted entirely -> no library filter (every active keyword).
    // keyword_ids explicitly [] -> the reviewer deliberately picked none from
    // the library, so use none, not every keyword - only true omission falls
    // back to "all".
    const activeKeywords = await prisma.adverseMediaKeywordLibrary.findMany({
      where: {
        isActive: true,
        ...(body.keyword_ids !== undefined ? { id: { in: body.keyword_ids } } : {}),
      },
      select: { keyword: true },
    });
    const keywordTerms = [...activeKeywords.map((k) => k.keyword), ...(body.extra_keywords ?? [])];
    if (keywordTerms.length === 0) {
      throw new ValidationError("Select at least one keyword, or provide extra_keywords");
    }

    const queries = keywordTerms.map((term) => `"${subject.subjectName}" ${term}`);
    const searchedById = await getCurrentUserId();

    // Run every query, then de-duplicate results by URL across all of them
    // before saving. Only a failure of the SERP call itself marks the search
    // 'failed' - per-article AI categorization failures are handled below and
    // never fail the whole run.
    // Bounded concurrency, not Promise.all - firing every keyword's query at
    // once tripped SerpApi's per-account concurrency limit once enough
    // keywords were selected, surfacing as a client-side timeout.
    let resultSets: SerpOrganicResult[][];
    try {
      resultSets = await mapWithConcurrency(queries, SERP_SEARCH_CONCURRENCY, (q) => searchGoogle(q));
    } catch (err) {
      const failedSearch = await prisma.adverseMediaSearch.create({
        data: {
          vendorId,
          subjectType: body.subject_type,
          subjectName: subject.subjectName,
          relatedDirectorId: subject.relatedDirectorId,
          relatedShareholderId: subject.relatedShareholderId,
          keywordsUsed: queries,
          searchStatus: "failed",
          searchedById,
        },
      });
      if (err instanceof SerpSearchError) {
        res.status(502).json({ error: err.message, search: failedSearch });
        return;
      }
      throw err;
    }

    const seenUrls = new Set<string>();
    const dedupedResults: SerpOrganicResult[] = [];
    for (const results of resultSets) {
      for (const result of results) {
        if (seenUrls.has(result.link)) continue;
        seenUrls.add(result.link);
        dedupedResults.push(result);
      }
    }

    // Also drop anything this vendor already has saved from an earlier
    // search - overlapping keywords (or the same keyword run again) often
    // resurface the same article. Checked before the AI summary step so a
    // known-duplicate URL never burns another categorization call.
    const existingUrls = await prisma.adverseMediaArticle.findMany({
      where: { vendorId, articleUrl: { in: dedupedResults.map((r) => r.link) } },
      select: { articleUrl: true },
    });
    const existingUrlSet = new Set(existingUrls.map((a) => a.articleUrl));
    const newResults = dedupedResults.filter((r) => !existingUrlSet.has(r.link));
    const duplicatesSkipped = dedupedResults.length - newResults.length;
    if (duplicatesSkipped > 0) {
      console.log(
        `Skipped ${duplicatesSkipped} article(s) already saved for vendor ${vendorId}`
      );
    }

    const search = await prisma.adverseMediaSearch.create({
      data: {
        vendorId,
        subjectType: body.subject_type,
        subjectName: subject.subjectName,
        relatedDirectorId: subject.relatedDirectorId,
        relatedShareholderId: subject.relatedShareholderId,
        keywordsUsed: queries,
        searchStatus: "completed",
        searchedById,
      },
    });

    // Layer 1: persist every article link straight from the SERP results,
    // before any AI call. This is the row that matters most to the reviewer
    // (the source link) and must survive even if the AI step below is
    // rate-limited or fails outright.
    if (newResults.length > 0) {
      await prisma.adverseMediaArticle.createMany({
        data: newResults.map((result) => ({
          searchId: search.id,
          vendorId,
          articleTitle: result.title,
          articleUrl: result.link,
          sourceDomain: result.source ?? extractDomain(result.link),
          categorizationStatus: "pending",
        })),
      });
    }

    const persistedArticles = await prisma.adverseMediaArticle.findMany({
      where: { searchId: search.id },
    });
    const snippetByUrl = new Map(newResults.map((r) => [r.link, r.snippet]));

    // Layer 2: retrieve the just-persisted articles and generate the AI
    // summary for each. A failure here (e.g. the AI provider is rate-limited)
    // only marks that one article's categorization as 'failed' - the article
    // itself, already saved above, is unaffected and still returned.
    await mapWithConcurrency(persistedArticles, CATEGORIZATION_CONCURRENCY, async (article) => {
      try {
        const category: CategorizationResult = await categorizeArticle({
          subjectName: subject.subjectName,
          title: article.articleTitle,
          url: article.articleUrl,
          sourceDomain: article.sourceDomain,
          snippet: snippetByUrl.get(article.articleUrl) ?? null,
        });
        await prisma.adverseMediaArticle.update({
          where: { id: article.id },
          data: {
            riskTheme: category.risk_theme,
            aiSummary: category.ai_summary,
            categorizationStatus: "completed",
          },
        });
      } catch (err) {
        console.error(`AI summary generation failed for ${article.articleUrl}:`, err);
        await prisma.adverseMediaArticle.update({
          where: { id: article.id },
          data: { categorizationStatus: "failed" },
        });
      }
    });

    const fullSearch = await prisma.adverseMediaSearch.findUnique({
      where: { id: search.id },
      include: { articles: true },
    });

    res.status(201).json({ ...fullSearch, duplicatesSkipped });
  })
);

vendorsRouter.get(
  "/:id/adverse-media-searches",
  asyncHandler(async (req, res) => {
    const vendor = await prisma.vendor.findUnique({ where: { id: req.params.id } });
    if (!vendor) throw new NotFoundError("Vendor not found");

    const searches = await prisma.adverseMediaSearch.findMany({
      where: { vendorId: req.params.id },
      orderBy: { searchedAt: "desc" },
      include: { _count: { select: { articles: true } } },
    });

    res.json(searches);
  })
);

// Main aggregate endpoint: every article for this vendor across all past
// searches, each tagged with which search/subject it came from. Returned
// flat (not pre-grouped) - the frontend groups by risk_theme or subject, same
// pattern as Module 2's legal cases / trade references.
vendorsRouter.get(
  "/:id/adverse-media",
  asyncHandler(async (req, res) => {
    const vendor = await prisma.vendor.findUnique({ where: { id: req.params.id } });
    if (!vendor) throw new NotFoundError("Vendor not found");

    const articles = await prisma.adverseMediaArticle.findMany({
      where: { vendorId: req.params.id },
      orderBy: { createdAt: "desc" },
      include: {
        search: { select: { id: true, subjectType: true, subjectName: true, searchedAt: true } },
      },
    });

    res.json(articles);
  })
);

// ---------------------------------------------------------------------------
// Module 4 - False Positive & True Hit Triage (VISTA_module4_system_prompt.md Section 3)
// ---------------------------------------------------------------------------

vendorsRouter.post(
  "/:id/triage/run",
  asyncHandler(async (req, res) => {
    const vendor = await prisma.vendor.findUnique({ where: { id: req.params.id } });
    if (!vendor) throw new NotFoundError("Vendor not found");

    const summary = await runTriageForVendor(vendor.id);
    res.json(summary);
  })
);

const triageQuerySchema = z.object({
  source_type: z.enum(SOURCE_TYPES).optional(),
  reviewer_final_decision: z.enum(["pending", "relevant", "false_positive"]).optional(),
});

vendorsRouter.get(
  "/:id/triage",
  asyncHandler(async (req, res) => {
    const vendor = await prisma.vendor.findUnique({ where: { id: req.params.id } });
    if (!vendor) throw new NotFoundError("Vendor not found");

    const query = triageQuerySchema.parse(req.query);

    const results = await prisma.riskTriageResult.findMany({
      where: {
        vendorId: req.params.id,
        sourceType: query.source_type,
        reviewerFinalDecision: query.reviewer_final_decision,
      },
      orderBy: { confidenceScore: "desc" },
    });

    res.json(results);
  })
);

// ---------------------------------------------------------------------------
// Module 5 - GEN AI Smart KYV Report Generation (VISTA_module5_system_prompt.md Section 3)
// ---------------------------------------------------------------------------

vendorsRouter.post(
  "/:id/kyv-reports",
  asyncHandler(async (req, res) => {
    const vendor = await prisma.vendor.findUnique({ where: { id: req.params.id } });
    if (!vendor) throw new NotFoundError("Vendor not found");

    const { report, warnings } = await generateKyvReport(vendor.id);
    res.status(201).json({ ...report, warnings });
  })
);

vendorsRouter.get(
  "/:id/kyv-reports",
  asyncHandler(async (req, res) => {
    const vendor = await prisma.vendor.findUnique({ where: { id: req.params.id } });
    if (!vendor) throw new NotFoundError("Vendor not found");

    const reports = await prisma.kyvReport.findMany({
      where: { vendorId: req.params.id },
      orderBy: { generatedAt: "desc" },
      include: { template: { select: { name: true, version: true } } },
    });

    res.json(reports);
  })
);
