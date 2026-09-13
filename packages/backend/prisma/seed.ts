import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";

import { PrismaClient } from "@prisma/client";

import { UPLOAD_DIR } from "../src/middleware/upload";
import { buildMinimalPdf } from "./seedPdf";

const prisma = new PrismaClient();

function writeSeedPdf(lines: string[]): string {
  const fileName = `${randomUUID()}.pdf`;
  fs.writeFileSync(path.join(UPLOAD_DIR, fileName), buildMinimalPdf(lines));
  return fileName;
}

async function main() {
  const reviewer = await prisma.user.upsert({
    where: { email: "reviewer@vista.local" },
    update: {},
    create: {
      name: "Default Reviewer",
      email: "reviewer@vista.local",
      role: "reviewer",
    },
  });

  // Sample keyword library (a couple of entries per risk theme) so Adverse
  // Media searches have real defaults to work with out of the box. Reset on
  // every run for the same repeatability reason as the seed vendors below.
  const seedKeywords: { keyword: string; riskTheme: string }[] = [
    { keyword: "money laundering", riskTheme: "financial_crime" },
    { keyword: "embezzlement", riskTheme: "financial_crime" },
    { keyword: "sanctions", riskTheme: "sanctions" },
    { keyword: "OFAC", riskTheme: "sanctions" },
    { keyword: "fraud", riskTheme: "fraud" },
    { keyword: "scam", riskTheme: "fraud" },
    { keyword: "regulatory breach", riskTheme: "regulatory_breach" },
    { keyword: "compliance violation", riskTheme: "regulatory_breach" },
    { keyword: "tax evasion", riskTheme: "tax_offence" },
    { keyword: "tax fraud", riskTheme: "tax_offence" },
    { keyword: "environmental violation", riskTheme: "esg" },
    { keyword: "forced labor", riskTheme: "esg" },
    { keyword: "data breach", riskTheme: "operational_risk" },
    { keyword: "cyber attack", riskTheme: "operational_risk" },
    { keyword: "lawsuit", riskTheme: "other" },
    { keyword: "controversy", riskTheme: "other" },
  ];
  await prisma.adverseMediaKeywordLibrary.deleteMany({
    where: { keyword: { in: seedKeywords.map((k) => k.keyword) } },
  });
  await prisma.adverseMediaKeywordLibrary.createMany({
    data: seedKeywords.map((k) => ({ keyword: k.keyword, riskTheme: k.riskTheme })),
  });

  // Default placeholder report template (Module 5 Section 2) - the bank
  // doesn't have a real KYV template yet, so this is what POST /kyv-reports
  // uses until someone adds a real one and activates it. Upsert by
  // name+version rather than delete+recreate: kyv_reports.template_id is
  // ON DELETE RESTRICT, so deleting this row would fail once any report has
  // ever been generated against it.
  const kyvTemplateName = "Standard KYV Report (Placeholder)";
  const kyvTemplateVersion = "v1";
  const kyvTemplateSections = [
    {
      section_key: "executive_summary",
      title: "Executive Summary",
      instructions: "One paragraph overview of the vendor and the overall risk conclusion.",
    },
    {
      section_key: "corporate_profile",
      title: "Corporate Profile",
      instructions: "Summarize Module 1 corporate info, directors, and shareholders.",
    },
    {
      section_key: "financial_summary",
      title: "Financial Summary",
      instructions: "Summarize CTOS financial highlights and any notable ratios or trends.",
    },
    {
      section_key: "legal_regulatory_findings",
      title: "Legal & Regulatory Findings",
      instructions:
        "Summarize confirmed-relevant CTOS legal cases and any NetReveal watchlist hits.",
    },
    {
      section_key: "adverse_media_findings",
      title: "Adverse Media Findings",
      instructions: "Summarize confirmed-relevant adverse media articles, grouped by risk theme.",
    },
    {
      section_key: "risk_assessment_recommendation",
      title: "Risk Assessment & Recommendation",
      instructions:
        "Overall risk narrative and a recommendation (approve / approve with conditions / escalate / decline), justified by the findings above.",
    },
  ];

  const existingKyvTemplate = await prisma.reportTemplate.findFirst({
    where: { name: kyvTemplateName, version: kyvTemplateVersion },
  });
  const kyvTemplate = existingKyvTemplate
    ? await prisma.reportTemplate.update({
        where: { id: existingKyvTemplate.id },
        data: { sections: kyvTemplateSections, isActive: true },
      })
    : await prisma.reportTemplate.create({
        data: {
          name: kyvTemplateName,
          version: kyvTemplateVersion,
          isActive: true,
          sections: kyvTemplateSections,
        },
      });
  // Exactly one active template after seeding, even if an earlier run left
  // some other template (e.g. a real one added via the admin API) active.
  await prisma.reportTemplate.updateMany({
    where: { id: { not: kyvTemplate.id } },
    data: { isActive: false },
  });

  // Reset seed vendors on every run so `npm run db:seed` stays repeatable in
  // local dev. Cascades clean up their documents/SSM/screening rows in the
  // database, but not the uploaded files on disk - remove those first.
  const seedVendorNames = [
    "Nexa Innovations Sdn Bhd",
    "Bright Pathway Trading Sdn Bhd",
    "Golden Harvest Logistics Sdn Bhd",
  ];
  const staleDocuments = await prisma.document.findMany({
    where: { vendor: { companyName: { in: seedVendorNames } } },
    select: { filePath: true },
  });
  for (const doc of staleDocuments) {
    fs.rmSync(path.join(UPLOAD_DIR, doc.filePath), { force: true });
  }
  await prisma.vendor.deleteMany({ where: { companyName: { in: seedVendorNames } } });

  // Vendor 1: fully reviewed and approved - every Module 1 section verified.
  const nexa = await prisma.vendor.create({
    data: {
      companyName: "Nexa Innovations Sdn Bhd",
      registrationNo: "201801012345",
      status: "approved",
      createdById: reviewer.id,
      corporateInfo: {
        create: {
          companyName: "NEXA INNOVATIONS SDN BHD",
          dateOfIncorporation: new Date("2018-02-14"),
          companyStatus: "Active",
          natureOfBusiness: "Information technology consulting and systems integration",
          isVerified: true,
        },
      },
      shareCapital: {
        create: { paidUpCapital: 500000, isVerified: true },
      },
      directors: {
        create: [
          {
            name: "Wong Kah Meng",
            icPassportNo: "850322-10-5432",
            designation: "Director",
            isVerified: true,
          },
          {
            name: "Priya A/P Ramasamy",
            icPassportNo: "900715-14-2211",
            designation: "Director",
            isVerified: true,
          },
        ],
      },
      shareholders: {
        create: [
          {
            icPassportRegistrationNo: "850322-10-5432",
            name: "Wong Kah Meng",
            totalShares: 300000,
            isVerified: true,
          },
          {
            icPassportRegistrationNo: "900715-14-2211",
            name: "Priya A/P Ramasamy",
            totalShares: 200000,
            isVerified: true,
          },
        ],
      },
    },
    include: { directors: true },
  });

  const wong = nexa.directors.find((d) => d.name === "Wong Kah Meng")!;

  // Module 2 sample data for Nexa: a fully-verified company CTOS enquiry, a
  // still-unverified director CTOS enquiry (shows the "AI-extracted, needs
  // review" state), and a director NetReveal search with a watchlist hit.
  const ctosCompanyDoc = await prisma.document.create({
    data: {
      vendorId: nexa.id,
      docType: "ctos_report",
      fileName: "ctos_report_nexa_company.pdf",
      filePath: writeSeedPdf([
        "CTOS Business Report",
        "Subject: Nexa Innovations Sdn Bhd (Company)",
        "Seed demo document",
      ]),
      uploadStatus: "extracted",
      uploadedById: reviewer.id,
      rawExtractionJson: {
        financial_highlights: {
          total_issued_ordinary: 500000,
          total_issued_preference: 0,
          total_issued_others: 0,
          revenue_turnover: 2340000,
          net_income: 187000,
          current_assets: 890000,
          current_liabilities: 410000,
          current_ratio: 2.17,
          debt_to_equity_ratio: 0.45,
        },
        legal_cases: [
          {
            case_type: "defendant",
            plaintiff: "ABC Supplies Sdn Bhd",
            defendant: "Nexa Innovations Sdn Bhd",
            case_no: "WA-22NCVC-1234-2023",
            remark: "Breach of contract claim, ongoing",
          },
          {
            case_type: "plaintiff",
            plaintiff: "Nexa Innovations Sdn Bhd",
            defendant: "XYZ Trading Sdn Bhd",
            case_no: "WA-22NCVC-5678-2024",
            remark: "Claim for unpaid invoices",
          },
        ],
        trade_references: [
          {
            referee: "Maju Supplies Sdn Bhd",
            account_no: "ACC-88213",
            capacity: "Trade Supplier",
            statement_date: "2024-03-15",
            default_amount: 0,
          },
          {
            referee: "Bintang Distributors Sdn Bhd",
            account_no: "ACC-99120",
            capacity: "Trade Supplier",
            statement_date: "2024-02-01",
            default_amount: 1500,
          },
        ],
      },
    },
  });

  const ctosCompanyEnquiry = await prisma.ctosEnquiry.create({
    data: {
      vendorId: nexa.id,
      subjectType: "company",
      subjectName: nexa.companyName,
      documentId: ctosCompanyDoc.id,
      financialHighlights: {
        create: {
          totalIssuedOrdinary: 500000,
          totalIssuedPreference: 0,
          totalIssuedOthers: 0,
          revenueTurnover: 2340000,
          netIncome: 187000,
          currentAssets: 890000,
          currentLiabilities: 410000,
          currentRatio: 2.17,
          debtToEquityRatio: 0.45,
          isVerified: true,
        },
      },
      legalCases: {
        create: [
          {
            caseType: "defendant",
            plaintiff: "ABC Supplies Sdn Bhd",
            defendant: "Nexa Innovations Sdn Bhd",
            caseNo: "WA-22NCVC-1234-2023",
            remark: "Breach of contract claim, ongoing",
            isVerified: true,
          },
          {
            caseType: "plaintiff",
            plaintiff: "Nexa Innovations Sdn Bhd",
            defendant: "XYZ Trading Sdn Bhd",
            caseNo: "WA-22NCVC-5678-2024",
            remark: "Claim for unpaid invoices",
            isVerified: true,
          },
        ],
      },
      tradeReferences: {
        create: [
          {
            referee: "Maju Supplies Sdn Bhd",
            accountNo: "ACC-88213",
            capacity: "Trade Supplier",
            statementDate: new Date("2024-03-15"),
            defaultAmount: 0,
            isVerified: true,
          },
          {
            referee: "Bintang Distributors Sdn Bhd",
            accountNo: "ACC-99120",
            capacity: "Trade Supplier",
            statementDate: new Date("2024-02-01"),
            defaultAmount: 1500,
            isVerified: true,
          },
        ],
      },
    },
    include: { legalCases: true },
  });

  const ctosDirectorDoc = await prisma.document.create({
    data: {
      vendorId: nexa.id,
      docType: "ctos_report",
      fileName: "ctos_report_wong_kah_meng.pdf",
      filePath: writeSeedPdf([
        "CTOS Business Report",
        "Subject: Wong Kah Meng (Director)",
        "Seed demo document",
      ]),
      uploadStatus: "extracted",
      uploadedById: reviewer.id,
      rawExtractionJson: {
        financial_highlights: {
          total_issued_ordinary: null,
          total_issued_preference: null,
          total_issued_others: null,
          revenue_turnover: null,
          net_income: null,
          current_assets: null,
          current_liabilities: null,
          current_ratio: null,
          debt_to_equity_ratio: null,
        },
        legal_cases: [
          {
            case_type: "defendant",
            plaintiff: "ABC Supplies Sdn Bhd",
            defendant: "Nexa Innovations Sdn Bhd",
            case_no: "WA-22NCVC-1234-2023",
            remark: "Breach of contract claim, ongoing",
          },
        ],
        trade_references: [],
      },
    },
  });

  const ctosDirectorEnquiry = await prisma.ctosEnquiry.create({
    data: {
      vendorId: nexa.id,
      subjectType: "director",
      subjectName: wong.name,
      relatedDirectorId: wong.id,
      documentId: ctosDirectorDoc.id,
      // Left unverified on purpose - demonstrates the "AI-extracted, needs
      // review" state without any manual clicking required.
      legalCases: {
        create: [
          {
            caseType: "defendant",
            plaintiff: "ABC Supplies Sdn Bhd",
            defendant: "Nexa Innovations Sdn Bhd",
            caseNo: "WA-22NCVC-1234-2023",
            remark: "Breach of contract claim, ongoing",
            isVerified: false,
          },
        ],
      },
    },
    include: { legalCases: true },
  });

  const netrevealDoc = await prisma.document.create({
    data: {
      vendorId: nexa.id,
      docType: "netreveal_report",
      fileName: "netreveal_wong_kah_meng.pdf",
      filePath: writeSeedPdf([
        "NetReveal Watchlist Search Result",
        "Subject: Wong Kah Meng (Director)",
        "Seed demo document",
      ]),
      uploadStatus: "extracted",
      uploadedById: reviewer.id,
      rawExtractionJson: {
        dob_doi: "1985-03-22",
        nationality: "Malaysian",
        check_name: "Wong Kah Meng",
        uid: "850322-10-5432",
        watchperson_details:
          "Potential match: listed on a 2019 regulatory enforcement notice for a separate unrelated directorship (Company B, since resolved). Not a sanctions list match. Reviewer to confirm relevance.",
      },
    },
  });

  const netrevealRecord = await prisma.netrevealRecord.create({
    data: {
      vendorId: nexa.id,
      subjectType: "director",
      subjectName: wong.name,
      relatedDirectorId: wong.id,
      documentId: netrevealDoc.id,
      dobDoi: new Date("1985-03-22"),
      nationality: "Malaysian",
      checkName: wong.name,
      uid: wong.icPassportNo,
      watchpersonDetails:
        "Potential match: listed on a 2019 regulatory enforcement notice for a separate unrelated directorship (Company B, since resolved). Not a sanctions list match. Reviewer to confirm relevance.",
      isVerified: true,
    },
  });

  await prisma.screeningSummary.create({
    data: {
      vendorId: nexa.id,
      summaryText:
        "Nexa Innovations Sdn Bhd (Reg: 201801012345) is an active, verified IT consulting and systems integration firm with a paid-up capital of MYR 500,000. Financial highlights show a healthy profile: revenue of MYR 2,340,000, net income of MYR 187,000, a current ratio of 2.17, and a conservative debt-to-equity ratio of 0.45. The company carries moderate legal exposure - a defendant in one ongoing breach-of-contract claim (Case WA-22NCVC-1234-2023) and a plaintiff in another (Case WA-22NCVC-5678-2024). NetReveal screening flagged a watchlist detail for Director Wong Kah Meng relating to a resolved, unrelated 2019 regulatory matter - not a sanctions hit, but flagged for reviewer confirmation.",
      generatedByModel: null,
    },
  });

  // Module 3 sample data for Nexa: one completed company-subject search with
  // three articles spanning all three reviewer_decision states - a resolved
  // false positive, a confirmed relevant finding, and one left pending (on
  // a high-sensitivity theme) to demonstrate the Vendor Profile's unresolved
  // sanctions/financial-crime flag without any manual clicking required.
  const adverseMediaSearchNexa = await prisma.adverseMediaSearch.create({
    data: {
      vendorId: nexa.id,
      subjectType: "company",
      subjectName: nexa.companyName,
      keywordsUsed: [
        '"Nexa Innovations Sdn Bhd" fraud',
        '"Nexa Innovations Sdn Bhd" sanctions',
        '"Nexa Innovations Sdn Bhd" regulatory breach',
      ],
      searchStatus: "completed",
      searchedById: reviewer.id,
      articles: {
        create: [
          {
            vendorId: nexa.id,
            articleTitle: "Tech Innovators Recognized at Industry Awards Night",
            articleUrl: "https://example.com/news/industry-awards-nexa",
            sourceDomain: "example.com",
            riskTheme: "other",
            aiSummary:
              "This article covers an unrelated technology company with a similar name receiving an industry award; it does not concern Nexa Innovations Sdn Bhd.",
            categorizationStatus: "completed",
            reviewerDecision: "false_positive",
            reviewedById: reviewer.id,
            reviewedAt: new Date(),
          },
          {
            vendorId: nexa.id,
            articleTitle: "Regulator Issues Notice on Data Handling Practices in IT Sector",
            articleUrl: "https://example.com/news/regulatory-notice-it-sector",
            sourceDomain: "example.com",
            riskTheme: "regulatory_breach",
            aiSummary:
              "A sector regulator issued a compliance notice concerning data handling practices at systems integration firms, naming Nexa Innovations Sdn Bhd among those under review.",
            categorizationStatus: "completed",
            reviewerDecision: "relevant",
            reviewedById: reviewer.id,
            reviewedAt: new Date(),
          },
          {
            vendorId: nexa.id,
            articleTitle: "Screening Tool Flags Partial Name Match on Watchlist",
            articleUrl: "https://example.com/news/sanctions-screening-flag",
            sourceDomain: "example.com",
            riskTheme: "sanctions",
            aiSummary:
              "An automated sanctions screening tool returned a partial name match for a similarly-named company; not yet confirmed whether this refers to the same entity.",
            categorizationStatus: "completed",
            // reviewerDecision left unset -> defaults to "pending".
          },
        ],
      },
    },
    include: { articles: true },
  });

  // Module 4 sample data for Nexa: pre-baked risk_triage_results for a mix
  // of the still-pending findings above (one per source type, plus a couple
  // more), so the Triage Queue has a realistic confidence spread to demo
  // sort order immediately - same reasoning as the hardcoded AI Summary and
  // article ai_summary text above: seed data shouldn't depend on a live AI
  // call. A reviewer can still click "Run Triage" to refresh these.
  const ctosCompanyDefendantCase = ctosCompanyEnquiry.legalCases.find(
    (c) => c.caseType === "defendant"
  )!;
  const ctosCompanyPlaintiffCase = ctosCompanyEnquiry.legalCases.find(
    (c) => c.caseType === "plaintiff"
  )!;
  const ctosDirectorCase = ctosDirectorEnquiry.legalCases[0];
  const pendingArticle = adverseMediaSearchNexa.articles.find(
    (a) => a.reviewerDecision === "pending"
  )!;

  await prisma.riskTriageResult.createMany({
    data: [
      {
        vendorId: nexa.id,
        sourceType: "ctos_legal_case",
        sourceRecordId: ctosCompanyDefendantCase.id,
        subjectType: "company",
        subjectName: nexa.companyName,
        confidenceScore: 78,
        aiRationale:
          "Nexa Innovations Sdn Bhd is named directly as defendant in an ongoing breach-of-contract case, an exact name match with no ambiguity. No prior triage history or cross-vendor links exist for this identity, but an active, unresolved legal case against the company itself is a concrete, current risk signal.",
        suggestedDecision: "relevant",
      },
      {
        vendorId: nexa.id,
        sourceType: "netreveal",
        sourceRecordId: netrevealRecord.id,
        subjectType: "director",
        subjectName: wong.name,
        confidenceScore: 62,
        aiRationale:
          "Exact name, IC number, and nationality match support a real connection to Wong Kah Meng, but the watchlist detail itself references a separate, resolved 2019 directorship with no sanctions link. A related CTOS legal case for the same company adds some weight, so human confirmation is warranted rather than an automatic dismissal.",
        suggestedDecision: "needs_review",
      },
      {
        vendorId: nexa.id,
        sourceType: "adverse_media",
        sourceRecordId: pendingArticle.id,
        subjectType: "company",
        subjectName: nexa.companyName,
        confidenceScore: 45,
        aiRationale:
          "The sanctions screening tool returned only a partial name match against a similarly-named company, and it is not yet confirmed whether this refers to Nexa Innovations Sdn Bhd at all. Given the ambiguity and the high-sensitivity sanctions theme, this needs a reviewer's judgement rather than an automatic call.",
        suggestedDecision: "needs_review",
      },
      {
        vendorId: nexa.id,
        sourceType: "ctos_legal_case",
        sourceRecordId: ctosDirectorCase.id,
        subjectType: "director",
        subjectName: wong.name,
        confidenceScore: 30,
        aiRationale:
          "This case lists the company, not Wong Kah Meng personally, as defendant, and the record is still unverified. The director's personal exposure here is indirect at best, so this is unlikely to represent a genuine individual risk.",
        suggestedDecision: "false_positive",
      },
      {
        vendorId: nexa.id,
        sourceType: "ctos_legal_case",
        sourceRecordId: ctosCompanyPlaintiffCase.id,
        subjectType: "company",
        subjectName: nexa.companyName,
        confidenceScore: 20,
        aiRationale:
          "Nexa Innovations Sdn Bhd is the plaintiff pursuing an unpaid-invoices claim, not a defendant - this reflects the company protecting its own receivables rather than facing legal exposure, so it is unlikely to represent a genuine compliance risk.",
        suggestedDecision: "false_positive",
      },
    ],
  });

  // Module 6/7 (Knowledge Repository) Section 6: finalize a couple of these
  // triage decisions on seed - mirrors what PUT /risk-triage/:id/decision
  // does (sync risk_triage_results and the underlying source row together)
  // so there's real finalized data ready to reindex and search immediately,
  // without needing to click through the Triage queue first.
  const finalizedReviewedAt = new Date();
  await prisma.riskTriageResult.updateMany({
    where: { sourceType: "ctos_legal_case", sourceRecordId: ctosCompanyDefendantCase.id },
    data: {
      reviewerFinalDecision: "relevant",
      reviewedById: reviewer.id,
      reviewedAt: finalizedReviewedAt,
    },
  });
  await prisma.ctosLegalCase.update({
    where: { id: ctosCompanyDefendantCase.id },
    data: { riskDecision: "relevant" },
  });
  await prisma.riskTriageResult.updateMany({
    where: { sourceType: "ctos_legal_case", sourceRecordId: ctosDirectorCase.id },
    data: {
      reviewerFinalDecision: "false_positive",
      reviewedById: reviewer.id,
      reviewedAt: finalizedReviewedAt,
    },
  });
  await prisma.ctosLegalCase.update({
    where: { id: ctosDirectorCase.id },
    data: { riskDecision: "false_positive" },
  });

  // Vendor 2: freshly extracted, still awaiting reviewer confirmation on
  // everything except corporate info - shows the "AI-extracted" UI state.
  const brightPathway = await prisma.vendor.create({
    data: {
      companyName: "Bright Pathway Trading Sdn Bhd",
      registrationNo: "201502987654",
      status: "in_review",
      createdById: reviewer.id,
      corporateInfo: {
        create: {
          companyName: "BRIGHT PATHWAY TRADING SDN BHD",
          formerCompanyName: "PATHWAY TRADING SDN BHD",
          dateOfNameChange: new Date("2019-08-01"),
          dateOfIncorporation: new Date("2015-05-20"),
          companyStatus: "Active",
          natureOfBusiness: "General trading and distribution of consumer goods",
          isVerified: true,
        },
      },
      shareCapital: {
        create: { paidUpCapital: 250000, isVerified: false },
      },
      directors: {
        create: [
          {
            name: "Ahmad Faizal bin Ismail",
            icPassportNo: "780909-05-6677",
            designation: "Director",
            isVerified: false,
          },
        ],
      },
      shareholders: {
        create: [
          {
            icPassportRegistrationNo: "780909-05-6677",
            name: "Ahmad Faizal bin Ismail",
            totalShares: 150000,
            isVerified: false,
          },
          {
            icPassportRegistrationNo: "820101-08-3344",
            name: "Lee Chin Hwa",
            totalShares: 100000,
            isVerified: false,
          },
        ],
      },
    },
  });

  // Module 5/6/7 sample data for Bright Pathway: one already-approved KYV
  // report, so there's a second vendor's worth of indexed data alongside
  // Nexa's triage decisions above - together they demo cross-vendor
  // retrieval (VISTA_module6_system_prompt.md Section 6) once reindexed.
  await prisma.kyvReport.create({
    data: {
      vendorId: brightPathway.id,
      templateId: kyvTemplate.id,
      status: "approved",
      preparedById: reviewer.id,
      reviewedById: reviewer.id,
      reviewedAt: new Date(),
      generatedByModel: "openai/gpt-oss-120b",
      sections: {
        create: [
          {
            sectionKey: "executive_summary",
            title: "Executive Summary",
            content:
              "Bright Pathway Trading Sdn Bhd (Reg. No. 201502987654) is an active Malaysian general trading and distribution company, renamed from Pathway Trading Sdn Bhd in 2019. It is closely held by its sole director, Ahmad Faizal bin Ismail (150,000 shares), and one other shareholder, Lee Chin Hwa (100,000 shares). No CTOS financial data, legal cases, NetReveal hits, or adverse media findings have been identified for this vendor. Overall risk is assessed as low, with the main gap being that the director's and shareholders' identities are not yet independently verified.",
            sectionOrder: 0,
          },
          {
            sectionKey: "corporate_profile",
            title: "Corporate Profile",
            content:
              "The company was incorporated on 20 May 2015 and changed its name from Pathway Trading Sdn Bhd to Bright Pathway Trading Sdn Bhd on 1 August 2019. Its stated business is general trading and distribution of consumer goods, and its corporate registration record is verified. The sole director, Ahmad Faizal bin Ismail (IC 780909-05-6677), also holds 150,000 of the company's 250,000 total shares; the remaining 100,000 shares are held by Lee Chin Hwa (IC 820101-08-3344). Neither the director nor the shareholders have been independently verified against supporting identification documents.",
            sectionOrder: 1,
          },
          {
            sectionKey: "financial_summary",
            title: "Financial Summary",
            content:
              "No CTOS financial highlights have been submitted for Bright Pathway Trading Sdn Bhd, so no revenue, profitability, or liquidity ratios are available for this review.",
            sectionOrder: 2,
          },
          {
            sectionKey: "legal_regulatory_findings",
            title: "Legal & Regulatory Findings",
            content:
              "No confirmed-relevant CTOS legal cases or NetReveal watchlist hits have been recorded for Bright Pathway Trading Sdn Bhd or its director and shareholders.",
            sectionOrder: 3,
          },
          {
            sectionKey: "adverse_media_findings",
            title: "Adverse Media Findings",
            content: "No confirmed-relevant adverse media articles have been identified for Bright Pathway Trading Sdn Bhd.",
            sectionOrder: 4,
          },
          {
            sectionKey: "risk_assessment_recommendation",
            title: "Risk Assessment & Recommendation",
            content:
              "Bright Pathway Trading Sdn Bhd presents a low commercial risk profile: there are no legal, regulatory, or reputational findings on record. The principal residual risk is the lack of independent verification for the director and both shareholders, which is a standard onboarding gap rather than a sign of misconduct. Recommendation: approve the vendor subject to conditions - obtain verified identification documents for Ahmad Faizal bin Ismail and Lee Chin Hwa, and request recent financial statements to establish a baseline for future monitoring.",
            sectionOrder: 5,
          },
        ],
      },
    },
  });

  // Vendor 3: brand new - no documents or SSM data yet, shows the empty
  // intake state.
  await prisma.vendor.create({
    data: {
      companyName: "Golden Harvest Logistics Sdn Bhd",
      status: "draft",
      createdById: reviewer.id,
    },
  });
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
