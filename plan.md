This is a comprehensive architectural specification for the "Personal Investment Tracker" application. It is designed to track Net Worth and Portfolio Composition over time, handling both automated public market data and manual private asset entries.

---

# Architecture Specification: Personal Investment Tracker

## 1. Executive Summary

This application is a "Serverless" web platform designed to solve the problem of tracking investment portfolios that consist of both sparse data (irregular PDF statements) and manual illiquid assets (Real Estate/Private Equity).

**Core Philosophy:**

* **Separation of Facts vs. Dimensions:** Statement data (Facts) is stored sparsely; Market data (Dimensions) is filled continuously.
* **Dual Scope:** The app supports two distinct views—**"Net Worth"** (All assets) and **"Investable Portfolio"** (Liquid assets only for rebalancing).
* **Zero-Maintenance Infrastructure:** Uses Supabase (DB/Auth/Edge Functions) and Cloudflare Pages (Hosting) to eliminate server management.

---

## 2. High-Level Architecture

* **Database & Auth:** Supabase (PostgreSQL)
  * Handles Auth, Data Storage, and Row-Level Security (RLS).

* **Compute:** Supabase Edge Functions (Deno)
  * **`parse-pdf`:** Validates User JWT -> Parses PDF via LLM -> Returns structured JSON.
  * **`update-prices`:** Scheduled monthly -> Fetches public market prices -> Updates DB.
  * Deployed via `supabase functions deploy`, code lives in `functions/` directory.

* **Frontend:** Cloudflare Pages (Static React/Next.js)
  * Talks directly to Supabase for data fetching/auth.
  * Calls Supabase Edge Functions for PDF parsing.



---

## 3. Database Schema

*Note: All "User" tables are protected by RLS policies ensuring isolation.*

### A. Global Tables (Public Data)

*Shared reference data visible to all users.*

| Table Name | Description | Key Columns |
| --- | --- | --- |
| **`securities`** | Definitions of public assets (Stocks, ETFs). | `id` (PK), `ticker` (Unique), `name`, `allocation` (JSONB)* |
| **`security_prices`** | EOM price history. | `security_id` (FK), `price_date`, `close_price` |

> ***Note on `allocation` JSONB:** instead of hardcoded columns, we store asset breakdown as: `{"stock": 0.6, "bond": 0.4}`. This allows flexibility for things like target-date funds and future asset classes.*

### B. User Tables (Private Data)

*Protected by RLS.*

| Table Name | Description | Key Columns |
| --- | --- | --- |
| **`users`** | Auth management. IIRC created by supabase for us | `id` (PK, matches `auth.uid()`), `email` |
| **`user_accounts`** | Investment accounts (401k, IRA, Brokerage, etc.). Created manually before uploading statements. | `id`, `user_id` (FK), `name`, `account_type` (enum: retirement, brokerage, hsa, other) |
| **`user_goals`** | Rebalancing targets. | `user_id` (FK), `target_allocation` (JSONB) |
| **`user_statements`** | Represents a physical PDF statement. | `id`, `account_id` (FK to user_accounts), `statement_date` |
| **`user_statement_positions`** | "holdings" found in a statement. | `statement_id`, `security_id`, `share_quantity` |

> ***Note on Cash:** Cash is stored as a regular `user_statement_positions` row with a reserved ticker `$CASH`. This ticker exists in the `securities` table with a fixed price of $1.00 and does not require price lookups.*

### C. User Private Assets (Manual Track)

*For assets that do not have public tickers (Real Estate, Angel Investments).*

| Table Name | Description | Key Columns |
| --- | --- | --- |
| **`user_private_securities`** | Custom assets visible only to owner. | `id`, `user_id`, `name`, `allocation` (JSONB), `is_liquid` (Boolean) |
| **`user_private_prices`** | Point-in-time price history. | `security_id`, `price_date`, `price` |
| **`user_private_positions`** | Point-in-time quantity history. | `security_id`, `position_date`, `quantity` (Default 1.0) |

> ***Note on `is_liquid`:** This boolean flag allows the UI to easily filter assets for the "Investable" vs. "Net Worth" views. It is implicit that all non-private positions are liquid.*

---

## 4. Compute Layer (Supabase Edge Functions)

Edge Functions are Deno-based serverless functions deployed via `supabase functions deploy`. Code lives in the `functions/` directory of this repo.

