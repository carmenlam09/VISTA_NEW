export const KYV_REPORT_STATUSES = [
  "draft",
  "pending_checker_review",
  "approved",
  "rejected",
] as const;
export type KyvReportStatus = (typeof KYV_REPORT_STATUSES)[number];

export interface KyvReportTemplateRef {
  name: string;
  version: string;
}

export interface KyvReportSummary {
  id: string;
  vendorId: string;
  templateId: string;
  status: KyvReportStatus;
  preparedById: string | null;
  reviewedById: string | null;
  reviewedAt: string | null;
  reviewerComments: string | null;
  generatedAt: string;
  generatedByModel: string | null;
  template: KyvReportTemplateRef;
}

export interface KyvReportSection {
  id: string;
  reportId: string;
  sectionKey: string;
  title: string;
  content: string;
  sectionOrder: number;
  isEdited: boolean;
  updatedAt: string;
}

export interface KyvReportDetail extends KyvReportSummary {
  sections: KyvReportSection[];
}

export interface GenerateKyvReportResult extends KyvReportDetail {
  warnings: string[];
}
