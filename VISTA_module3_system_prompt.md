# VISTA — Module 3 Build Spec: Adverse Media Screening Engine
## Addendum to CLAUDE.md + VISTA_module2_system_prompt.md — hand this to Claude Code once Modules 1 & 2 are confirmed working

This continues the existing VISTA project. Modules 1 (Digital Intake & Entity Extraction) and 2 (Unified Screening Intelligence View) are already built. Do not modify Module 1 or Module 2 tables/endpoints except where explicitly instructed below (Section 5). Keep using the conventions already established in `CLAUDE.md` (Section 6) and the subject-tagging pattern from Module 2: TypeScript strict mode, Zod validation, Prisma migrations, `is_verified`/decision-style reviewer-confirmation flags, one AI service module per data source.

**AI provider note:** Use the same AI provider already wired into Modules 1 and 2 (per `CLAUDE.md` Section 2) for summarization/categorization here too.

**New external dependency:** This module also calls the **Google SERP API** (or an equivalent search API) to find candidate news articles. Add a `SERP_API_KEY` environment variable and a dedicated service module for it (`services/search/serpClient.ts`), separate from the AI service module.

---

## 1. What Module 3 does

Unlike Modules 1 and 2, this module doesn't start from an uploaded document — it starts from a **live web search**. A reviewer picks a subject (company, or a director/shareholder from Module 1) and a set of keywords; the app searches the web via SERP API, and for each result, AI categorizes it into a risk theme and writes a short summary. The reviewer then marks each finding as relevant or a false positive. Confirmed-relevant findings and their summaries feed directly into the Module 5 KYV report later.

Risk themes to categorize into (fixed taxonomy, matching the proposal): `financial_crime`, `sanctions`, `fraud`, `regulatory_breach`, `tax_offence`, `esg`, `operational_risk`, `other`.

**Copyright/compliance constraint:** never store or display full scraped article text. Only store the title, the URL, and an AI-written summary that paraphrases the source in the app's own words — this keeps the app legally safe and keeps stored data lightweight.

---

## 2. Database schema (Module 3)

Add these tables via a new Prisma migration. Do not alter Module 1 or Module 2 tables.

```sql
-- Approved keyword library, tagged by risk theme, maintained by compliance/admin users.
-- Used to auto-suggest search terms and to help the AI categorize results consistently.
CREATE TABLE adverse_media_keyword_library (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    keyword         VARCHAR(255) NOT NULL,
    risk_theme      VARCHAR(50) NOT NULL, -- 'financial_crime' | 'sanctions' | 'fraud' | 'regulatory_breach' | 'tax_offence' | 'esg' | 'operational_risk' | 'other'
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One row per search run (a subject + the keywords used at that point in time)
CREATE TABLE adverse_media_searches (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id               UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    subject_type            VARCHAR(20) NOT NULL, -- 'company' | 'director' | 'shareholder'
    subject_name            VARCHAR(255) NOT NULL,
    related_director_id     UUID REFERENCES ssm_directors(id),
    related_shareholder_id  UUID REFERENCES ssm_shareholders(id),
    keywords_used           JSONB NOT NULL, -- array of the actual query strings sent to SERP API
    search_status           VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending | completed | failed
    searched_by             UUID REFERENCES users(id),
    searched_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One row per article found, with AI categorization + summary
CREATE TABLE adverse_media_articles (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    search_id           UUID NOT NULL REFERENCES adverse_media_searches(id) ON DELETE CASCADE,
    vendor_id           UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE, -- denormalized for fast vendor-level queries
    article_title       TEXT NOT NULL,
    article_url         TEXT NOT NULL,
    source_domain       VARCHAR(255),
    published_date      DATE,
    risk_theme          VARCHAR(50) NOT NULL DEFAULT 'other', -- AI-assigned, from the same taxonomy as the keyword library
    ai_summary          TEXT NOT NULL, -- paraphrased brief summary; feeds Module 5 KYV report
    reviewer_decision   VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending' | 'relevant' | 'false_positive'
    reviewed_by         UUID REFERENCES users(id),
    reviewed_at         TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_adverse_searches_vendor ON adverse_media_searches(vendor_id);
CREATE INDEX idx_adverse_articles_search ON adverse_media_articles(search_id);
CREATE INDEX idx_adverse_articles_vendor ON adverse_media_articles(vendor_id);
CREATE INDEX idx_adverse_articles_theme ON adverse_media_articles(risk_theme);
```

**Design notes:**
- Same `subject_type`/`related_director_id`/`related_shareholder_id` pattern as Module 2, so adverse media findings can be attributed to the company or to any individual from Module 1.
- `adverse_media_searches` keeps every search run (not overwritten), so there's an audit trail of what keywords were used and when — important since "approved keyword libraries" implies compliance will want to verify what was actually searched.
- `reviewer_decision` on articles is intentionally simple here (`pending`/`relevant`/`false_positive`) rather than a confidence score — Module 4 (False Positive & True Hit Triage) will later add a richer scoring layer on top of these same rows; don't build that scoring logic now.
- No raw article body is stored anywhere — only title, URL, and the AI's own paraphrased summary.

