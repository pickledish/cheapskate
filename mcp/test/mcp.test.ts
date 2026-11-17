import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { beforeAll, describe, expect, it } from 'vitest';
import { main } from '../src/cli.js';
import { toCommand } from '../src/cli-args.js';
import { buildServer } from '../src/mcp-server.js';
import { OPERATIONS } from '../src/operations.js';
import { CONFIG_ENV, type Config } from '../src/session.js';
import { createUser } from './helpers.js';

const textOf = (result: unknown): string =>
  (result as { content: { text: string }[] }).content[0]?.text ?? '';

describe('MCP server', () => {
  let client: Client;
  let config: Config;

  beforeAll(async () => {
    config = await createUser();
    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
    await buildServer(() => config).connect(serverSide);
    client = new Client({ name: 'test', version: '0' });
    await client.connect(clientSide);
  });

  it('exposes exactly the operations in the registry (requirement 7)', async () => {
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(OPERATIONS.map((op) => op.name).sort());
  });

  it('marks read-only tools as read-only', async () => {
    const { tools } = await client.listTools();
    for (const tool of tools) {
      const op = OPERATIONS.find((o) => o.name === tool.name);
      expect(tool.annotations?.readOnlyHint).toBe(!op?.writes);
    }
  });

  it('creates an account and records a statement through tool calls', async () => {
    const created = await client.callTool({ name: 'create_account', arguments: { name: 'IRA' } });
    const account = JSON.parse(textOf(created));

    const recorded = await client.callTool({
      name: 'record_statement',
      arguments: {
        account_id: account.id,
        effective_date: '2026-10-31',
        holdings: [{ name: 'Total Market', ticker: 'VTI', quantity: 3, price: 100 }],
      },
    });
    expect(JSON.parse(textOf(recorded))).toMatchObject({ written: true });

    const listed = await client.callTool({ name: 'list_accounts', arguments: {} });
    expect(JSON.parse(textOf(listed))[0]).toMatchObject({ name: 'IRA', total_value: 300 });
  });

  it('reports a failure as a tool error, not a crash', async () => {
    const result = await client.callTool({ name: 'undo_update', arguments: { update_id: 999999 } });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toMatch(/No update/);
  });
});

describe('CLI', () => {
  it('has one command per operation', () => {
    expect(new Set(OPERATIONS.map((op) => toCommand(op.name))).size).toBe(OPERATIONS.length);
  });

  it('runs a command end to end and prints JSON', async () => {
    const config = await createUser();
    const env = Object.fromEntries(
      (Object.keys(CONFIG_ENV) as (keyof Config)[]).map((k) => [CONFIG_ENV[k], config[k]]),
    );
    const lines: string[] = [];
    const original = console.log;
    console.log = (line: string) => lines.push(line);
    try {
      expect(await main(['whoami'], env)).toBe(0);
    } finally {
      console.log = original;
    }
    expect(JSON.parse(lines.join('\n'))).toMatchObject({ email: config.email });
  });

  it('exits 2 on a missing config and on an unknown command', async () => {
    const original = console.error;
    console.error = () => {};
    try {
      expect(await main(['whoami'], {})).toBe(2);
      expect(await main(['frobnicate'], {})).toBe(2);
    } finally {
      console.error = original;
    }
  });
});
