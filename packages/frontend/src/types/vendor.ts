export type DocType = "ssm_report" | "supplier_registration_form" | "vendor_confirmation_letter";
export type UploadStatus = "uploaded" | "extracting" | "extracted" | "failed";

export interface DocumentRecord {
  id: string;
  vendorId: string;
  docType: DocType;
  fileName: string;
  filePath: string;
  uploadStatus: UploadStatus;
  rawExtractionJson: unknown;
  uploadedById: string | null;
  uploadedAt: string;
}

export interface SsmCorporateInfo {
  id: string;
  vendorId: string;
  documentId: string | null;
  companyName: string | null;
  formerCompanyName: string | null;
  dateOfNameChange: string | null;
  dateOfIncorporation: string | null;
  companyStatus: string | null;
  natureOfBusiness: string | null;
  isVerified: boolean;
  updatedAt: string;
}

export interface SsmShareCapital {
  id: string;
  vendorId: string;
  documentId: string | null;
  // Prisma Decimal serializes to a JSON string.
  paidUpCapital: string | null;
  isVerified: boolean;
  updatedAt: string;
}

export interface SsmDirector {
  id: string;
  vendorId: string;
  documentId: string | null;
  name: string;
  icPassportNo: string | null;
  designation: string | null;
  isVerified: boolean;
  createdAt: string;
}

export interface SsmShareholder {
  id: string;
  vendorId: string;
  documentId: string | null;
  icPassportRegistrationNo: string | null;
  name: string;
  totalShares: string | null;
  isVerified: boolean;
  createdAt: string;
}

export interface VendorSummary {
  id: string;
  companyName: string;
  registrationNo: string | null;
  status: string;
  createdAt: string;
}

export interface VendorDetail extends VendorSummary {
  createdById: string | null;
  updatedAt: string;
  documents: DocumentRecord[];
  corporateInfo: SsmCorporateInfo | null;
  shareCapital: SsmShareCapital | null;
  directors: SsmDirector[];
  shareholders: SsmShareholder[];
}