---

## 3. Backend API (Module 3)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/keyword-library` | List all keywords (optionally filter by `risk_theme` or `is_active`) |
| POST | `/api/keyword-library` | Add a new keyword + risk theme |
| PUT | `/api/keyword-library/:id` | Edit/deactivate a keyword |
| POST | `/api/vendors/:id/adverse-media-searches` | Run a new search: body = `{ subject_type, related_director_id?, related_shareholder_id?, extra_keywords?: string[] }`. Server builds the query set (subject name + active library keywords for the relevant risk themes + any `extra_keywords`), calls SERP API, then for each result calls the AI service to assign a `risk_theme` and write `ai_summary`; writes `adverse_media_searches` + `adverse_media_articles` rows |
| GET | `/api/vendors/:id/adverse-media-searches` | List all past search runs for a vendor |
| GET | `/api/vendors/:id/adverse-media` | **Main aggregate endpoint** — all articles for a vendor across all searches, joined with which search/subject they came from, groupable by `risk_theme` or by subject |
| PUT | `/api/adverse-media-articles/:id/decision` | Reviewer sets `reviewer_decision` (`relevant` / `false_positive`) + `reviewed_by`/`reviewed_at` |

**Search + extraction prompt design guidance:**
- Call SERP API with each keyword combination (e.g. `"{subject_name}" fraud`, `"{subject_name}" sanctions`, etc., built from active keyword-library entries), de-duplicate results by URL across all queries in one search run before saving.
- For each result, send the AI service only the **title, snippet, URL, and source domain** (never the full article body — SERP snippets are enough) with a prompt instructing it to:
  1. Pick exactly one `risk_theme` from the fixed taxonomy list.
  2. Write a 1–3 sentence summary **in its own words** — explicitly instruct the model not to copy phrases from the snippet verbatim.
  3. Return strict JSON: `{ "risk_theme": "", "ai_summary": "" }`.
- Validate this JSON with Zod before writing; if a result fails validation, skip that single article (log it) rather than failing the whole search run.
- Mark the `adverse_media_searches` row `search_status = 'failed'` only if the SERP API call itself fails, not for individual per-article AI failures.

---

## 4. Frontend UI (Module 3)

Replace the Module 3 "Coming soon" placeholder with:

1. **Adverse Media Screening page** (`/vendor/:vendorId/adverse-media`):
   - **Search panel** at the top — subject picker (Company / director / shareholder, populated via the `/subjects` endpoint added in Module 2), a multi-select of active keywords from the library (pre-checked defaults, editable), a free-text field for extra keywords, and a "Run Search" button. Show a loading state while the search executes (this can take a few seconds due to the SERP + AI calls).
   - **Results view** below — articles grouped by **risk theme** (collapsible sections, one per theme, only showing themes with results), each article as a card: title (linking out to `article_url` in a new tab), source domain, AI summary, a subject tag, and a **Relevant / False Positive** toggle that calls the decision endpoint. Give `false_positive` articles a muted/greyed style once marked, and `relevant` ones a subtle highlight.
   - **Search history** — a small collapsible list of past search runs for this vendor (keywords used, date, result count) for transparency/audit.
   - A simple **Keyword Library management panel** (can be a modal or a separate `/admin/keyword-library` route) — table of keyword + risk theme + active toggle, with add/edit.
2. Update the **Vendor Profile summary page** to replace its "Adverse Media — coming soon" placeholder with a condensed view: a count of relevant findings per risk theme, and a flag if any high-sensitivity theme (`sanctions`, `financial_crime`) has an unresolved (`pending`) finding.

---

## 5. Small additions to earlier modules (additive only)

- No changes required to Module 1 or Module 2 tables or endpoints. Module 3 reuses the `/api/vendors/:id/subjects` endpoint added in Module 2 (Section 4 of that spec) as-is.

---

## 6. Definition of Done for Module 3

- [ ] Prisma migration adds `adverse_media_keyword_library`, `adverse_media_searches`, `adverse_media_articles` — Module 1 and 2 tables untouched.
- [ ] SERP API service module (`services/search/serpClient.ts`) implemented with `SERP_API_KEY` from environment config.
- [ ] Running a search for a company subject and for a director/shareholder subject both work end-to-end: SERP results → AI categorization + summary → rows saved.
- [ ] `GET /api/vendors/:id/adverse-media` returns articles groupable by risk theme.
- [ ] Reviewer can mark any article Relevant or False Positive and it persists.
- [ ] Keyword library CRUD works and newly added/deactivated keywords affect the next search's default selection.
- [ ] No full article body text is stored or displayed anywhere — only title, URL, and AI summary.
- [ ] Adverse Media Screening page fully replaces the Module 3 placeholder tab; Vendor Profile page updated with the condensed view.
- [ ] Seed script extended with a small sample keyword library (a few entries per risk theme) and, optionally, one sample search result set for a seeded vendor.
