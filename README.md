# VISTA — Vendor Intelligence Screening & Trust Assessment

An AI-powered Vendor Risk Intelligence web app for a bank's Know Your Vendor (KYV) process. This repo currently implements **Module 1: Digital Intake & Entity Extraction** plus the app shell for modules 2–7. See [CLAUDE.md](CLAUDE.md) for the full product/build spec.

## Stack

- **Frontend:** React 18 + TypeScript, Vite, React Router, TailwindCSS + shadcn/ui, TanStack Query
- **Backend:** Node.js + Express + TypeScript, Prisma ORM
- **Database:** PostgreSQL
- **AI extraction:** Google Gemini API (`@google/genai`)
- **Monorepo:** npm workspaces (`packages/frontend`, `packages/backend`, `packages/shared-types`)

## Prerequisites

- Node.js **18+**
- A running local PostgreSQL server (tested against PostgreSQL 18)
- A [Gemini API key](https://aistudio.google.com/apikey) (only needed for the document-extraction feature — everything else works without one)

## Setup

1. **Install dependencies** (installs and links all three workspace packages):

   ```bash
   npm install
   ```

2. **Create the database:**

   ```sql
   CREATE DATABASE vista;
   ```

3. **Configure the backend's environment.** Copy the example file and fill in your own values:

   ```bash
   cp packages/backend/.env.example packages/backend/.env
   ```

   ```env
   DATABASE_URL="postgresql://<user>:<password>@localhost:5432/vista?schema=public"
   PORT=4000
   GEMINI_API_KEY=<your Gemini API key>
   UPLOAD_DIR=./uploads
   ```

4. **Run migrations:**

   ```bash
   npm run prisma:migrate
   ```

5. **Seed sample data** (creates a default reviewer user and 3 sample vendors in different review states):

   ```bash
   npm run db:seed
   ```

## Running the app

```bash
npm run dev
```

This starts both servers concurrently:

- Backend: http://localhost:4000 (health check at `/api/health`)
- Frontend: http://localhost:5173 — **open this in your browser**

The frontend dev server proxies `/api/*` requests to the backend, so no extra CORS setup is needed.

## Other useful scripts

| Command | What it does |
|---|---|
| `npm run dev:backend` / `npm run dev:frontend` | Run just one side |
| `npm run build` | Type-check and build all packages |
| `npm run prisma:studio` | Open Prisma Studio (a GUI for the database) |
| `npm run prisma:migrate` | Create/apply Prisma migrations after a schema change |
| `npm run db:seed` | Re-seed the 3 sample vendors (safe to re-run — resets just those rows) |

## Notes

- There's no real authentication yet — every write is attributed to a single hardcoded "Default Reviewer" user (see `packages/backend/prisma/seed.ts`).
- Uploaded documents are stored on local disk under `packages/backend/uploads/` (gitignored) in development.
- If `npm install` warns about blocked install scripts for new/updated dependencies, run `npm install-scripts approve <package>` and then `npm rebuild` — this is npm's script-allowlisting feature, already pre-approved for the packages currently in use.
