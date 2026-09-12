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

  await prisma.ctosEnquiry.create({
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

  await prisma.ctosEnquiry.create({
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

  await prisma.netrevealRecord.create({
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
  await prisma.adverseMediaSearch.create({
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
            // reviewerDecision left unset -> defaults to "pending".
          },
        ],
      },
    },
  });

  // Vendor 2: freshly extracted, still awaiting reviewer confirmation on
  // everything except corporate info - shows the "AI-extracted" UI state.
  await prisma.vendor.create({
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
