#!/usr/bin/env node
import { operationHelp, parseArgs, toCommand, topLevelHelp, UsageError } from './cli-args.js';
import { OPERATIONS, runOperation } from './operations.js';
import { CONFIG_ENV, ConfigError, loadConfig, signIn } from './session.js';

const EXIT_FAILED = 1;
const EXIT_USAGE = 2;

/** Run one command. Returns the process exit code; prints JSON on success. */
export async function main(argv: string[], env: NodeJS.ProcessEnv = process.env): Promise<number> {
  const [command, ...rest] = argv;
  if (!command || command === '--help' || command === 'help') {
    console.log(topLevelHelp(OPERATIONS, Object.values(CONFIG_ENV)));
    return command ? 0 : EXIT_USAGE;
  }

  const op = OPERATIONS.find((o) => toCommand(o.name) === command || o.name === command);
  if (!op) {
    console.error(`Unknown command "${command}". Run cheapskate-cli --help.`);
    return EXIT_USAGE;
  }
  if (rest.includes('--help')) {
    console.log(operationHelp(op));
    return 0;
  }

  try {
    const input = parseArgs(op, rest);
    const session = await signIn(loadConfig(env));
    console.log(JSON.stringify(await runOperation(op, session, input), null, 2));
    return 0;
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    return err instanceof UsageError || err instanceof ConfigError ? EXIT_USAGE : EXIT_FAILED;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exitCode = await main(process.argv.slice(2));
}
