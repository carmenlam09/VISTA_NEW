# VISTA — Vendor Intelligence Screening & Trust Assessment
## System Prompt for Claude Code (Build Phase 1: Module 1 — Digital Intake & Entity Extraction)

Use this document as the system prompt / project brief for Claude Code. It defines the full application vision (so every module is built on a consistent foundation) and gives a complete, buildable spec for **Module 1**, which should be built first. Modules 2–7 are described at architecture level only, so Module 1 is built in a way that doesn't need to be reworked later.

---

## 1. Role and Objective

You are building **VISTA**, an AI-powered Vendor Risk Intelligence web application for a bank's Know Your Vendor (KYV) process. VISTA has 7 modules, each a tab in one single-page application, sharing one backend and one database. Your immediate task is to build **Module 1: Digital Intake & Entity Extraction**, but you must design the database, backend, and frontend shell so Modules 2–7 can be added later without breaking Module 1.

Do not build Modules 2–7 now. Only stub them (see Section 7).

---

## 2. Tech Stack (use exactly this stack)

- **Frontend:** React 18 + TypeScript, Vite, React Router (tab-based module navigation), TailwindCSS + shadcn/ui components, TanStack Query (React Query) for server state, React Hook Form + Zod for form validation.
- **Backend:** Node.js + Express + TypeScript. Use the Gemini Messages API (Gemini, with PDF/document support) for document understanding and entity extraction. Use a PDF-parsing library (e.g. `pdf-parse` or convert pages to images for Claude's vision input when the SSM report is a scanned PDF).
- **Database:** **PostgreSQL** (see Section 3 for rationale). Use **Prisma ORM** so the schema is defined in TypeScript and shared types can be generated for the frontend.
- **File storage:** Store uploaded source documents (PDFs) on local disk under `/uploads` in development (an `/api/files/:id` endpoint serves them), behind an interface that can be swapped for S3-compatible object storage later. Never store binary file contents in Postgres columns — store a file path/URL reference only.
- **Auth:** Stub a simple session/user table now (`users`, `id`, `name`, `email`, `role`) with a hardcoded "logged in as reviewer" user for this phase — do not build real authentication yet, but reference `reviewed_by` / `created_by` fields against this table so Maker-Checker workflows (Module 4/5) can be added later without a schema change.

---

## 3. Database Recommendation

**Use PostgreSQL.** Reasoning to keep in mind while building:

- The data is inherently **relational**: one vendor has many directors, many shareholders, many documents, many screening hits — Postgres foreign keys and joins model this cleanly and enforce integrity (e.g. a shareholder record can't exist without a vendor).
- Compliance/audit data (KYV reports, screening decisions) benefits from Postgres's strong transactional guarantees and mature audit/versioning patterns, over a document store's eventual consistency.
- Postgres's `JSONB` columns let you store the **raw AI extraction output** (full LLM response, confidence scores, bounding boxes) alongside strongly-typed columns for the fields that matter — best of both worlds, useful for every module (SSM data, CTOS data, adverse media results).
- The **`pgvector`** extension can be added later at zero migration cost to support semantic search over adverse news summaries and the Module 7 Knowledge Repository — plan the schema with this in mind (a `documents`-style table with a `content` text column is where an `embedding vector` column would later be added).
- It's a single, well-understood, free/open-source system — easy to run locally or self-host on-prem, which matters for a bank's data residency requirements.

---

## 4. Application Shell (build this first, before Module 1's internals)

Build the app shell before the Module 1 feature work:

- A persistent left sidebar or top tab bar with 7 tabs: **Intake & Extraction** (Module 1, active), **Screening Intelligence** (Module 2), **Adverse Media** (Module 3), **Triage** (Module 4), **KYV Report** (Module 5), **Knowledge Repository** (Module 6/7 per the proposal's later renumbering — see Section 7 note).
- Modules 2–7 tabs render a simple "Coming soon" placeholder page for now — but they must already be wired into the router and share the same layout, so adding real content later is additive only.
- A top-level **Vendor** concept ties all modules together: selecting a vendor from a list (or creating one via Module 1 intake) sets the "active vendor" in app state (e.g. via URL param `/vendor/:vendorId/intake`), and every module tab operates on that same vendor. Build this routing convention now even though only Module 1 has content.

---

## 5. Module 1 — Digital Intake & Entity Extraction: Detailed Spec

### 5.1 What it does
Reviewers upload a vendor's SSM (Companies Commission of Malaysia) report — and later, Supplier Registration Forms and vendor confirmation letters — and the app uses AI to extract structured entity data (company info, directors, shareholders) automatically, creating a unified, editable vendor profile.

### 5.2 Database schema (Module 1)

Use Prisma schema syntax; the SQL-equivalent DDL is shown for clarity.

```sql
-- Core vendor record, the anchor entity all modules attach to
CREATE TABLE vendors (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_name        VARCHAR(255) NOT NULL,
    registration_no     VARCHAR(100), -- SSM registration number, unique per company
    status              VARCHAR(50) NOT NULL DEFAULT 'draft', -- draft | in_review | approved | rejected
    created_by          UUID REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Uploaded source documents (SSM report, Supplier Reg Form, Vendor Confirmation Letter)
CREATE TABLE documents (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id           UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    doc_type            VARCHAR(50) NOT NULL, -- 'ssm_report' | 'supplier_registration_form' | 'vendor_confirmation_letter'
    file_name           VARCHAR(255) NOT NULL,
    file_path           TEXT NOT NULL,        -- storage reference, not file contents
    upload_status       VARCHAR(50) NOT NULL DEFAULT 'uploaded', -- uploaded | extracting | extracted | failed
    raw_extraction_json JSONB,                -- full AI response incl. confidence scores, for audit/debugging
    uploaded_by         UUID REFERENCES users(id),
    uploaded_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- SSM: 1. Corporate Information (one row per vendor)
CREATE TABLE ssm_corporate_info (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id               UUID NOT NULL UNIQUE REFERENCES vendors(id) ON DELETE CASCADE,
    document_id             UUID REFERENCES documents(id),
    company_name            VARCHAR(255),
    former_company_name     VARCHAR(255),
    date_of_name_change     DATE,
    date_of_incorporation   DATE,
    company_status          VARCHAR(100), -- e.g. Active, Dormant, Struck Off
    nature_of_business      TEXT,
    is_verified             BOOLEAN NOT NULL DEFAULT false, -- reviewer confirmed AI extraction
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- SSM: 2. Summary of Share Capital (one row per vendor)
CREATE TABLE ssm_share_capital (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id           UUID NOT NULL UNIQUE REFERENCES vendors(id) ON DELETE CASCADE,
    document_id         UUID REFERENCES documents(id),
    paid_up_capital     NUMERIC(18,2), -- "Paid Up Capital (Total Shared)"
    is_verified         BOOLEAN NOT NULL DEFAULT false,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- SSM: 3. Directors / Officers (many per vendor)
CREATE TABLE ssm_directors (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id           UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    document_id         UUID REFERENCES documents(id),
    name                VARCHAR(255) NOT NULL,
    ic_passport_no      VARCHAR(100),
    designation         VARCHAR(150), -- e.g. Director, Company Secretary
    is_verified         BOOLEAN NOT NULL DEFAULT false,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- SSM: 4. Shareholders / Members (many per vendor)
CREATE TABLE ssm_shareholders (
    id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id                       UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    document_id                     UUID REFERENCES documents(id),
    ic_passport_registration_no     VARCHAR(100),
    name                            VARCHAR(255) NOT NULL,
    total_shares                    NUMERIC(18,2),
    is_verified                     BOOLEAN NOT NULL DEFAULT false,
    created_at                      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_documents_vendor ON documents(vendor_id);
CREATE INDEX idx_directors_vendor ON ssm_directors(vendor_id);
CREATE INDEX idx_shareholders_vendor ON ssm_shareholders(vendor_id);
```

Notes for the implementation:
- Every extracted table has an `is_verified` boolean — the UI must let a reviewer confirm/edit AI-extracted fields before they're treated as final, since this is a compliance workflow.
- `raw_extraction_json` on `documents` preserves the full AI output for audit trail purposes even after a human edits the structured fields.
- Directors and Shareholders/Members are separate one-to-many tables since a company can have any number of each, matching the source document structure exactly.

### 5.3 Backend API (Module 1)

Build these endpoints:

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/vendors` | Create a new vendor (minimal: company_name) |
| GET | `/api/vendors` | List all vendors (for a dashboard/table view) |
| GET | `/api/vendors/:id` | Get one vendor with all related Module 1 data joined |
| POST | `/api/vendors/:id/documents` | Upload a document (multipart file + doc_type) |
| POST | `/api/documents/:id/extract` | Trigger AI extraction on an uploaded document; parses the PDF, calls Claude with a structured-extraction prompt (return JSON matching the schema above), writes results into `ssm_corporate_info` / `ssm_share_capital` / `ssm_directors` / `ssm_shareholders`, and stores the raw response in `documents.raw_extraction_json` |
| GET | `/api/documents/:id` | Get document metadata + extraction status |
| GET | `/api/files/:id` | Stream the original uploaded file (for the PDF preview pane) |
| PUT | `/api/vendors/:id/corporate-info` | Reviewer edits/confirms corporate info (sets `is_verified = true`) |
| PUT | `/api/vendors/:id/share-capital` | Reviewer edits/confirms share capital |
| POST/PUT/DELETE | `/api/vendors/:id/directors[/:directorId]` | CRUD for director rows (reviewer can add a missed director or fix extraction errors) |
| POST/PUT/DELETE | `/api/vendors/:id/shareholders[/:shareholderId]` | CRUD for shareholder rows |

**Extraction prompt design guidance:** When calling Claude for extraction, send the document content (as PDF or page images) with a system prompt instructing it to return **only** a JSON object matching this shape:
```json
{
  "corporate_info": { "company_name": "", "former_company_name": "", "date_of_name_change": "", "date_of_incorporation": "", "company_status": "", "nature_of_business": "" },
  "share_capital": { "paid_up_capital": 0 },
  "directors": [ { "name": "", "ic_passport_no": "", "designation": "" } ],
  "shareholders": [ { "ic_passport_registration_no": "", "name": "", "total_shares": 0 } ]
}
```
Use a low temperature, validate the JSON server-side (e.g. with Zod) before writing to the database, and fall back to `null`/empty fields with a flagged `upload_status = 'failed'` if the model output doesn't validate — never silently write malformed data.

### 5.4 Frontend UI (Module 1) — build this first, screen by screen

1. **Vendor List / Dashboard page** (`/`) — table of all vendors: name, registration no., status, date created, "Open" action. A "New Vendor" button.
2. **New Vendor / Intake page** (`/vendor/:vendorId/intake`) — this is the core Module 1 screen:
   - Drag-and-drop upload zones for each document type (SSM Report required first; Supplier Registration Form and Vendor Confirmation Letter can be added as additional upload slots even if their extraction schemas aren't built yet — just store the file).
   - After an SSM report is uploaded, show an "Extracting..." state, then automatically display a **two-pane review layout**: left pane = PDF preview of the uploaded document (use `react-pdf` or an `<iframe>` to the `/api/files/:id` endpoint); right pane = editable structured form, sectioned exactly as: **Corporate Information**, **Summary of Share Capital**, **Directors/Officers** (editable table, add/remove rows), **Shareholders/Members** (editable table, add/remove rows).
   - Each extracted field shows a subtle "AI-extracted" indicator until the reviewer confirms it; a "Confirm & Save" button per section sets `is_verified = true` for that section.
   - A persistent vendor header showing company name and overall completion status ("2 of 4 sections verified").
3. **Vendor Profile / Summary page** (`/vendor/:vendorId`) — read-only consolidated view of everything captured in Module 1 for that vendor, which is what Modules 2–7 will eventually build upon. Include an empty-state panel per future module ("Screening Intelligence — coming soon") so the page's final layout is visible now.

---

## 6. Coding Conventions

- TypeScript strict mode on both frontend and backend; share types via a `packages/shared-types` folder or Prisma-generated types.
- Validate all API input/output with Zod schemas colocated with the route handlers.
- Keep AI-extraction logic in its own service module (e.g. `services/extraction/ssmExtractor.ts`) so Modules 2 and 3 (which also call AI/external APIs) can follow the same pattern later.
- Write Prisma migrations for every schema change; never hand-edit the database.
- Include a seed script with 2–3 sample vendors and dummy SSM data for local development.

---

## 7. Forward Note on Modules 2–7 (for context only — do not build yet)

So the Module 1 foundation doesn't need rework, keep in mind that later modules will each add their own tables following the same `vendor_id`-anchored pattern established above:

- **Module 2** will add `ctos_financial_highlights`, `ctos_legal_cases` (with a `case_type` column for D1 Defendant vs D2 Plaintiff), `ctos_trade_references`, and `netreveal_records` — all keyed to `vendor_id`.
- **Module 3** will add `adverse_media_articles` (searched_entity, article_title, article_link, ai_summary), populated via Google SERP API + AI summarization.
- **Module 4** will add a `risk_triage_results` table with confidence scores referencing Module 2/3 findings.
- **Module 5** will add a `kyv_reports` table (generated from a placeholder template, to be replaced once the bank's real template is available).
- **Module 6/7** (the proposal numbers this inconsistently — treat it as one Knowledge Repository module) needs a search/retrieval page over all historical vendor records; plan for a `pgvector` embedding column on a searchable summary table when that module is built.

Do not implement these now; this section exists only so Module 1's schema and API patterns generalize cleanly.

---

## 8. Definition of Done for This Build Phase

- [ ] App shell with 7 tabs, routing by `/vendor/:vendorId/:moduleSlug`, Modules 2–7 as placeholders.
- [ ] Postgres schema for `users`, `vendors`, `documents`, `ssm_corporate_info`, `ssm_share_capital`, `ssm_directors`, `ssm_shareholders` created via Prisma migration.
- [ ] Vendor list, intake/upload, AI-extraction pipeline, and reviewer-edit UI fully working end-to-end for an SSM report PDF.
- [ ] Vendor Profile summary page rendering all captured Module 1 data.
- [ ] Seed data + a working local dev setup (`npm run dev` starts both frontend and backend, migrations run cleanly).