import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { OPERATIONS, runOperation, type Operation } from './operations.js';
import { loadConfig, signIn, type Config, type Session } from './session.js';

/** Access tokens last an hour; sign in again well before that. */
const SESSION_MAX_AGE_MS = 30 * 60 * 1000;

/** Signs in on first use and again once the session is old. */
export function sessionProvider(config: () => Config): () => Promise<Session> {
  let current: { session: Session; since: number } | null = null;
  return async () => {
    if (!current || Date.now() - current.since > SESSION_MAX_AGE_MS) {
      current = { session: await signIn(config()), since: Date.now() };
    }
    return current.session;
  };
}

const text = (value: string) => ({ content: [{ type: 'text' as const, text: value }] });

function registerOperation(server: McpServer, op: Operation, session: () => Promise<Session>) {
  server.registerTool(
    op.name,
    {
      description: op.description,
      inputSchema: op.input,
      annotations: { readOnlyHint: !op.writes, destructiveHint: op.name === 'undo_update' },
    },
    async (input: unknown) => {
      try {
        return text(JSON.stringify(await runOperation(op, await session(), input), null, 2));
      } catch (err) {
        return { ...text(err instanceof Error ? err.message : String(err)), isError: true };
      }
    },
  );
}

/** An MCP server with one tool per operation in the registry. */
export function buildServer(config: () => Config = loadConfig): McpServer {
  const server = new McpServer({ name: 'cheapskate', version: '0.1.0' });
  const session = sessionProvider(config);
  for (const op of OPERATIONS) registerOperation(server, op, session);
  return server;
}
