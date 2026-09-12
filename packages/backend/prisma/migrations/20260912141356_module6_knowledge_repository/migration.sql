-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateTable
CREATE TABLE "knowledge_repository_entries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "vendor_id" UUID NOT NULL,
    "source_type" VARCHAR(30) NOT NULL,
    "source_id" UUID NOT NULL,
    "subject_type" VARCHAR(20),
    "subject_name" VARCHAR(255),
    "risk_theme" VARCHAR(50),
    "decision" VARCHAR(20),
    "summary_text" TEXT NOT NULL,
    "embedding" vector(1536),
    "indexed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_repository_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_kre_vendor" ON "knowledge_repository_entries"("vendor_id");

-- CreateIndex
CREATE INDEX "idx_kre_subject_name" ON "knowledge_repository_entries"("subject_name");

-- AddForeignKey
ALTER TABLE "knowledge_repository_entries" ADD CONSTRAINT "knowledge_repository_entries_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
-- Not expressible via Prisma's @@index (ivfflat is a pgvector-provided access
-- method, not a builtin Postgres one Prisma knows about) - added by hand.
CREATE INDEX "idx_kre_embedding" ON "knowledge_repository_entries" USING ivfflat ("embedding" vector_cosine_ops);
