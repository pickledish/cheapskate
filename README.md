# Cheapskate - Personal Investment Tracker

Track your net worth and portfolio composition across brokerage accounts, retirement funds, and private assets.

## External Services Required

- **Supabase** - Database, auth, and edge functions ([supabase.com](https://supabase.com))
- **Google Gemini** - PDF statement parsing via [AI Studio](https://aistudio.google.com/apikey) or [Vertex AI](https://console.cloud.google.com/vertex-ai)
- **Bunny CDN** - Frontend hosting ([bunny.net](https://bunny.net)) — or any static host

## Project Structure

```
cheapskate/
├── supabase/
│   ├── migrations/      # Database schema (tables, RLS policies)
│   └── functions/       # Edge Functions (Deno/TypeScript)
│       └── parse-pdf/   # PDF statement parsing via Gemini
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

**AI Studio** (default): Get an API key from [aistudio.google.com/apikey](https://aistudio.google.com/apikey), set `GOOGLE_API_KEY`.

**Vertex AI** (optional): Get an API key from [Google Cloud Console](https://console.cloud.google.com/apis/credentials), set `GOOGLE_API_KEY` and `GOOGLE_GENAI_USE_VERTEXAI=true`.

### 3. Start Frontend

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
| `accounts` | Investment accounts (401k, IRA, brokerage, etc.) |
| `statements` | Uploaded PDF statements per account |
| `assets` | Securities and private assets (stocks, real estate, etc.) |
| `asset_prices` | Price history per asset |
| `asset_holdings` | Quantity/shares history per asset per account |
| `asset_classes` | User-defined categories (stocks, bonds, cash, etc.) |
| `asset_allocations` | Maps assets to classes with percentages |

### Family Sharing

Data is shared at the family level, allowing multiple users to view and edit the same accounts and assets. Each user belongs to exactly one family (even single-person households).

- **New users** are prompted to create a new family or join an existing one by entering its UUID
- **Family ID** is stored in Supabase `user_metadata` and included in the JWT for fast RLS checks
- **RLS policies** use `auth.jwt() -> 'user_metadata' ->> 'family_id'` to scope data access
- **`created_by`** column on `accounts`, `assets`, and `asset_classes` tracks which user created each record (audit trail)

All tables use Row Level Security (RLS) — users can only access data belonging to their family.

## Edge Functions

### parse-pdf

Parses investment statement PDFs using Gemini 3 Flash.

- **Endpoint:** `POST /functions/v1/parse-pdf`
- **Auth:** Requires Supabase user JWT in Authorization header
- **Body:** `{ "pdf_base64": "<base64-encoded-pdf>" }`
- **Returns:**
  ```json
  {
    "holdings": [
      { "name": "VTI", "quantity": 100.5, "total_value": 25125.00, "price": 250.00 }
    ],
    "statement_date": "2025-01-31"
  }
  ```
