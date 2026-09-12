-- CreateTable
CREATE TABLE "ctos_enquiries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "vendor_id" UUID NOT NULL,
    "subject_type" VARCHAR(20) NOT NULL,
    "subject_name" VARCHAR(255) NOT NULL,
    "related_director_id" UUID,
    "related_shareholder_id" UUID,
    "document_id" UUID NOT NULL,
    "enquiry_date" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ctos_enquiries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ctos_financial_highlights" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ctos_enquiry_id" UUID NOT NULL,
    "total_issued_ordinary" DECIMAL(18,2),
    "total_issued_preference" DECIMAL(18,2),
    "total_issued_others" DECIMAL(18,2),
    "revenue_turnover" DECIMAL(18,2),
    "net_income" DECIMAL(18,2),
    "current_assets" DECIMAL(18,2),
    "current_liabilities" DECIMAL(18,2),
    "current_ratio" DECIMAL(10,4),
    "debt_to_equity_ratio" DECIMAL(10,4),
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ctos_financial_highlights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ctos_legal_cases" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ctos_enquiry_id" UUID NOT NULL,
    "case_type" VARCHAR(20) NOT NULL,
    "plaintiff" VARCHAR(255),
    "defendant" VARCHAR(255),
    "case_no" VARCHAR(100),
    "remark" TEXT,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ctos_legal_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ctos_trade_references" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ctos_enquiry_id" UUID NOT NULL,
    "referee" VARCHAR(255),
    "account_no" VARCHAR(100),
    "capacity" VARCHAR(150),
    "statement_date" DATE,
    "default_amount" DECIMAL(18,2),
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ctos_trade_references_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "netreveal_records" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "vendor_id" UUID NOT NULL,
    "subject_type" VARCHAR(20) NOT NULL,
    "subject_name" VARCHAR(255) NOT NULL,
    "related_director_id" UUID,
    "related_shareholder_id" UUID,
    "document_id" UUID NOT NULL,
    "dob_doi" DATE,
    "nationality" VARCHAR(100),
    "check_name" VARCHAR(255),
    "uid" VARCHAR(100),
    "watchperson_details" TEXT,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "searched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "netreveal_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "screening_summaries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "vendor_id" UUID NOT NULL,
    "summary_text" TEXT NOT NULL,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generated_by_model" VARCHAR(100),

    CONSTRAINT "screening_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_ctos_enquiries_vendor" ON "ctos_enquiries"("vendor_id");

-- CreateIndex
CREATE UNIQUE INDEX "ctos_financial_highlights_ctos_enquiry_id_key" ON "ctos_financial_highlights"("ctos_enquiry_id");

-- CreateIndex
CREATE INDEX "idx_ctos_legal_cases_enquiry" ON "ctos_legal_cases"("ctos_enquiry_id");

-- CreateIndex
CREATE INDEX "idx_ctos_trade_refs_enquiry" ON "ctos_trade_references"("ctos_enquiry_id");

-- CreateIndex
CREATE INDEX "idx_netreveal_vendor" ON "netreveal_records"("vendor_id");

-- AddForeignKey
ALTER TABLE "ctos_enquiries" ADD CONSTRAINT "ctos_enquiries_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ctos_enquiries" ADD CONSTRAINT "ctos_enquiries_related_director_id_fkey" FOREIGN KEY ("related_director_id") REFERENCES "ssm_directors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ctos_enquiries" ADD CONSTRAINT "ctos_enquiries_related_shareholder_id_fkey" FOREIGN KEY ("related_shareholder_id") REFERENCES "ssm_shareholders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ctos_enquiries" ADD CONSTRAINT "ctos_enquiries_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ctos_financial_highlights" ADD CONSTRAINT "ctos_financial_highlights_ctos_enquiry_id_fkey" FOREIGN KEY ("ctos_enquiry_id") REFERENCES "ctos_enquiries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ctos_legal_cases" ADD CONSTRAINT "ctos_legal_cases_ctos_enquiry_id_fkey" FOREIGN KEY ("ctos_enquiry_id") REFERENCES "ctos_enquiries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ctos_trade_references" ADD CONSTRAINT "ctos_trade_references_ctos_enquiry_id_fkey" FOREIGN KEY ("ctos_enquiry_id") REFERENCES "ctos_enquiries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "netreveal_records" ADD CONSTRAINT "netreveal_records_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "netreveal_records" ADD CONSTRAINT "netreveal_records_related_director_id_fkey" FOREIGN KEY ("related_director_id") REFERENCES "ssm_directors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "netreveal_records" ADD CONSTRAINT "netreveal_records_related_shareholder_id_fkey" FOREIGN KEY ("related_shareholder_id") REFERENCES "ssm_shareholders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "netreveal_records" ADD CONSTRAINT "netreveal_records_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "screening_summaries" ADD CONSTRAINT "screening_summaries_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
