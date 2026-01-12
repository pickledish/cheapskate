# Cheapskate - Personal Investment Tracker

Track your net worth and portfolio composition across brokerage accounts, retirement funds, and private assets.

See [plan.md](./plan.md) for the full architecture specification.

## Prerequisites

- [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started)
- [Terraform](https://www.terraform.io/downloads)
- [Gemini API Key](https://aistudio.google.com/apikey)

## Project Structure

```
cheapskate/
├── terraform/           # Infrastructure (Supabase project, settings)
├── supabase/
│   ├── migrations/      # Database migrations (tables, views, RLS policies)
│   └── functions/       # Supabase Edge Functions (Deno/TypeScript)
│       └── parse-pdf/   # PDF statement parsing via Gemini
└── frontend/            # React/Next.js app (TODO)
```

## Setup

### 1. Supabase Project (Terraform)

```bash
cd terraform

# Copy example and fill in your values
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with:
#   - supabase_access_token (from https://supabase.com/dashboard/account/tokens)
#   - supabase_organization_id
#   - supabase_db_password

# Initialize and apply
terraform init
terraform plan
terraform apply
```

### 2. Link Local CLI to Project

```bash
supabase login
supabase link --project-ref <project-id-from-terraform-output>
```

### 3. Run Database Migrations

```bash
# Push migrations to remote
supabase db push

# Or for local development
supabase start
supabase db reset  # Applies all migrations locally
```

### 4. Configure Edge Functions

Create the environment file for local development:

```bash
echo "GEMINI_API_KEY=your-gemini-api-key" > supabase/.env
```

Get a Gemini API key from https://aistudio.google.com/apikey

### 5. Deploy Edge Functions (Production)

```bash
# Set secrets for production
supabase secrets set GEMINI_API_KEY=your-gemini-api-key

# Deploy
supabase functions deploy parse-pdf
```

## Local Development

### Start Local Supabase

```bash
supabase start
```

This starts local Postgres, Auth, and other services.

### Run Edge Functions Locally

```bash
supabase functions serve --env-file ./supabase/.env
```

### Test parse-pdf Function

```bash
# Encode a PDF and send it
curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/parse-pdf' \
  --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
  --header 'Content-Type: application/json' \
  --data "$(jq -n --arg pdf "$(base64 -i /path/to/statement.pdf)" '{pdf_base64: $pdf}')"
```

Expected response:
```json
{
  "holdings": [
    { "name": "VTI", "quantity": 100.5, "total_value": 25125.00, "price": 250.00 },
    { "name": "$CASH", "quantity": 1234.56, "total_value": 1234.56 }
  ],
  "statement_date": "2025-01-31"
}
```

## Database Schema

Key tables:
- `user_accounts` - Investment accounts (401k, IRA, brokerage, etc.)
- `user_statements` - Uploaded PDF statements
- `user_securities` - All assets (public tickers and private assets like real estate)
- `user_security_positions` - Position/quantity history (linked to accounts, optionally to statements)
- `user_security_prices` - Price history (optionally linked to statements)
- `user_goals` - Target allocation for rebalancing

All tables are per-user and protected by Row Level Security (RLS).

## Edge Functions

### parse-pdf

Parses investment statement PDFs using Gemini 3 Flash.

- **Endpoint:** `POST /functions/v1/parse-pdf`
- **Auth:** Requires Supabase JWT in Authorization header
- **Body:** `{ "pdf_base64": "<base64-encoded-pdf>" }`
- **Returns:** `{ "holdings": [{ "name", "quantity", "total_value", "price?" }], "statement_date?" }`

### update-prices (TODO)

Cron job to fetch monthly market prices for securities.
