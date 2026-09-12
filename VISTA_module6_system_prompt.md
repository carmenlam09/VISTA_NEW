# VISTA — Module 6/7 Build Spec: Vendor Risk Knowledge Repository
## Addendum to CLAUDE.md + VISTA_module2/3/4/5_system_prompt.md — hand this to Claude Code once Modules 1–5 are confirmed working

This continues the existing VISTA project. Modules 1–5 are already built. This is the final module (the proposal numbers it inconsistently as both "Module 6" and "Module 7" — treat it as one module, the last tab in the app). It doesn't collect new findings either — it makes everything the platform has already produced **searchable across vendors**, so reviewers can find past cases instead of re-investigating from scratch. Follow the conventions already established in `CLAUDE.md` (Section 6): TypeScript strict mode, Zod validation, Prisma migrations, one AI service module per concern.

**AI provider note:** Use the same AI provider already wired into Modules 1–5, for both generating embeddings and synthesizing search answers.

**New database capability:** This module requires the **`pgvector`** Postgres extension (flagged as a future need back in `CLAUDE.md` Section 3). Enable it in the new migration:
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

---

## 1. What this module does

Two things:
1. **Indexing** — every time a KYV report is approved (Module 5) or a triage decision is finalized (Module 4), a searchable entry is automatically created here. This happens as an addition to those modules' existing endpoints (Section 5), not as a new manual step.
2. **Retrieval** — a search page where a reviewer types a natural-language query (e.g. *"has this director been flagged before"*, *"vendors with sanctions concerns in the logistics sector"*) and gets back the most relevant past reports and decisions, ranked by semantic similarity, plus a short AI-synthesized answer summarizing what was found.

This is the only module that reads *across* all vendors rather than being scoped to one — that's the point of a knowledge repository.

---

## 2. Database schema

```sql
CREATE EXTENSION IF NOT EXISTS vector;

-- One row per indexed item: either an approved KYV report, or a finalized triage decision.
CREATE TABLE knowledge_repository_entries (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_type     VARCHAR(30) NOT NULL, -- 'kyv_report' | 'triage_decision'
    source_id       UUID NOT NULL,        -- kyv_reports.id or risk_triage_results.id (polymorphic, app-enforced, same pattern as Module 4's source_record_id)
    vendor_id       UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    subject_type    VARCHAR(20),          -- 'company' | 'director' | 'shareholder', where applicable
    subject_name    VARCHAR(255),
    risk_theme      VARCHAR(50),          -- carried over from the source finding, where applicable (nullable for kyv_report entries)
    decision        VARCHAR(20),          -- 'approved' for kyv_report entries; 'relevant'/'false_positive' for triage_decision entries
    summary_text    TEXT NOT NULL,        -- the human-readable text shown in results AND the text the embedding was generated from
    embedding       VECTOR(1536),         -- dimension must match whatever embedding model the AI service actually uses — confirm and adjust before migrating
    indexed_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_kre_vendor ON knowledge_repository_entries(vendor_id);
CREATE INDEX idx_kre_subject_name ON knowledge_repository_entries(subject_name);
CREATE INDEX idx_kre_embedding ON knowledge_repository_entries USING ivfflat (embedding vector_cosine_ops);
```

**Design notes:**
- Same polymorphic `source_type` + `source_id` pattern used in Module 4 — one table serves two source kinds rather than two near-identical tables.
- `summary_text` is stored alongside the embedding (not just the vector) because it's what gets displayed in search results and re-embedded if the entry is ever regenerated — never show a bare similarity score with no readable text behind it.
- Re-indexing the same source (e.g. a report gets re-approved after edits) should **update** the existing row for that `source_type`+`source_id`, not insert a duplicate — same upsert pattern as Module 4's `risk_triage_results`.
- The `1536` dimension is a placeholder matching common embedding model output size — Claude Code must confirm the actual embedding model/API being used and adjust the column dimension to match before running the migration, since a mismatch will fail at insert time.

---

