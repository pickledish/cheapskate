# Cheapskate MCP: plan

Status markers: `TODO`, `IN PROGRESS`, `DONE`, `BLOCKED ON`.

1. `DONE` Scope agreed in conversation (2026-11-17): fork, MCP driven by a CLI,
   service account in the family, no UI changes.
2. `DONE` Fork `pickledish/cheapskate` to `tclancy/cheapskate`.
3. `DONE` Local test stack: reuse the homelab compose (Postgres, GoTrue,
   PostgREST) with throwaway secrets; script to start it and apply migrations.
4. `DONE` `mcp/` package: config, sign-in, typed data access for accounts,
   assets, aliases, updates, holdings, prices.
5. `DONE` CLI commands, one at a time, each with an integration test written
   first: `whoami`, `list-accounts`, `list-assets`, `create-account`,
   `record-statement` (with `--dry-run` and the duplicate guard),
   `list-updates`, `undo-update`.
6. `DONE` Family-isolation test (requirement 4).
7. `DONE` MCP server over stdio wrapping the CLI operations; tool-parity test.
8. `DONE` README for `mcp/`: install, configure, example session.
9. `IN PROGRESS` Branch pushed to the fork. Opening the PR on `pickledish/cheapskate`
   waits for Tom's go-ahead: it is public and goes out under his name.
10. `IN PROGRESS` Homelab: vault key added by Tom (2026-11-17). Next: the Ansible
    task that creates the service user through the auth admin API, and a deploy.
11. `TODO` First real use: Tom's Fidelity and Schwab accounts, dry-run first.
