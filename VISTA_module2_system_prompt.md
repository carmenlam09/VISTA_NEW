# VISTA — Module 2 Build Spec: Unified Screening Intelligence View
## Addendum to CLAUDE.md — hand this to Claude Code once Module 1 is confirmed working

This continues the existing VISTA project. Module 1 (Digital Intake & Entity Extraction) is already built. Do not modify Module 1's tables or endpoints except where explicitly instructed below (Section 4). Follow the same conventions already established in `CLAUDE.md` (Section 6): TypeScript strict mode, Zod validation, Prisma migrations, `is_verified` reviewer-confirmation pattern, one AI service module per data source.

**AI provider note:** Use whatever AI provider Module 1's extraction service already calls (per `CLAUDE.md` Section 2) for consistency — do not introduce a second provider for Module 2 unless told to.

---

## 1. What Module 2 does

The Screening Intelligence Hub aggregates CTOS enquiry results and NetReveal search results for a vendor — the company itself, and its directors/shareholders captured in Module 1 — into one unified view, with an AI-generated summary so reviewers don't have to read every source individually.

Two source types, both entered the same way Module 1 documents are: reviewer exports/downloads a report from the external CTOS or NetReveal system and uploads it here; AI extracts the structured fields.

Key difference from Module 1: a CTOS or NetReveal search can be run against the **company**, or against **any individual director or shareholder** already captured in Module 1 — so every record in this module needs to say *which subject* it's about, not just which vendor.

---

## 2. Database schema (Module 2)

Add these tables via a new Prisma migration. Do not alter Module 1 tables.

```sql
-- One row per CTOS enquiry uploaded (a company enquiry, or a director/shareholder enquiry)
CREATE TABLE ctos_enquiries (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id               UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    subject_type            VARCHAR(20) NOT NULL, -- 'company' | 'director' | 'shareholder'
    subject_name            VARCHAR(255) NOT NULL, -- denormalized for display even if the linked row is later deleted
    related_director_id     UUID REFERENCES ssm_directors(id),
    related_shareholder_id  UUID REFERENCES ssm_shareholders(id),
    document_id             UUID NOT NULL REFERENCES documents(id),
    enquiry_date            DATE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- CTOS Financial Highlights — only applies where subject_type = 'company', one per enquiry
CREATE TABLE ctos_financial_highlights (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ctos_enquiry_id             UUID NOT NULL UNIQUE REFERENCES ctos_enquiries(id) ON DELETE CASCADE,
    total_issued_ordinary       NUMERIC(18,2),
    total_issued_preference     NUMERIC(18,2),
    total_issued_others         NUMERIC(18,2),
    revenue_turnover            NUMERIC(18,2),
    net_income                  NUMERIC(18,2),
    current_assets              NUMERIC(18,2),
    current_liabilities         NUMERIC(18,2),
    current_ratio               NUMERIC(10,4),
    debt_to_equity_ratio        NUMERIC(10,4),
    is_verified                 BOOLEAN NOT NULL DEFAULT false,
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- CTOS Legal Cases — Section D1 (subject as Defendant) and D2 (subject as Plaintiff), many per enquiry
CREATE TABLE ctos_legal_cases (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ctos_enquiry_id     UUID NOT NULL REFERENCES ctos_enquiries(id) ON DELETE CASCADE,
    case_type           VARCHAR(20) NOT NULL, -- 'defendant' (D1) | 'plaintiff' (D2)
    plaintiff            VARCHAR(255),
    defendant            VARCHAR(255),
    case_no              VARCHAR(100),
    remark               TEXT,
    is_verified          BOOLEAN NOT NULL DEFAULT false,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- CTOS Trade Reference — Section E2, many per enquiry
CREATE TABLE ctos_trade_references (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ctos_enquiry_id     UUID NOT NULL REFERENCES ctos_enquiries(id) ON DELETE CASCADE,
    referee             VARCHAR(255),
    account_no          VARCHAR(100),
    capacity            VARCHAR(150),
    statement_date      DATE,
    default_amount      NUMERIC(18,2), -- "Default Amount (RM)"
    is_verified         BOOLEAN NOT NULL DEFAULT false,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- NetReveal search results — one row per subject searched (company, director, or shareholder)
CREATE TABLE netreveal_records (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id               UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    subject_type            VARCHAR(20) NOT NULL, -- 'company' | 'director' | 'shareholder'
    subject_name            VARCHAR(255) NOT NULL,
    related_director_id     UUID REFERENCES ssm_directors(id),
    related_shareholder_id  UUID REFERENCES ssm_shareholders(id),
    document_id             UUID NOT NULL REFERENCES documents(id),
    dob_doi                 DATE,           -- Date of Birth / Date of Incorporation
    nationality             VARCHAR(100),
    check_name              VARCHAR(255),   -- name variant the search was run against
    uid                     VARCHAR(100),
    watchperson_details     TEXT,           -- Watchperson Details / FPFA Watch Person Details
    is_verified             BOOLEAN NOT NULL DEFAULT false,
    searched_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- AI-generated aggregate summary shown at the top of the Screening Intelligence dashboard.
-- Reused later by Module 5 (KYV report drafting).
CREATE TABLE screening_summaries (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id       UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    summary_text    TEXT NOT NULL,
    generated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    generated_by_model VARCHAR(100)
);

CREATE INDEX idx_ctos_enquiries_vendor ON ctos_enquiries(vendor_id);
CREATE INDEX idx_ctos_legal_cases_enquiry ON ctos_legal_cases(ctos_enquiry_id);
CREATE INDEX idx_ctos_trade_refs_enquiry ON ctos_trade_references(ctos_enquiry_id);
CREATE INDEX idx_netreveal_vendor ON netreveal_records(vendor_id);
```

