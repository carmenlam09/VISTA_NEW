-- CreateTable
CREATE TABLE "report_templates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(255) NOT NULL,
    "version" VARCHAR(50) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sections" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "report_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kyv_reports" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "vendor_id" UUID NOT NULL,
    "template_id" UUID NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'draft',
    "prepared_by" UUID,
    "reviewed_by" UUID,
    "reviewed_at" TIMESTAMP(3),
    "reviewer_comments" TEXT,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generated_by_model" VARCHAR(100),

    CONSTRAINT "kyv_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kyv_report_sections" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "report_id" UUID NOT NULL,
    "section_key" VARCHAR(100) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "content" TEXT NOT NULL,
    "section_order" INTEGER NOT NULL,
    "is_edited" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kyv_report_sections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_kyv_reports_vendor" ON "kyv_reports"("vendor_id");

-- CreateIndex
CREATE INDEX "idx_kyv_sections_report" ON "kyv_report_sections"("report_id");

-- AddForeignKey
ALTER TABLE "kyv_reports" ADD CONSTRAINT "kyv_reports_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kyv_reports" ADD CONSTRAINT "kyv_reports_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "report_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kyv_reports" ADD CONSTRAINT "kyv_reports_prepared_by_fkey" FOREIGN KEY ("prepared_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kyv_reports" ADD CONSTRAINT "kyv_reports_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kyv_report_sections" ADD CONSTRAINT "kyv_report_sections_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "kyv_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;
