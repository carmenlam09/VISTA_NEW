-- DropIndex
-- Prisma doesn't know about this index (ivfflat isn't a builtin access
-- method it tracks - see the module6 migration), so its diff treats it as
-- untracked drift and drops it here. Recreated below so it survives.
DROP INDEX "idx_kre_embedding";

-- AlterTable
ALTER TABLE "adverse_media_articles" ADD COLUMN     "categorization_status" VARCHAR(20) NOT NULL DEFAULT 'pending',
ALTER COLUMN "ai_summary" DROP NOT NULL;

-- Backfill: every article that already has an AI summary was in fact
-- already categorized before this column existed - only rows with no
-- summary yet are genuinely 'pending'.
UPDATE "adverse_media_articles" SET "categorization_status" = 'completed' WHERE "ai_summary" IS NOT NULL;

-- Recreate the pgvector index dropped above.
CREATE INDEX "idx_kre_embedding" ON "knowledge_repository_entries" USING ivfflat ("embedding" vector_cosine_ops);
