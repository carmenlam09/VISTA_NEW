# VISTA — Module 4 Build Spec: False Positive & True Hit Triage
## Addendum to CLAUDE.md + VISTA_module2/3_system_prompt.md — hand this to Claude Code once Modules 1, 2 & 3 are confirmed working

This continues the existing VISTA project. Modules 1, 2, and 3 are already built. Module 4 does **not** introduce a new source of findings — it sits on top of the findings Modules 2 and 3 already created (NetReveal records, CTOS legal cases, adverse media articles) and adds AI-driven confidence scoring so reviewers know which ones to look at first. Follow the same conventions already established in `CLAUDE.md` (Section 6): TypeScript strict mode, Zod validation, Prisma migrations, one AI service module per concern.

**AI provider note:** Use the same AI provider already wired into Modules 1–3.

---

## 1. What Module 4 does

Reviewers currently have to open Module 2 and Module 3 separately and manually judge each NetReveal hit, CTOS legal case, and adverse media article. Module 4 adds one **Triage queue**: an AI pass over all of a vendor's not-yet-decided findings that produces a **confidence score** (how likely this is a genuine risk vs. a false positive) and a short **rationale**, then sorts findings by that score so reviewers spend their time on the ones that actually need judgement.

The AI's confidence score should be informed by:
- **Name variations** — does the watchlist/article name closely match the subject's name as captured in Module 1, or is it a partial/ambiguous match (e.g. common name, different spelling)?
- **Nationality** — does the NetReveal nationality match what's known about the subject (if available)?
- **Ownership structure / corporate relationships** — is this director/shareholder also linked to other vendors already in VISTA's database, and if so, what were the past outcomes for them?
- **Historical screening outcomes** — has this same subject name (or IC/passport number) been triaged before, in this vendor or another, and what was decided then?

This module does not add a new document upload or a new external API call — it's a reasoning/scoring layer over existing data, plus a database query for historical context.

---

## 2. Database schema (Module 4)

### 2.1 New table

```sql
-- One row per finding that's been through AI triage. Findings come from three existing
-- source tables; source_type + source_record_id together identify which one.
CREATE TABLE risk_triage_results (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id               UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    source_type             VARCHAR(30) NOT NULL, -- 'netreveal' | 'ctos_legal_case' | 'adverse_media'
    source_record_id        UUID NOT NULL,        -- id in netreveal_records / ctos_legal_cases / adverse_media_articles (no DB-level FK, since it's polymorphic — enforce the reference in application code)
    subject_type            VARCHAR(20) NOT NULL, -- 'company' | 'director' | 'shareholder'
    subject_name             VARCHAR(255) NOT NULL,
    confidence_score        NUMERIC(5,2) NOT NULL, -- 0.00–100.00, likelihood this is a genuine risk (higher = more likely a true hit)
    ai_rationale             TEXT NOT NULL,         -- short explanation referencing name match, nationality, ownership links, history
    suggested_decision       VARCHAR(20) NOT NULL, -- 'relevant' | 'false_positive' | 'needs_review'
    reviewer_final_decision  VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending' | 'relevant' | 'false_positive'
    reviewed_by              UUID REFERENCES users(id),
    reviewed_at              TIMESTAMPTZ,
    triaged_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_triage_vendor ON risk_triage_results(vendor_id);
CREATE INDEX idx_triage_confidence ON risk_triage_results(confidence_score DESC);
CREATE INDEX idx_triage_source ON risk_triage_results(source_type, source_record_id);
```

### 2.2 Additive columns on existing Module 2 tables (do not otherwise alter Module 1/2/3 tables)

Adverse media articles already have a `reviewer_decision` field (`pending`/`relevant`/`false_positive`) from Module 3 — reuse it as-is; **do not** add a duplicate column there. NetReveal records and CTOS legal cases don't have an equivalent field yet, so add one to each, using the same vocabulary for consistency:

```sql
ALTER TABLE netreveal_records ADD COLUMN risk_decision VARCHAR(20) NOT NULL DEFAULT 'pending'; -- 'pending' | 'relevant' | 'false_positive'
ALTER TABLE ctos_legal_cases ADD COLUMN risk_decision VARCHAR(20) NOT NULL DEFAULT 'pending';
```

