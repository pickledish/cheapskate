# Cheapskate MCP: scope

Written 2026-11-18 (UTC). Branch `claude/mcp`, based on upstream `462d45f`.

## Goal

Let an AI assistant set up accounts and record holdings in a Cheapskate
instance without the web UI. The assistant reads the source (a PDF, a CSV, a
browser tab); this tool only writes what it is told, safely.

## In scope

- A command-line tool, `cheapskate-cli`, that talks to a Cheapskate instance's
  existing REST API (PostgREST) as an ordinary signed-in user.
- An MCP server (stdio) that exposes the same operations as tools. It is a thin
  wrapper: every tool is one CLI operation.
- Operations:
  - `whoami`: the signed-in user and family.
  - `list-accounts`: accounts with their latest holdings.
  - `list-assets`: the family's asset catalog (tickers, aliases).
  - `create-account`: name, plus the optional fields the UI's add-account form sets.
  - `record-statement`: account, effective date, holdings (ticker or name,
    quantity, and price or total value). Supports `--dry-run`, which prints what
    would be written and writes nothing.
  - `list-updates`: recent history for an account.
  - `undo-update`: delete one update, as the History page's undo does.

## Out of scope

- Any change to the Vue app or the database schema.
- Parsing PDFs or CSVs inside the tool. The assistant does the reading.
- Brokerage logins or scraping.
- Edge functions, Google sign-in, multi-family administration.

## Design decisions

- **Language: TypeScript, in `mcp/` at the repo root.** The app is TypeScript
  and already depends on `supabase-js` and `zod`. Others who self-host get the
  tool from the same repo and the same commit as their schema. The holdings
  shape follows `supabase/functions/_shared/parse-pdf-schema.ts` but is declared
  again in `mcp/src/statement.ts`: it adds `asset_id`, makes `total_value`
  optional when a price is given, and the shared file cannot be imported from
  outside the frontend's bundler setup.
- **One list of operations.** `mcp/src/operations.ts` holds every operation with
  its zod input schema. The CLI's commands, flags and help, and the MCP server's
  tools, are all generated from it.
- **Auth: an ordinary user.** The tool signs in with an email and password
  (`CHEAPSKATE_URL`, `CHEAPSKATE_ANON_KEY`, `CHEAPSKATE_EMAIL`,
  `CHEAPSKATE_PASSWORD` from the environment). Row Level Security then limits it
  to that user's family. It never uses the service-role key or the JWT secret.
- **Writes mirror the UI.** `record-statement` writes the same rows as
  `UploadStatementModal.saveStatement`: one `updates` row of type `statement`,
  then per holding an asset (matched by ticker, then alias, else created), a
  `price_updates` row and a `holding_updates` row. On any failure it deletes the
  update, as the UI does.
- **Safety.** Dry-run on the write command; a duplicate guard that refuses a
  second statement for the same account and date unless `--force`; holdings
  validated with zod before any write; every write returns the update id so it
  can be undone.

## Requirements and checks

| # | Requirement | Check |
| --- | --- | --- |
| 1 | The tool creates an account without the UI. | Integration test against a local stack; then the account shows in the app. |
| 2 | The tool records holdings for an account as of a date. | Integration test; then holdings and a History entry show in the app. |
| 3 | A recorded statement can be undone. | Integration test: undo, then the holdings are gone. The app's History undo also removes one. |
| 4 | The tool only touches the signed-in user's family. | Integration test: a user in a second family lists nothing and cannot write to the first family's account. |
| 5 | The web UI and schema are unchanged. | `git diff origin/main --stat -- frontend supabase` is empty. |
| 6 | Dry-run writes nothing. | Integration test: row counts are equal before and after. |
| 7 | The MCP server exposes every CLI operation. | A test lists the MCP tools and compares them with the CLI's commands. |
| 8 | Upstream's CI still passes. | Nothing under `frontend/` changes, and a new workflow type-checks, formats, builds and tests `mcp/`. |

## Homelab side (separate repo, separate PR)

- A third user in the family, used only by this tool, created by an Ansible
  task through the auth service's admin API so it is reproducible. Its password
  is a new vault key.
- `cheapskate_repo` and `cheapskate_commit` move to the fork only if the fork
  changes anything the box builds. The MCP itself runs on the Mac.

## Risks

- The insert logic is re-implemented from the frontend. An upstream schema
  change can break it; the integration tests run against upstream's migrations
  to catch that.
- Upstream has no test runner. This adds one, confined to `mcp/`.
- The maintainer may not want it. The fork stands on its own either way.
