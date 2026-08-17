# Development

How to run Cheapskate locally, contribute, or host your own instance.

The app is a Vue 3 + Vite SPA (`frontend/`) on Supabase (Postgres, Auth, and Deno edge functions under `supabase/`).

## Prerequisites

- **Docker** — required by the [Supabase CLI](https://supabase.com/docs/guides/cli) for local Postgres, Auth, Studio, and functions
- **Node.js 22** — CI uses 22; current frontend tooling expects a recent Node 20/22
- **npm**
- **Supabase CLI** — [install guide](https://supabase.com/docs/guides/cli)

## Project structure

```
cheapskate/
├── .github/workflows/   # CI: lint, format, build; deploy to Bunny CDN on main
├── supabase/
│   ├── migrations/      # Database schema (tables, RLS policies)
│   └── functions/       # Edge Functions (Deno/TypeScript)
│       ├── _shared/         # Shared parse-pdf schema/prompt (also imported by the frontend)
│       ├── parse-pdf/       # PDF statement parsing via OpenRouter
│       └── delete-account/  # Deletes the authenticated user's account
└── frontend/            # Vue 3 + Vite app
    └── scripts/         # Demo seed, institution icon fetch
```

## External services

| Service | When you need it |
|---------|------------------|
| **[Supabase](https://supabase.com)** | Always — database, auth, edge functions |
| **[Google Cloud](https://console.cloud.google.com)** | Only if you want “Sign in with Google”. Email/password works without it. |
| **[OpenRouter](https://openrouter.ai)** | Cloud PDF statement parsing. Skip if you parse with a local LLM (Ollama or OpenAI-compatible) under Profile & Settings. |
| **[Bunny CDN](https://bunny.net)** (or any static host) | Production frontend hosting |

## Local development

### 1. Start Supabase

From the repo root:

```bash
supabase start
```

This applies migrations and starts local Postgres, Auth, Studio, and related services. API is at `http://127.0.0.1:54321`.

`supabase status` prints URLs and the local `anon` / `service_role` keys.

To wipe the local database and re-apply migrations: `supabase db reset`.

### 2. Configure edge functions (optional)

Needed for **cloud** PDF parsing. Skip this if you will only use a local LLM.

```bash
cp supabase/.env.example supabase/.env
# Set OPENROUTER_API_KEY (https://openrouter.ai/settings/keys)

supabase functions serve --env-file ./supabase/.env
```

Optionally set `OPENROUTER_MODEL` (defaults to `google/gemini-3-flash`). Browse models at [openrouter.ai/models](https://openrouter.ai/models).

Hosted functions already receive `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`; `parse-pdf` only needs the OpenRouter secret. `delete-account` needs no extra secrets.

### 3. Sign-in

**Email/password** works locally with no extra setup. If confirmations are enabled, messages show up in Inbucket (`http://127.0.0.1:54324`).

**Google OAuth** is optional. Local Auth (Studio) and a hosted project are separate — you must enable the Google provider in each place you want it. One Google OAuth client can list both local and production redirect URIs.

1. In [Google Cloud Console](https://console.cloud.google.com), create a project (or reuse one).
2. **Google Auth Platform → Branding** — app name and contact email.
3. **Audience** — External. Testing mode is fine (add test users); publishing allows any Google account. Only `email` and `profile` scopes are needed (non-sensitive; no Google verification).
4. **Clients → Create Client → Web application**. Authorized JavaScript origins:
   - `http://127.0.0.1:54321` (local)
   - your production Supabase URL (`https://xxxxx.supabase.co`)
   
   Authorized redirect URIs:
   - `http://127.0.0.1:54321/auth/v1/callback`
   - `https://xxxxx.supabase.co/auth/v1/callback`
5. Copy the client ID and secret.
6. Enable **Authentication → Providers → Google** and paste the credentials:
   - Local: [Studio](http://127.0.0.1:54323)
   - Production: hosted Supabase dashboard
7. **Authentication → URL Configuration** — add frontend origins to the redirect allowlist, e.g. `http://localhost:5173/**` and `https://yourdomain.com/**`. Do this on each Auth instance (local and/or hosted).

### 4. Start the frontend

```bash
cd frontend
npm install

# Env files select the backend (Vite --mode):
#   .env.localdev  → local Supabase (127.0.0.1:54321)
#   .env.cloud     → hosted project
# See .env.example. .env.localdev already has the standard local demo anon key.
# For your own hosted project, put its URL + anon key in .env.cloud.

npm run dev:local    # or: npm run dev:cloud
```

Frontend: `http://localhost:5173`.

The SPA uses hash routing (`/#/accounts`, …), so any static host works without rewrite rules.

### 5. Seed demo data (optional)

Populates the database chosen by the Vite mode with a two-person household (~10 months of history, including a home purchase). Alex and Jordan are marked read-only; that family cannot be joined.

```bash
cd frontend
# Service role key from `supabase status` (local) or the project API settings (hosted)
SUPABASE_SERVICE_ROLE_KEY=<service_role_key> npm run seed:local
# or: ... npm run seed:cloud
```

`seed:cloud` writes to whatever project is in `.env.cloud`. Only use it on a database you are willing to mutate. Do not pass `--create-newbie` against cloud — that account is writable and is only for local empty-state testing.

Log in with password `demo-password-123`:

| Email | Purpose |
|-------|---------|
| `alex@skate.cheap` | Full demo family member (read-only) |
| `jordan@skate.cheap` | Spouse / co-member of the same family (read-only) |
| `newbie@skate.cheap` | Brand-new user (lands on setup; writable). Only created with `--create-newbie`. |

Both phases run by default (cleanup, then create). Cleanup still deletes `newbie@` if it exists, even when you do not recreate it.

```bash
npm run seed:local -- --skip-creation    # cleanup only
npm run seed:local -- --skip-cleanup     # create onto a clean DB
npm run seed:local -- --create-newbie    # also create the empty setup-test user
```

### Frontend scripts

From `frontend/`:

| Script | Purpose |
|--------|---------|
| `npm run dev:local` / `dev:cloud` | Vite dev server |
| `npm run build` | Typecheck + production build → `dist/` |
| `npm run preview` | Serve the production build |
| `npm run lint` / `lint-fix` | ESLint (`--max-warnings=0`; CI runs `lint`) |
| `npm run format` / `format-fix` | Prettier check / write (CI runs `format`) |
| `npm run seed:local` / `seed:cloud` | Demo data (needs `SUPABASE_SERVICE_ROLE_KEY`) |
| `npm run fetch-institution-icons` | Refresh favicons in `src/assets/institutions/` |

## Hosting your own

### 1. Create a Supabase project

1. Create a project at [supabase.com/dashboard](https://supabase.com/dashboard)
2. Link the CLI:
   ```bash
   supabase login
   supabase link --project-ref <your-project-id>
   ```
3. Push schema:
   ```bash
   supabase db push
   ```
4. Put the project URL and anon key in `frontend/.env.cloud`. Enable Google (and redirect URLs) on **this** project if you want Google sign-in — see [Sign-in](#3-sign-in).

### 2. Deploy edge functions

```bash
supabase secrets set --env-file supabase/.env
supabase functions deploy parse-pdf
supabase functions deploy delete-account
```

### 3. Deploy the frontend

The repo’s GitHub Actions workflow (`.github/workflows/deploy.yml`) lints, format-checks, builds, and deploys to Bunny CDN on push to `main`.

**Required GitHub Secrets:**

- `VITE_SUPABASE_URL` — hosted Supabase project URL
- `VITE_SUPABASE_ANON_KEY` — anon (publishable) key
- `BUNNY_STORAGE_ZONE_NAME`
- `BUNNY_STORAGE_ZONE_PASSWORD`
- `BUNNY_ACCESS_KEY`
- `BUNNY_PULL_ZONE_ID`

Or build and upload `dist/` to any static host:

```bash
cd frontend
VITE_SUPABASE_URL=https://xxx.supabase.co VITE_SUPABASE_ANON_KEY=xxx npm run build
```

## Database schema

| Table | Purpose |
|-------|---------|
| `families` | Groups of users who share data |
| `profiles` | Per-user name, family membership, and `preferences` (e.g. local LLM) |
| `accounts` | Investment accounts; `institution`, `last4`, `is_archived`, `in_portfolio` |
| `assets` | Securities and private assets (stocks, real estate, cash, debt, etc.) |
| `asset_classes` | User-defined categories with color and target `goal` (0–1) |
| `asset_allocations` | Maps assets to classes with percentages |
| `asset_aliases` | Per-account statement label → asset (ticker-less holdings) |
| `updates` | Portfolio change events |
| `price_updates` | Asset prices belonging to an update |
| `holding_updates` | Asset quantities belonging to an update |

Prices and holdings are children of `updates`, not standalone history tables. An update has a type (`statement`, `manual_price`, `manual_holdings`, `mark_as_closed`, or `include_in_portfolio`), an effective date, and optional account scope. Close and include-in-portfolio dates live on the update row; `accounts.is_archived` and `accounts.in_portfolio` should reflect current state.

### Family sharing

Each user belongs to exactly one family (including single-person households). New users create a family or join with its UUID; joining skips onboarding. `created_by` on `accounts`, `assets`, and `asset_classes` is an audit trail. Leaving or deleting the last member deletes that family (and its data via cascade).

## Family-sharing security model

Family sharing is **security by obscurity**, kept lightweight for a trusted household.

The family UUID is a shared secret: anyone signed in who has it can join. There is no invite flow or membership table — the client stores `family_id` in the user’s `user_metadata`, and RLS scopes every table with `auth.jwt() -> 'user_metadata' ->> 'family_id'`.

`families` allows `INSERT` but not `SELECT`, so ids cannot be listed or scanned. A UUID is impractical to guess; treat it like a password and only share it with people you already trust.

## Edge functions

Both functions require a real user JWT (`Authorization: Bearer …`). The anon key is not enough. They validate the session with `getUser()` (`verify_jwt` is off in `config.toml` because of that).

### parse-pdf

Parses investment statement PDFs via OpenRouter (default model `google/gemini-3-flash`). The client extracts text + coordinates from the PDF and sends that — not the PDF bytes.

A **local LLM** path (Ollama or OpenAI-compatible, configured under Profile & Settings) runs in the browser and does not call this function.

- **Endpoint:** `POST /functions/v1/parse-pdf`
- **Body:** `{ "tsv": "<quantized statement TSV>" }`
- **Returns:**
  ```json
  {
    "holdings": [
      {
        "name": "Vanguard Total Stock Market ETF",
        "ticker": "VTI",
        "quantity": 100.5,
        "total_value": 25125.00,
        "price": 250.00
      }
    ],
    "statement_date": "2025-01-31",
    "last4": "1234"
  }
  ```

`ticker` is null when the statement has no ticker printed. Cash uses `$CASH`; liabilities use `$DEBT`. `statement_date` and `last4` are optional. `price` is optional (derived from value/quantity when omitted).

### delete-account

Deletes the authenticated user’s auth account (cascades profile/family data via DB triggers). Invoked from Profile & Settings.

- **Endpoint:** `POST /functions/v1/delete-account`
- **Body:** none
