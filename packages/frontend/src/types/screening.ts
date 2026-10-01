export type SubjectType = "company" | "director" | "shareholder";

export interface Subject {
  id: string;
  type: SubjectType;
  name: string;
}

export interface EnquirySubjectRef {
  id: string;
  subjectType: SubjectType;
  subjectName: string;
  createdAt?: string;
}

export interface CtosFinancialHighlights {
  id: string;
  ctosEnquiryId: string;
  totalIssuedOrdinary: string | null;
  totalIssuedPreference: string | null;
  totalIssuedOthers: string | null;
  revenueTurnover: string | null;
  netIncome: string | null;
  currentAssets: string | null;
  currentLiabilities: string | null;
  currentRatio: string | null;
  debtToEquityRatio: string | null;
  isVerified: boolean;
  updatedAt: string;
  ctosEnquiry?: EnquirySubjectRef;
}

export type LegalCaseType = "defendant" | "plaintiff";

export type RiskDecision = "pending" | "relevant" | "false_positive";

export interface CtosLegalCase {
  id: string;
  ctosEnquiryId: string;
  caseType: LegalCaseType;
  plaintiff: string | null;
  defendant: string | null;
  caseNo: string | null;
  remark: string | null;
  isVerified: boolean;
  createdAt: string;
  riskDecision: RiskDecision;
  ctosEnquiry?: EnquirySubjectRef;
}

export interface CtosTradeReference {
  id: string;
  ctosEnquiryId: string;
  referee: string | null;
  accountNo: string | null;
  capacity: string | null;
  statementDate: string | null;
  defaultAmount: string | null;
  isVerified: boolean;
  createdAt: string;
  ctosEnquiry?: EnquirySubjectRef;
}

export interface DocumentRef {
  id: string;
  fileName: string;
  uploadStatus: "uploaded" | "extracting" | "extracted" | "failed";
  rawExtractionJson: unknown;
}

export interface CtosEnquiry {
  id: string;
  vendorId: string;
  subjectType: SubjectType;
  subjectName: string;
  relatedDirectorId: string | null;
  relatedShareholderId: string | null;
  documentId: string;
  enquiryDate: string | null;
  createdAt: string;
  document?: DocumentRef;
  financialHighlights: CtosFinancialHighlights | null;
  legalCases: CtosLegalCase[];
  tradeReferences: CtosTradeReference[];
}

export interface NetrevealRecord {
  id: string;
  vendorId: string;
  subjectType: SubjectType;
  subjectName: string;
  relatedDirectorId: string | null;
  relatedShareholderId: string | null;
  documentId: string;
  dobDoi: string | null;
  nationality: string | null;
  checkName: string | null;
  uid: string | null;
  watchpersonDetails: string | null;
  isVerified: boolean;
  searchedAt: string;
  riskDecision: RiskDecision;
  document?: DocumentRef;
}

export interface ScreeningSummary {
  id: string;
  vendorId: string;
  summaryText: string;
  generatedAt: string;
  generatedByModel: string | null;
}

export interface ScreeningAggregate {
  financialHighlights: CtosFinancialHighlights | null;
  legalCases: CtosLegalCase[];
  tradeReferences: CtosTradeReference[];
  netrevealRecords: NetrevealRecord[];
  screeningSummary: ScreeningSummary | null;
}
