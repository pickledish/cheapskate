# Cheapskate - Personal Investment Tracker

Track your net worth and portfolio composition across brokerage accounts, retirement funds, and private assets.

## External Services Required

- **Supabase** - Database, auth, and edge functions ([supabase.com](https://supabase.com))
- **Google Cloud** - OAuth for "Sign in with Google" ([console.cloud.google.com](https://console.cloud.google.com))
- **OpenRouter** - Cloud PDF statement parsing via LLM ([openrouter.ai](https://openrouter.ai)) — optional if using a local LLM
- **Bunny CDN** - Frontend hosting ([bunny.net](https://bunny.net)) — or any static host

## Project Structure

```
cheapskate/
├── supabase/
│   ├── migrations/      # Database schema (tables, RLS policies)
│   └── functions/       # Edge Functions (Deno/TypeScript)
│       ├── parse-pdf/       # PDF statement parsing via OpenRouter
│       └── delete-account/  # Deletes the authenticated user's account
└── frontend/            # Vue 3 + Vite app
```

## Local Development

### 1. Start Supabase

```bash
# Install Supabase CLI: https://supabase.com/docs/guides/cli
supabase start
```

This starts local Postgres, Auth, and Edge Functions at `http://127.0.0.1:54321`.

### 2. Configure Edge Functions

```bash
# Copy env template and fill in your API key
cp supabase/.env.example supabase/.env
# Edit supabase/.env with your API key

# Start edge functions
supabase functions serve --env-file ./supabase/.env
```

Get an API key from [openrouter.ai/settings/keys](https://openrouter.ai/settings/keys) and set `OPENROUTER_API_KEY` in your env file.

Optionally set `OPENROUTER_MODEL` to use a different model (defaults to `google/gemini-3-flash`). Browse available models at [openrouter.ai/models](https://openrouter.ai/models).

### 3. Set Up Google Sign-In

The app uses Google OAuth for sign-in. You need to create an OAuth client in Google Cloud Console and register it with Supabase.

1. Go to [Google Cloud Console](https://console.cloud.google.com) and create a project (or use an existing one).

2. Navigate to **Google Auth Platform → Branding** and fill in your app name and contact email.

3. Under **Audience**, select **External** and save. The app starts in testing mode — you can add test users manually, or publish to allow any Google account. Only `email` and `profile` scopes are needed, which are non-sensitive and don't require Google's verification process.

4. Go to **Clients** → **Create Client** → **Web application**. Add:
   - **Authorized JavaScript origins:**
     - `http://127.0.0.1:54321` (local Supabase)
     - Your production Supabase URL (e.g. `https://xxxxx.supabase.co`)
   - **Authorized redirect URIs:**
     - `http://127.0.0.1:54321/auth/v1/callback` (local)
     - `https://xxxxx.supabase.co/auth/v1/callback` (production)

5. Copy the **Client ID** and **Client Secret**.

6. In the Supabase Dashboard, go to **Authentication → Providers → Google**, toggle it on, and paste the Client ID and Secret.

7. Still in Supabase **Authentication → URL Configuration**, add your frontend URLs to the **Redirect URLs** allowlist (e.g. `http://localhost:5173/**` for local dev, `https://yourdomain.com/**` for production).

### 4. Start Frontend

```bash
cd frontend
npm install

# Env files select the backend (Vite --mode):
#   .env.localdev  → local Supabase (127.0.0.1:54321)
#   .env.cloud      → hosted project
# See .env.example. Edit .env.cloud with your project URL + anon key.

npm run dev:local    # or: npm run dev:cloud
```

Frontend runs at `http://localhost:5173`. Plain `npm run dev` errors on purpose so the backend choice stays explicit.

### 5. Seed Demo Data (optional)

To populate the local (or a hosted) database with a two-person demo family plus an empty new-user account:

```bash
cd frontend
# Service role key from `supabase status` (local) or the project API settings (hosted)
SUPABASE_SERVICE_ROLE_KEY=<service_role_key> npm run seed:local
# or: ... npm run seed:cloud
```

Log in with password `demo-password-123`:

| Email | Purpose |
|-------|---------|
| `alex@skate.cheap` | Full demo family member |
| `jordan@skate.cheap` | Spouse / co-member of the same family |
| `newbie@skate.cheap` | Brand-new user (lands on setup) |

Family secret (for joining): `11111111-1111-4111-8111-111111111111`

Flags (both phases run by default):

```bash
npm run seed:local -- --skip-creation   # cleanup only
npm run seed:local -- --skip-cleanup    # create onto a clean DB
```

## Production Deployment

### 1. Create Supabase Project

1. Create a project at [supabase.com/dashboard](https://supabase.com/dashboard)
2. Link your local CLI:
   ```bash
   supabase login
   supabase link --project-ref <your-project-id>
   ```
3. Push database schema:
   ```bash
   supabase db push
   ```

### 2. Deploy Edge Functions

```bash
# Set production secrets from your env file
supabase secrets set --env-file supabase/.env

# Deploy
supabase functions deploy parse-pdf
supabase functions deploy delete-account
```


### 3. Deploy Frontend

The repo includes a GitHub Actions workflow (`.github/workflows/deploy.yml`) that deploys to Bunny CDN on push to `main`.

**Required GitHub Secrets:**
- `VITE_SUPABASE_URL` - Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Your Supabase anon key
- `BUNNY_STORAGE_ZONE_NAME` - Bunny storage zone name
- `BUNNY_STORAGE_ZONE_PASSWORD` - Bunny storage zone password
- `BUNNY_ACCESS_KEY` - Bunny API access key
- `BUNNY_PULL_ZONE_ID` - Bunny pull zone ID

Or build and deploy manually:
```bash
cd frontend
VITE_SUPABASE_URL=https://xxx.supabase.co VITE_SUPABASE_ANON_KEY=xxx npm run build
# Upload dist/ to your preferred static host
```

## Database Schema

| Table | Purpose |
|-------|---------|
| `families` | Groups of users who share data |
| `profiles` | Per-user name, family membership, and preferences |
| `accounts` | Investment accounts (401k, IRA, brokerage, etc.) |
| `assets` | Securities and private assets (stocks, real estate, etc.) |
| `asset_classes` | User-defined categories (stocks, bonds, cash, etc.) |
| `asset_allocations` | Maps assets to classes with percentages |
| `asset_aliases` | Per-account label → asset mappings (for ticker-less holdings) |
| `updates` | Portfolio change events (statement, manual price/holdings, close, include in portfolio) |
| `price_updates` | Asset prices belonging to an update |
| `holding_updates` | Asset quantities belonging to an update |

Prices and holdings are stored as children of `updates` rather than standalone history tables. An update has a type (`statement`, `manual_price`, `manual_holdings`, `mark_as_closed`, or `include_in_portfolio`), an effective date, and optional account scope. Close and include-in-portfolio dates live on the update row; `accounts.is_archived` and `accounts.in_portfolio` are current-state flags.

### Family Sharing

Data is shared at the family level, allowing multiple users to view and edit the same accounts and assets. Each user belongs to exactly one family (even single-person households).

- **New users** are prompted to create a new family or join an existing one by entering its UUID
- **Family ID** is stored in Supabase `user_metadata` and included in the JWT for fast RLS checks
- **RLS policies** use `auth.jwt() -> 'user_metadata' ->> 'family_id'` to scope data access
- **`created_by`** column on `accounts`, `assets`, and `asset_classes` tracks which user created each record (audit trail)

All tables use Row Level Security (RLS) — users can only access data belonging to their family.

## Edge Functions

### parse-pdf

Parses investment statement PDFs via OpenRouter (defaults to Gemini 3 Flash). The client extracts quantized TSV text from the PDF and sends that to the function.

Alternatively, users can parse statements with a **local LLM** (Ollama or an OpenAI-compatible server) configured under Profile & Settings. That path runs entirely in the browser and does not call this function.

- **Endpoint:** `POST /functions/v1/parse-pdf`
- **Auth:** Requires Supabase user JWT in Authorization header
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

`ticker` is null when the statement has no ticker printed. `statement_date` and `last4` are optional.

### delete-account

Deletes the authenticated user's auth account (and cascades related profile/family data via DB triggers). Invoked from Profile & Settings.

- **Endpoint:** `POST /functions/v1/delete-account`
- **Auth:** Requires Supabase user JWT in Authorization header
- **Body:** none
