# Cheapskate

A personal investment tracker for a household: net worth and portfolio composition across brokerage accounts, retirement funds, and private assets (including real estate and debt).

Data is shared at the **family** level. Each person belongs to exactly one family. New users create a family or join an existing one with its UUID (“family secret”).

## What you can do

- **Goals** — Define asset classes (US stocks, bonds, cash, etc) and a target allocation.
- **Accounts** — Track 401(k)s, IRAs, brokerages, and private accounts. Upload PDF statements or enter holdings by hand. Archive closed accounts, and choose which accounts count toward the portfolio (and as of when).
- **Assets** — Public tickers and ticker-less holdings (mapped per account via aliases). Cash and liabilities use the special tickers `$CASH` and `$DEBT`.
- **Portfolio** — Current vs goal allocation, and composition over time.
- **Net Worth** — History grouped by account, owner, asset, or asset class.
- **History** — Every statement upload and manual price/holdings change, with undo.

Sign in with Google or email/password.

Statement PDFs are converted to text in the browser, then parsed by an LLM — either the hosted `parse-pdf` function (OpenRouter) or a **local** model (Ollama or an OpenAI-compatible server) configured under Profile & Settings.

## How it’s built

Vue 3 + Vite SPA, with Supabase for Postgres, auth, and edge functions. Portfolio history is a stream of **updates** (statement, manual price, manual holdings, close, include-in-portfolio) rather than standalone price/holdings tables. Row Level Security scopes every table to the user’s family.

## Development

To run locally, contribute, or host your own instance, see [DEVELOPMENT.md](./DEVELOPMENT.md).