**Design notes:**
- `source_type` + `source_record_id` is a lightweight polymorphic reference rather than three nullable FK columns, since exactly one source table applies per row and adding a fourth source type later (e.g. if Module 2's trade references ever need triage) doesn't require a schema change.
- `risk_triage_results` is additive and re-runnable: triaging the same finding again should **update** its existing row (by `source_type` + `source_record_id`) rather than insert a duplicate, so the queue always reflects the latest AI assessment.
- `reviewer_final_decision` on `risk_triage_results` is the source of truth for the *triage UI*, but the actual downstream tables (`adverse_media_articles.reviewer_decision`, `netreveal_records.risk_decision`, `ctos_legal_cases.risk_decision`) must be kept in sync whenever a reviewer decides here, since Module 2 and Module 3's own pages read from those columns directly.

---

## 3. Backend API (Module 4)

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/vendors/:id/triage/run` | Run AI triage over every not-yet-decided finding for this vendor across all three source types (any `netreveal_records` row with non-empty `watchperson_details` and `risk_decision = 'pending'`; any `ctos_legal_cases` row with `risk_decision = 'pending'`; any `adverse_media_articles` row with `reviewer_decision = 'pending'`). Upserts `risk_triage_results` rows (update if a row already exists for that `source_type`+`source_record_id`, insert otherwise) |
| GET | `/api/vendors/:id/triage` | List all triage results for a vendor, **sorted by `confidence_score` descending** by default, with query params to filter by `source_type` or `reviewer_final_decision` |
| PUT | `/api/risk-triage/:id/decision` | Reviewer sets `reviewer_final_decision` (`relevant`/`false_positive`); the handler must also write that same decision into the underlying source row (`adverse_media_articles.reviewer_decision`, `netreveal_records.risk_decision`, or `ctos_legal_cases.risk_decision`, chosen by `source_type`) in the same transaction |

**AI triage prompt design guidance:**
For each finding being triaged, gather this context before calling the AI (don't rely on the model to fetch it itself):
- The finding's own data (e.g. the NetReveal watchperson details and nationality, or the CTOS case remark, or the adverse media summary/risk theme).
- The subject's Module 1 profile fields relevant to identity matching (full name, IC/passport number, nationality if captured).
- **Historical outcomes:** query `risk_triage_results` for any past rows with a matching `subject_name` (or, better, matching IC/passport number where available via a join back to `ssm_directors`/`ssm_shareholders`) across *any* vendor, and pass a short summary of those past decisions into the prompt.
- **Cross-vendor relationships:** query `ssm_directors`/`ssm_shareholders` for other vendors where this same person (by IC/passport number) appears, and note that in the prompt as ownership/relationship context.

Prompt the AI to return strict JSON:
```json
{ "confidence_score": 0, "ai_rationale": "", "suggested_decision": "relevant" }
```
- `confidence_score` is the model's estimate (0–100) that this is a genuine risk requiring escalation, not a false positive.
- `suggested_decision` should be `"needs_review"` when the model's own confidence is middling (e.g. roughly 40–70) rather than forcing a binary call — that's the signal to a reviewer that judgement is genuinely needed.
- Validate this JSON with Zod before writing; on failure, skip that single finding (log it) rather than failing the whole triage run.

---

## 4. Frontend UI (Module 4)

Replace the Module 4 "Coming soon" placeholder with:

1. **Triage Queue page** (`/vendor/:vendorId/triage`):
   - A **"Run Triage"** button that calls `POST /triage/run`, with a loading state (this can take a while since it may score many findings).
   - A **sorted list/table**, highest `confidence_score` first: each row shows the finding's source (NetReveal / CTOS Legal Case / Adverse Media, with an icon or tag), subject name, a confidence badge (color-coded — e.g. red for high, amber for `needs_review`, green/grey for low), the AI rationale, and a **Relevant / False Positive** decision control that calls `PUT /risk-triage/:id/decision`.
   - Filter controls for source type and for decision status (`pending`/`relevant`/`false_positive`), so a reviewer can focus on just the undecided, highest-priority items.
   - Clicking a row expands to show the full underlying finding detail (reusing the relevant card/table row component already built in Module 2 or Module 3 for that source type, rather than re-building a new detail view).
2. Update the **Vendor Profile summary page** to add a small "Triage" panel: count of findings still `pending` (broken out by confidence tier — e.g. "3 high-confidence items need review") — this is the number that should really catch a reviewer's attention before they move on to Module 5's report.

---

## 5. Small additions to earlier modules

- `netreveal_records` and `ctos_legal_cases` each get one additive `risk_decision` column (Section 2.2). Update Module 2's dashboard (built in the Module 2 spec) to display this decision as a badge on each NetReveal card and legal case row, so a decision made in the Triage queue is visible back in its original module too — this is the only UI change required in Module 2's existing pages.
- No changes to Module 3's pages or to any Module 1 table.

---

## 6. Definition of Done for Module 4

- [ ] Prisma migration adds `risk_triage_results` and the two additive columns on `netreveal_records`/`ctos_legal_cases` — no other existing tables altered.
- [ ] `POST /triage/run` correctly gathers all three source types' pending findings, includes historical/cross-vendor context in its prompts, and upserts (not duplicates) `risk_triage_results` rows.
- [ ] `GET /triage` returns results sorted by confidence descending and supports the filter params.
- [ ] Deciding a finding in the Triage queue updates both `risk_triage_results.reviewer_final_decision` and the correct underlying source table's decision field, in one transaction.
- [ ] Triage Queue page fully replaces the Module 4 placeholder tab; Module 2's dashboard shows the `risk_decision` badge; Vendor Profile page shows the pending/high-confidence count.
- [ ] Seed script extended so at least one seeded vendor has a mix of findings that produce a spread of confidence scores when triaged (for demoing sort order).
