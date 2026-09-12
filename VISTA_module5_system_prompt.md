# VISTA — Module 5 Build Spec: GEN AI Smart KYV Report Generation
## Addendum to CLAUDE.md + VISTA_module2/3/4_system_prompt.md — hand this to Claude Code once Modules 1–4 are confirmed working

This continues the existing VISTA project. Modules 1–4 are already built. Module 5 doesn't collect any new raw findings — it's the module where everything confirmed across Modules 1–4 finally gets assembled into one approval-ready document. Follow the same conventions already established in `CLAUDE.md` (Section 6): TypeScript strict mode, Zod validation, Prisma migrations, one AI service module per concern.

**AI provider note:** Use the same AI provider already wired into Modules 1–4.

**No real template yet:** The bank doesn't have an existing KYV report template. Build a **configurable placeholder template stored in the database** (not hardcoded in application code), so that when the bank's real template is finalized, someone can add a new template row and mark it active — no redeploy required.

---

## 1. What Module 5 does

A reviewer generates a KYV report for a vendor. The AI drafts a narrative for each section of the report using: the vendor's Module 1 profile (corporate info, directors, shareholders), Module 2's financial highlights / legal cases / trade references / NetReveal results, Module 3's adverse media findings, and Module 4's triage decisions and confidence context — but **only using findings the reviewer has already confirmed as `relevant`** (never `false_positive`, and ideally not `pending` either — see Section 3's validation rule). The reviewer can then edit the AI-drafted text before sending it through a **Maker-Checker** approval flow: one reviewer prepares/submits, a different reviewer approves or rejects.

---

## 2. Database schema (Module 5)

```sql
-- The placeholder template structure. Sections are data, not code, so a new real
-- template can be added later without touching the report-generation logic.
CREATE TABLE report_templates (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(255) NOT NULL,
    version         VARCHAR(50) NOT NULL,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    sections        JSONB NOT NULL, -- ordered array: [{ "section_key": "", "title": "", "instructions": "" }, ...]
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One row per generated report (a vendor can have several over time — redone, re-approved, etc.)
CREATE TABLE kyv_reports (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id           UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    template_id         UUID NOT NULL REFERENCES report_templates(id),
    status              VARCHAR(30) NOT NULL DEFAULT 'draft', -- 'draft' | 'pending_checker_review' | 'approved' | 'rejected'
    prepared_by         UUID REFERENCES users(id), -- the "Maker"
    reviewed_by         UUID REFERENCES users(id), -- the "Checker"
    reviewed_at         TIMESTAMPTZ,
    reviewer_comments   TEXT, -- required when status = 'rejected'
    generated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    generated_by_model  VARCHAR(100)
);

-- One row per section of a specific report, editable independently
CREATE TABLE kyv_report_sections (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id       UUID NOT NULL REFERENCES kyv_reports(id) ON DELETE CASCADE,
    section_key     VARCHAR(100) NOT NULL, -- matches a section_key from the template
    title           VARCHAR(255) NOT NULL,
    content         TEXT NOT NULL,          -- AI-drafted, reviewer-editable
    section_order   INT NOT NULL,
    is_edited       BOOLEAN NOT NULL DEFAULT false, -- true once a reviewer changes the AI draft
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_kyv_reports_vendor ON kyv_reports(vendor_id);
CREATE INDEX idx_kyv_sections_report ON kyv_report_sections(report_id);
```

**Placeholder template seed data** (insert one `report_templates` row via the seed script, `is_active = true`), with these default sections in `sections`:

```json
[
  { "section_key": "executive_summary", "title": "Executive Summary", "instructions": "One paragraph overview of the vendor and the overall risk conclusion." },
  { "section_key": "corporate_profile", "title": "Corporate Profile", "instructions": "Summarize Module 1 corporate info, directors, and shareholders." },
  { "section_key": "financial_summary", "title": "Financial Summary", "instructions": "Summarize CTOS financial highlights and any notable ratios or trends." },
  { "section_key": "legal_regulatory_findings", "title": "Legal & Regulatory Findings", "instructions": "Summarize confirmed-relevant CTOS legal cases and any NetReveal watchlist hits." },
  { "section_key": "adverse_media_findings", "title": "Adverse Media Findings", "instructions": "Summarize confirmed-relevant adverse media articles, grouped by risk theme." },
  { "section_key": "risk_assessment_recommendation", "title": "Risk Assessment & Recommendation", "instructions": "Overall risk narrative and a recommendation (approve / approve with conditions / escalate / decline), justified by the findings above." }
]
```

**Design notes:**
- `report_templates.sections` being JSONB (not a separate table) keeps the template genuinely swappable — the generation logic should loop over whatever sections the active template defines, not assume these six specifically.
- `kyv_reports` keeps a full history — generating a new report for a vendor creates a new row rather than overwriting a previous one, since past reports may need to remain visible for audit even after a newer one is approved.
- `is_edited` on sections isn't just cosmetic — Module 7's Knowledge Repository will later want to know which AI drafts reviewers changed and how, as a feedback signal.

---

## 3. Backend API (Module 5)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/report-templates` | List templates (for an admin to see/manage which is active) |
| POST | `/api/report-templates` | Add a new template (for when the real bank template arrives) |
| PUT | `/api/report-templates/:id/activate` | Mark one template active (and implicitly deactivate the others) |
| POST | `/api/vendors/:id/kyv-reports` | Generate a new report: uses the currently active template, gathers confirmed data from Modules 1–4 (see validation rule below), calls AI once per section (or one call producing all sections, your choice, but each section's result must map to a `kyv_report_sections` row), creates the `kyv_reports` row (`status = 'draft'`) and its sections |
| GET | `/api/vendors/:id/kyv-reports` | List all reports generated for a vendor (history), most recent first |
| GET | `/api/kyv-reports/:id` | Get one report with all its sections |
| PUT | `/api/kyv-reports/:id/sections/:sectionId` | Reviewer edits a section's content (sets `is_edited = true`) |
| PUT | `/api/kyv-reports/:id/submit-for-review` | Maker submits a draft report for Checker approval (`status → pending_checker_review`) |
| PUT | `/api/kyv-reports/:id/approve` | Checker approves (`status → approved`, sets `reviewed_by`/`reviewed_at`) |
| PUT | `/api/kyv-reports/:id/reject` | Checker rejects (`status → rejected`, requires `reviewer_comments`) — a rejected report can be edited and resubmitted |
| GET | `/api/kyv-reports/:id/export` | Export the report as a PDF (render the sections into a simple, clean PDF layout — a basic HTML-to-PDF render, e.g. via Puppeteer, is enough for this phase) |

**Validation rule before generating a report:** Before calling `POST /kyv-reports`, check whether the vendor has any `pending` (undecided) findings across `netreveal_records.risk_decision`, `ctos_legal_cases.risk_decision`, or `adverse_media_articles.reviewer_decision`. If so, still allow generation (don't hard-block — reviewers may need a draft to work from) but return a `warnings` array in the response (e.g. `"3 findings are still pending triage decision and were excluded from this report"`), and the frontend must surface this warning prominently. Only `relevant`-decision findings should ever be included in the AI's input data for drafting sections.

**Report-generation prompt design guidance:**
- Build a data package per vendor: Module 1 profile, Module 2's financial highlights + confirmed-relevant legal cases/trade references/NetReveal records, Module 3's confirmed-relevant adverse media articles (use their existing `ai_summary`, don't re-derive from source), and Module 4's triage rationale for context on why each included finding was judged relevant.
- For each section in the active template, send the AI that section's `instructions` plus the relevant slice of the data package, and ask for plain narrative text (not JSON) for that section's `content`. Keep prompts scoped per section rather than asking for the whole report in one call, so a bad output in one section doesn't force regenerating everything.
- This is narrative drafting from already-verified structured data, not new extraction — a length/non-empty check on each section's output is sufficient validation; full Zod schema validation isn't necessary here.

---

## 4. Frontend UI (Module 5)

Replace the Module 5 "Coming soon" placeholder with:

1. **KYV Report page** (`/vendor/:vendorId/kyv-report`):
   - **Report history list** at the top — every report generated for this vendor, with status badge (Draft / Pending Checker Review / Approved / Rejected), generated date, and an "Open" action. A **"Generate New Report"** button.
   - **Report editor view** (opened from the history list or right after generation):
     - Each section from the template rendered as its own editable text block, in template order, with the section title as a heading.
     - A visible "AI-drafted" vs "Edited by reviewer" indicator per section (from `is_edited`).
     - The pending-findings warning banner (from Section 3's validation rule) shown at the top if applicable.
     - Maker-Checker action buttons appropriate to the report's current `status`: **Submit for Review** (draft), **Approve** / **Reject** (pending_checker_review — reject requires a comment), and a read-only view once **approved**.
     - An **Export PDF** button, available at any status.
2. Update the **Vendor Profile summary page** to show the latest report's status (e.g. "Approved — 12 Sep 2026" or "No report generated yet") with a link into this page.

---

## 5. Small additions to earlier modules

None required — Module 5 only reads from Modules 1–4's existing tables/endpoints; it doesn't need any new fields on them.

---

## 6. Definition of Done for Module 5

- [ ] Prisma migration adds `report_templates`, `kyv_reports`, `kyv_report_sections` — no existing tables altered.
- [ ] Seed script inserts the default placeholder template (Section 2) as the single active template.
- [ ] `POST /kyv-reports` generates a report using only `relevant`-decision findings, correctly warns about any still-`pending` findings, and produces one `kyv_report_sections` row per section in the active template.
- [ ] Reviewer can edit any section's content and it persists with `is_edited = true`.
- [ ] Full Maker-Checker flow works: draft → submit for review → approve (or reject with a required comment, then edit and resubmit).
- [ ] PDF export produces a readable document containing all sections in order.
- [ ] Adding a new `report_templates` row and activating it changes what sections the *next* generated report contains, with no code changes required.
- [ ] KYV Report page fully replaces the Module 5 placeholder tab; Vendor Profile page shows latest report status.