### Function: `parse-pdf`

* **Endpoint:** `POST /functions/v1/parse-pdf`
* **Workflow:**
  1. **Auth:** Supabase automatically validates the JWT from the `Authorization` header.
  2. **Logic:** Accepts base64-encoded PDF in request body.
  3. **LLM Call:** Sends PDF to Gemini Flash with a Zod-defined JSON Schema for structured output.
  4. **Response:** Returns validated JSON: `{ holdings: [{ ticker, quantity }], statement_date? }`

* **Note:** This function **does not write to the DB**. The Frontend inserts the verified rows to Supabase.
* **Note on Unknown Tickers:** If the PDF contains a ticker not present in the `securities` table, the frontend will error on insert. For now, new securities are added manually to the Supabase table. A proper UI for this can be added later.

### Function: `update-prices` (Cron)

* **Schedule:** 1st of every month (configured in Supabase Dashboard or via `supabase functions deploy --schedule`).
* **Workflow:**
  1. **Query:** Fetches all unique tickers from the global `securities` table.
  2. **Fetch:** Hits a financial data API (e.g., Yahoo/AlphaVantage) for the previous month's closing price.
  3. **Write:** Inserts new rows into `security_prices` using the Supabase Service Role Key (available as `SUPABASE_SERVICE_ROLE_KEY` env var).



---

## 5. Frontend Strategy

The frontend is a "thick client" application hosted on **Cloudflare Pages**.

### Data Access Pattern

* **Direct DB Access:** The frontend uses the Supabase JS Client to query the database directly.
* **Security:** This is safe because Row Level Security (RLS) policies are enforced on the Postgres server. A user cannot query `user_statements` unless the `user_id` matches their auth token.

### Core UI Views

1. **Net Worth Tab:**
* **Data Source:** `user_statement_positions` + `user_private_positions`.
* **Logic:** Aggregates **all** assets.
* **Visualization:** Stacked Area/Bar chart showing Total Wealth over time (Liquidity + Illiquid Assets).


2. **Investments Tab (Rebalancing):**
* **Data Source:** Same tables, but filtered by `is_liquid = TRUE` for private ones.
* **Logic:** Compares current allocation (from `securities.allocation`) vs. allocation defined in `user_goals`.
* **Visualization:** Two Pie Charts ("Current" vs. "Target") and a "Drift" table showing exactly what to buy/sell.



---

## 6. Logic & Data Flow

### The "Forward Fill" Logic

Since statement data is sparse (e.g., User uploads a PDF in Jan, but not Feb), the application must calculate the "Current State" for the dashboard.

* **Concept:** "Last Known Shares" * "Current Market Price".
* **Assumption:** Users receive statements monthly whenever there is activity. If no statement exists for a month, share quantities are unchanged from the previous statement.
* **Implementation:** A **Postgres View** (defined alongside table DDL) that:
1. Generates a calendar of month-end dates.
2. Joins to the *most recent* statement prior to that date.
3. Multiplies those shares by the price found in `security_prices` for the target date.



### The "Private Asset" Unification

* Private assets (House) and Public assets (Stock) live in separate tables but are joined via a **Union View** for reporting.
* **Updates:** Users manually insert a new row into `user_private_prices` when a valuation event occurs (e.g., Annual Appraisal, 409a for startup shares).

---

## 7. Repository Structure

```
cheapskate/
├── terraform/           # Infrastructure (Supabase project, settings)
├── supabase/
│   ├── migrations/      # Database migrations (tables, views, RLS policies)
│   └── functions/       # Supabase Edge Functions (Deno/TypeScript)
│       ├── parse-pdf/
│       └── update-prices/
└── frontend/            # React/Next.js app (Cloudflare Pages)
```

---

## 8. Out of Scope (V1)

The following features are explicitly deferred for the initial implementation:

* **Cost Basis / Tax Lots:** No tracking of purchase price or unrealized gains. (Most statements don't include this info anyway; would require manual entry or transaction import.)
* **Transaction History:** No buy/sell/dividend tracking between statements.
* **Security Management UI:** New tickers are added directly to Supabase; no admin UI.
* **Multi-Currency:** All values assumed to be USD.
* **Benchmarking:** No comparison to market indices (S&P 500, etc.).