**Design notes:**
- `subject_type` + `subject_name` (denormalized) + optional `related_director_id`/`related_shareholder_id` is used on both `ctos_enquiries` and `netreveal_records` because a screening search can be run against the company, or against any individual captured in Module 1. Only one of the two `related_*` FKs should be set at a time, and both are null when `subject_type = 'company'`.
- `ctos_financial_highlights` is a child of `ctos_enquiries` (not directly of `vendor_id`) so it's naturally scoped to a specific company-level enquiry and can't accidentally be attached to a director's enquiry.
- Legal cases and trade references are children of `ctos_enquiries` for the same reason, and because one CTOS report can list many of each.
- `screening_summaries` keeps every generated summary (don't overwrite) so there's a history of what the AI said and when — useful for audit and for Module 5's report generation later.

---

## 3. Backend API (Module 2)

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/vendors/:id/ctos-enquiries` | Upload a CTOS report (multipart file + `subject_type` + optional `related_director_id`/`related_shareholder_id`); creates the `documents` row and the `ctos_enquiries` row |
| POST | `/api/ctos-enquiries/:id/extract` | Run AI extraction on the uploaded CTOS report; writes to `ctos_financial_highlights` (company enquiries only), `ctos_legal_cases`, `ctos_trade_references` |
| GET | `/api/vendors/:id/ctos-enquiries` | List all CTOS enquiries for a vendor with their extracted data joined |
| PUT | `/api/ctos-enquiries/:id/financial-highlights` | Reviewer edits/confirms financial highlights |
| POST/PUT/DELETE | `/api/ctos-enquiries/:id/legal-cases[/:caseId]` | CRUD for legal case rows |
| POST/PUT/DELETE | `/api/ctos-enquiries/:id/trade-references[/:refId]` | CRUD for trade reference rows |
| POST | `/api/vendors/:id/netreveal-records` | Upload a NetReveal report (multipart file + `subject_type` + optional related IDs); creates `documents` row and `netreveal_records` row |
| POST | `/api/netreveal-records/:id/extract` | Run AI extraction on the uploaded NetReveal report |
| PUT | `/api/netreveal-records/:id` | Reviewer edits/confirms a NetReveal record |
| GET | `/api/vendors/:id/screening` | **Main aggregate endpoint** — returns everything for the Screening Intelligence dashboard in one call: financial highlights, all legal cases (grouped by D1/D2), all trade references, all NetReveal records (grouped by subject), and the latest `screening_summaries` row |
| POST | `/api/vendors/:id/screening-summary` | Trigger AI to generate a new aggregate summary across all Module 2 data for this vendor (and Module 1 profile context); inserts a new `screening_summaries` row |

**Extraction prompt design guidance:**
- For CTOS company enquiries, extract into:
  ```json
  { "financial_highlights": { "total_issued_ordinary": 0, "total_issued_preference": 0, "total_issued_others": 0, "revenue_turnover": 0, "net_income": 0, "current_assets": 0, "current_liabilities": 0, "current_ratio": 0, "debt_to_equity_ratio": 0 } }
  ```
- For any CTOS enquiry (company, director, or shareholder), also extract:
  ```json
  {
    "legal_cases": [ { "case_type": "defendant", "plaintiff": "", "defendant": "", "case_no": "", "remark": "" } ],
    "trade_references": [ { "referee": "", "account_no": "", "capacity": "", "statement_date": "", "default_amount": 0 } ]
  }
  ```
  Map Section D1 rows to `case_type: "defendant"` and Section D2 rows to `case_type: "plaintiff"`.
- For NetReveal reports, extract:
  ```json
  { "dob_doi": "", "nationality": "", "check_name": "", "uid": "", "watchperson_details": "" }
  ```
- As in Module 1: validate every extraction response with Zod before writing to the database; on validation failure, mark the source document `upload_status = 'failed'` rather than writing partial/malformed rows.
- For `/screening-summary`, prompt the AI with the vendor's full Module 1 profile plus all Module 2 records and ask for a concise risk-relevant narrative (financial position, any legal exposure, any watchlist hits) — this is a summary of existing structured data, not a new extraction, so it doesn't need Zod validation, just a length/non-empty check before saving.

---

## 4. One small Module 1 addition required

Add a lightweight `GET /api/vendors/:id/subjects` endpoint (company + each director + each shareholder, each with an `id`/`type`/`name`) so Module 2's "who is this enquiry about" subject picker can populate its dropdown from Module 1 data without duplicating logic. This is additive only — it doesn't change any existing Module 1 table or endpoint.

---

## 5. Frontend UI (Module 2)

Replace the Module 2 "Coming soon" placeholder with:

1. **Screening Intelligence dashboard** (`/vendor/:vendorId/screening`):
   - **AI Summary panel** at the top — the latest `screening_summaries` text, with a "Regenerate Summary" button that calls `POST /screening-summary` and shows a loading state.
   - **Financial Highlights card** — the company-level CTOS financial figures in a clean stat-grid layout (Revenue, Net Income, Current Ratio, Debt-to-Equity prominently; the rest below).
   - **Legal Cases section** — two sub-tabs or a filter toggle for **D1 (Defendant)** vs **D2 (Plaintiff)**, each an editable table; each row shows which subject (company/director/shareholder name) it belongs to via a small tag/badge.
   - **Trade References table** — same subject-tagging pattern.
   - **NetReveal Watchlist section** — one card per subject searched, showing DOB/DOI, Nationality, Check Name, UID, and Watchperson Details; give the card a visible warning style (e.g. amber/red left border) whenever `watchperson_details` is non-empty, since that's the highest-signal field for a reviewer.
   - **"Add CTOS Enquiry" and "Add NetReveal Search" buttons** — open a modal: pick subject type (Company / a director from Module 1 / a shareholder from Module 1, populated via the `/subjects` endpoint from Section 4), then upload the report file. On upload, run the same two-pane (PDF preview + editable extracted fields) review pattern used in Module 1, ending with the same `is_verified` confirm-per-section flow.
2. Update the **Vendor Profile summary page** built in Module 1 (Section 5.4, item 3) to replace its "Screening Intelligence — coming soon" placeholder with a condensed read-only version of the dashboard above (summary text + key financial stats + a count of legal cases and watchlist flags).

---

## 6. Definition of Done for Module 2

- [ ] Prisma migration adds `ctos_enquiries`, `ctos_financial_highlights`, `ctos_legal_cases`, `ctos_trade_references`, `netreveal_records`, `screening_summaries` — Module 1 tables untouched.
- [ ] `GET /api/vendors/:id/subjects` added.
- [ ] Full upload → extract → reviewer-verify flow works end-to-end for a CTOS company report, a CTOS director report, and a NetReveal report.
- [ ] `GET /api/vendors/:id/screening` returns the full aggregated payload the dashboard needs in one call.
- [ ] AI summary generation works and stores a new `screening_summaries` row each time it's regenerated (history preserved, not overwritten).
- [ ] Screening Intelligence dashboard fully replaces the Module 2 placeholder tab; Vendor Profile page updated with the condensed view.
- [ ] Seed script extended with sample CTOS/NetReveal data for at least one seeded vendor.
