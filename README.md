# Cheapskate - Personal Investment Tracker

Track your net worth and portfolio composition across brokerage accounts, retirement funds, and private assets.

## External Services Required

- **Supabase** - Database, auth, and edge functions ([supabase.com](https://supabase.com))
- **Google Cloud** - OAuth for "Sign in with Google" ([console.cloud.google.com](https://console.cloud.google.com))
- **OpenRouter** - PDF statement parsing via LLM ([openrouter.ai](https://openrouter.ai))
- **Bunny CDN** - Frontend hosting ([bunny.net](https://bunny.net)) — or any static host

## Project Structure

```
cheapskate/
├── supabase/
│   ├── migrations/      # Database schema (tables, RLS policies)
│   └── functions/       # Edge Functions (Deno/TypeScript)
│       └── parse-pdf/   # PDF statement parsing via OpenRouter
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

Optionally set `OPENROUTER_MODEL` to use a different model (defaults to `google/gemini-2.5-flash`). Browse available models at [openrouter.ai/models](https://openrouter.ai/models).

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

# Create .env with local Supabase URLs
cp .env.example .env
# Default .env points to local Supabase (127.0.0.1:54321)

npm run dev
```

Frontend runs at `http://localhost:5173`.

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
| `updates` | Portfolio change events (statement, manual price/holdings, close) |
| `price_updates` | Asset prices belonging to an update |
| `holding_updates` | Asset quantities belonging to an update |

Prices and holdings are stored as children of `updates` rather than standalone history tables. An update has a type (`statement`, `manual_price`, `manual_holdings`, or `mark_as_closed`), an effective date, and optional account scope.

### Family Sharing

Data is shared at the family level, allowing multiple users to view and edit the same accounts and assets. Each user belongs to exactly one family (even single-person households).

- **New users** are prompted to create a new family or join an existing one by entering its UUID
- **Family ID** is stored in Supabase `user_metadata` and included in the JWT for fast RLS checks
- **RLS policies** use `auth.jwt() -> 'user_metadata' ->> 'family_id'` to scope data access
- **`created_by`** column on `accounts`, `assets`, and `asset_classes` tracks which user created each record (audit trail)

All tables use Row Level Security (RLS) — users can only access data belonging to their family.

## Edge Functions

### parse-pdf

Parses investment statement PDFs via OpenRouter (defaults to Gemini 2.5 Flash). The client extracts quantized TSV text from the PDF and sends that to the function.

- **Endpoint:** `POST /functions/v1/parse-pdf`
- **Auth:** Requires Supabase user JWT in Authorization header
- **Body:** `{ "tsv": "<quantized statement TSV>" }`
- **Returns:**
  ```json
  {
    "holdings": [
      { "name": "VTI", "quantity": 100.5, "total_value": 25125.00, "price": 250.00 }
    ],
    "statement_date": "2025-01-31"
  }
  ```