## 3. Backend API

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/knowledge-repository/search` | Main search endpoint. Query params: `q` (free-text query, required), `risk_theme?`, `decision?`, `subject_name?`, `date_from?`, `date_to?`. Embeds `q`, runs a `pgvector` cosine-similarity search (e.g. top 20) combined with any filters as SQL `WHERE` clauses, and returns `{ results: [...], ai_synthesis: "" }` |
| POST | `/api/knowledge-repository/reindex` | Admin/utility endpoint: rebuilds all `knowledge_repository_entries` from every currently-approved `kyv_reports` row and every finalized (`relevant`/`false_positive`) `risk_triage_results` row. Useful for backfilling after this module is first deployed, or after an embedding-model change |

**Search prompt/design guidance:**
- Embed the user's `q` using the same embedding model used to index entries (consistency matters — a query embedded with a different model than the corpus will rank poorly).
- After retrieving the top matches, send their `summary_text` values (not the raw source rows) to the AI with a prompt asking for a short synthesized answer to the user's query, grounded only in what was retrieved — explicitly instruct the model not to state anything about a vendor that isn't present in the retrieved `summary_text` values, since fabricated risk claims about a real vendor would be a serious problem in this context.
- If no results clear a reasonable similarity threshold, return an empty `results` array and an `ai_synthesis` that plainly says nothing relevant was found — never let the AI invent a synthesis from nothing.

---

## 4. Frontend UI

Replace the Module 6/7 "Coming soon" placeholder with:

1. **Knowledge Repository page** (`/knowledge-repository` — note this is **not** vendor-scoped like other module routes, since it searches across all vendors):
   - A prominent **search bar** for natural-language queries, with filter chips below it for risk theme, decision, and date range.
   - An **AI Synthesis panel** at the top of results — the `ai_synthesis` text from the search response.
   - A **results list** below — each result as a card showing: source type (KYV Report / Triage Decision), the vendor name (linking to that vendor's profile), subject name/type, risk theme (if any), decision badge, and the `summary_text`. Sort by relevance (the order returned by the API).
   - An empty state for no query yet, and a distinct "no relevant matches" state for a query that returned nothing.
2. Add a **"View Similar Past Cases" link** on the Vendor Profile page (built in Module 1, extended by every module since) that navigates to the Knowledge Repository page pre-filled with a query built from that vendor's company name — this is the natural entry point reviewers will actually use most, rather than starting from a blank search.

---

## 5. Small additions to earlier modules (wiring the indexing triggers)

These are additive changes inside two existing endpoints — no schema changes to Modules 1–5:

- **In Module 5's `PUT /kyv-reports/:id/approve` handler:** after setting `status = 'approved'`, call a new `indexKyvReport(reportId)` function that builds `summary_text` from the report's `executive_summary` and `risk_assessment_recommendation` sections, generates an embedding, and upserts a `knowledge_repository_entries` row (`source_type = 'kyv_report'`, `decision = 'approved'`).
- **In Module 4's `PUT /risk-triage/:id/decision` handler:** after the decision is finalized (`relevant` or `false_positive`), call a new `indexTriageDecision(triageResultId)` function that builds `summary_text` from the triage's `ai_rationale` plus its subject/finding context, generates an embedding, and upserts a `knowledge_repository_entries` row (`source_type = 'triage_decision'`).

Keep both indexing functions in their own service module (e.g. `services/knowledge/indexer.ts`) so they're easy to find and reuse from the reindex endpoint in Section 3.

---

## 6. Definition of Done

- [ ] `pgvector` extension enabled; Prisma migration adds `knowledge_repository_entries` with the correct embedding dimension for the actual model in use.
- [ ] Approving a KYV report automatically creates/updates a `knowledge_repository_entries` row; finalizing a triage decision does the same.
- [ ] `GET /knowledge-repository/search` returns similarity-ranked results plus a grounded AI synthesis, and correctly returns an empty/no-match state rather than a fabricated answer when nothing relevant exists.
- [ ] Filters (`risk_theme`, `decision`, `subject_name`, date range) narrow results correctly in combination with the semantic search.
- [ ] `POST /knowledge-repository/reindex` successfully rebuilds the index from all existing approved reports and finalized triage decisions.
- [ ] Knowledge Repository page fully replaces the Module 6/7 placeholder tab; Vendor Profile page has a working "View Similar Past Cases" link.
- [ ] Seed script extended so there's at least one approved report and a couple of finalized triage decisions across different vendors, indexed and searchable, for demoing cross-vendor retrieval.
