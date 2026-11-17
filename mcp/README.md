# Cheapskate MCP

A command-line tool and an MCP server for a Cheapskate instance. They let an AI
assistant (or a script) create accounts and record holdings without the web UI.

The assistant does the reading: a PDF statement, a CSV export, a brokerage page
you have open. This tool only writes what it is told, and makes that safe:

- It signs in as an ordinary user, so the database's Row Level Security limits
  it to that user's family. It never uses the service-role key.
- `record_statement` has a dry run that returns exactly what would be written.
- Every write is one update that `undo_update` removes, the same as the History
  page's undo.
- It refuses a second statement for the same account and date, and a duplicate
  account name, unless told otherwise.

Nothing in the web app or the database schema changes.

## Operations

| Operation | Writes | What it does |
| --- | --- | --- |
| `whoami` | no | The instance, user and family the tool is signed in to. |
| `list_accounts` | no | Accounts with current holdings, valued at the latest known price. |
| `list_assets` | no | The asset catalog and the per-account labels that map to each asset. |
| `create_account` | yes | Create an account: name, institution, last four digits, in portfolio or not. |
| `record_statement` | yes | Record every holding in one account as of a date, as one update. |
| `list_updates` | no | Recent history with the prices and holdings each update wrote. |
| `undo_update` | yes | Delete one update and the rows it wrote. |

The CLI and the MCP server are generated from one list in `src/operations.ts`,
so they always offer the same operations with the same inputs.

### How `record_statement` treats a statement

It follows the web app's "Upload statement" rules:

- A line with a ticker uses the family's asset with that ticker, or creates one.
- A line without a ticker uses the asset this account has mapped that label to
  before, or creates a ticker-less asset and remembers the label.
- `asset_id` on a line maps it to an existing asset explicitly.
- A statement is a **full snapshot**. Positions the account holds that the
  statement does not list are recorded as sold (quantity zero). Pass
  `mark_missing_as_sold: false` for a partial list.
- Use `$CASH` for cash (quantity and value both the dollar amount) and `$DEBT`
  for a liability (negative value), as the app does.

## Setup

Requires Node 22 or later.

```bash
cd mcp
npm install
npm run build
```

Create a user for the tool in your family (sign up in the web app and join the
family with its secret), then set four environment variables:

| Variable | Value |
| --- | --- |
| `CHEAPSKATE_URL` | Your Supabase URL, the same as `VITE_SUPABASE_URL`. |
| `CHEAPSKATE_ANON_KEY` | Your anon key, the same as `VITE_SUPABASE_ANON_KEY`. |
| `CHEAPSKATE_EMAIL` | The tool user's email. |
| `CHEAPSKATE_PASSWORD` | The tool user's password. Keep it out of shell history and config files in git. |

## Command line

```bash
node dist/cli.js --help
node dist/cli.js whoami
node dist/cli.js list-accounts
node dist/cli.js create-account --name "Roth IRA" --institution Fidelity --last4 1234

# Preview, then write. statement.json holds { "holdings": [ ... ] }.
node dist/cli.js record-statement --account-id 3 --effective-date 2026-10-31 \
  --input statement.json --dry-run
node dist/cli.js record-statement --account-id 3 --effective-date 2026-10-31 \
  --input statement.json

node dist/cli.js undo-update --update-id 42
```

Output is JSON on stdout. Errors go to stderr; the exit code is 2 for a usage or
configuration problem and 1 for a failed operation.

A holding looks like this:

```json
{ "name": "Vanguard Total Stock Market ETF", "ticker": "VTI", "quantity": 10, "price": 300.12 }
```

Give `price`, `total_value`, or both. `ticker` is optional; leave it out if the
source does not print one.

## MCP server

The server speaks MCP over stdio. For Claude Code:

```bash
claude mcp add cheapskate \
  --env CHEAPSKATE_URL=https://your-instance.example \
  --env CHEAPSKATE_ANON_KEY=... \
  --env CHEAPSKATE_EMAIL=... \
  --env CHEAPSKATE_PASSWORD=... \
  -- node /absolute/path/to/cheapskate/mcp/dist/mcp.js
```

Any MCP client that can launch a stdio server works the same way: run
`node dist/mcp.js` with those four variables set.

A typical session: the assistant calls `list_accounts`, creates any missing
account, calls `record_statement` with `dry_run: true`, shows you the plan, and
writes only after you agree.

## Tests

The tests run against a real backend: Postgres, the auth service and PostgREST
in Docker, with this repo's own `supabase/migrations` applied. Docker is the
only requirement.

```bash
npm test            # starts the stack if needed, leaves it running
npm run stack:down  # remove the stack and its data
```

The stack listens on `127.0.0.1:54329` and uses test-only secrets.
