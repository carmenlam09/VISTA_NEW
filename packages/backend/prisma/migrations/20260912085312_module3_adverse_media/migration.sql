-- CreateTable
CREATE TABLE "adverse_media_keyword_library" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "keyword" VARCHAR(255) NOT NULL,
    "risk_theme" VARCHAR(50) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "adverse_media_keyword_library_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "adverse_media_searches" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "vendor_id" UUID NOT NULL,
    "subject_type" VARCHAR(20) NOT NULL,
    "subject_name" VARCHAR(255) NOT NULL,
    "related_director_id" UUID,
    "related_shareholder_id" UUID,
    "keywords_used" JSONB NOT NULL,
    "search_status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "searched_by" UUID,
    "searched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "adverse_media_searches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "adverse_media_articles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "search_id" UUID NOT NULL,
    "vendor_id" UUID NOT NULL,
    "article_title" TEXT NOT NULL,
    "article_url" TEXT NOT NULL,
    "source_domain" VARCHAR(255),
    "published_date" DATE,
    "risk_theme" VARCHAR(50) NOT NULL DEFAULT 'other',
    "ai_summary" TEXT NOT NULL,
    "reviewer_decision" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "reviewed_by" UUID,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "adverse_media_articles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_adverse_searches_vendor" ON "adverse_media_searches"("vendor_id");

-- CreateIndex
CREATE INDEX "idx_adverse_articles_search" ON "adverse_media_articles"("search_id");

-- CreateIndex
CREATE INDEX "idx_adverse_articles_vendor" ON "adverse_media_articles"("vendor_id");

-- CreateIndex
CREATE INDEX "idx_adverse_articles_theme" ON "adverse_media_articles"("risk_theme");

-- AddForeignKey
ALTER TABLE "adverse_media_searches" ADD CONSTRAINT "adverse_media_searches_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adverse_media_searches" ADD CONSTRAINT "adverse_media_searches_related_director_id_fkey" FOREIGN KEY ("related_director_id") REFERENCES "ssm_directors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adverse_media_searches" ADD CONSTRAINT "adverse_media_searches_related_shareholder_id_fkey" FOREIGN KEY ("related_shareholder_id") REFERENCES "ssm_shareholders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adverse_media_searches" ADD CONSTRAINT "adverse_media_searches_searched_by_fkey" FOREIGN KEY ("searched_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adverse_media_articles" ADD CONSTRAINT "adverse_media_articles_search_id_fkey" FOREIGN KEY ("search_id") REFERENCES "adverse_media_searches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adverse_media_articles" ADD CONSTRAINT "adverse_media_articles_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adverse_media_articles" ADD CONSTRAINT "adverse_media_articles_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
