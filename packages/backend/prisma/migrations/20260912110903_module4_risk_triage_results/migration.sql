-- AlterTable
ALTER TABLE "ctos_legal_cases" ADD COLUMN     "risk_decision" VARCHAR(20) NOT NULL DEFAULT 'pending';

-- AlterTable
ALTER TABLE "netreveal_records" ADD COLUMN     "risk_decision" VARCHAR(20) NOT NULL DEFAULT 'pending';

-- CreateTable
CREATE TABLE "risk_triage_results" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "vendor_id" UUID NOT NULL,
    "source_type" VARCHAR(30) NOT NULL,
    "source_record_id" UUID NOT NULL,
    "subject_type" VARCHAR(20) NOT NULL,
    "subject_name" VARCHAR(255) NOT NULL,
    "confidence_score" DECIMAL(5,2) NOT NULL,
    "ai_rationale" TEXT NOT NULL,
    "suggested_decision" VARCHAR(20) NOT NULL,
    "reviewer_final_decision" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "reviewed_by" UUID,
    "reviewed_at" TIMESTAMP(3),
    "triaged_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "risk_triage_results_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_triage_vendor" ON "risk_triage_results"("vendor_id");

-- CreateIndex
CREATE INDEX "idx_triage_confidence" ON "risk_triage_results"("confidence_score" DESC);

-- CreateIndex
CREATE INDEX "idx_triage_source" ON "risk_triage_results"("source_type", "source_record_id");

-- AddForeignKey
ALTER TABLE "risk_triage_results" ADD CONSTRAINT "risk_triage_results_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_triage_results" ADD CONSTRAINT "risk_triage_results_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
