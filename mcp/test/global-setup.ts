import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const COMPOSE_FILE = fileURLToPath(new URL('./stack/docker-compose.yml', import.meta.url));

function compose(...args: string[]): void {
  execFileSync('docker', ['compose', '-f', COMPOSE_FILE, ...args], { stdio: 'inherit' });
}

/**
 * Start the throwaway backend and wait until it is healthy. It is left running
 * between runs so repeat runs are fast; `npm run stack:down` removes it and
 * its data. Set CHEAPSKATE_TEST_STACK_DOWN=1 to remove it after the run.
 */
export default function setup(): () => void {
  compose('up', '-d', '--wait', 'db', 'auth', 'rest', 'gateway');
  return () => {
    if (process.env.CHEAPSKATE_TEST_STACK_DOWN === '1') compose('down', '-v');
  };
}
