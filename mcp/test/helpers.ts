import { createHmac, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { signIn, type Config, type Session } from '../src/session.js';

/** Matches test/stack/docker-compose.yml. Test values only. */
export const TEST_URL = 'http://127.0.0.1:54329';
const TEST_JWT_SECRET = 'test-jwt-secret-at-least-32-characters-long';

const b64url = (value: string | Buffer): string => Buffer.from(value).toString('base64url');

function signJwt(claims: Record<string, unknown>): string {
  const body = `${b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${b64url(JSON.stringify(claims))}`;
  return `${body}.${b64url(createHmac('sha256', TEST_JWT_SECRET).update(body).digest())}`;
}

export const TEST_ANON_KEY = signJwt({ role: 'anon', iss: 'supabase', exp: 4102444800 });

/**
 * Sign up a new user and put them in a family, the way the app's setup page
 * does. Omit `familyId` to start a new family.
 */
export async function createUser(familyId?: string): Promise<Config & { familyId: string }> {
  const config: Config = {
    url: TEST_URL,
    anonKey: TEST_ANON_KEY,
    email: `test-${randomUUID()}@example.invalid`,
    password: randomUUID(),
  };
  const db = createClient(config.url, config.anonKey, { auth: { persistSession: false } });

  const signUp = await db.auth.signUp({ email: config.email, password: config.password });
  if (signUp.error || !signUp.data.user)
    throw new Error(`sign-up failed: ${signUp.error?.message}`);

  const family = familyId ?? randomUUID();
  if (!familyId) {
    const created = await db.from('families').insert({ id: family });
    if (created.error) throw new Error(`create family failed: ${created.error.message}`);
  }

  const updated = await db.auth.updateUser({ data: { family_id: family } });
  if (updated.error) throw new Error(`set family failed: ${updated.error.message}`);
  await db.auth.refreshSession();

  const profile = await db
    .from('profiles')
    .insert({ id: signUp.data.user.id, family_id: family, name: 'Test User' });
  if (profile.error) throw new Error(`create profile failed: ${profile.error.message}`);

  return { ...config, familyId: family };
}

/** A signed-in session for a brand-new user in a brand-new family. */
export async function newFamilySession(): Promise<Session> {
  return signIn(await createUser());
}

const WRITTEN_TABLES = [
  'accounts',
  'assets',
  'asset_aliases',
  'updates',
  'price_updates',
  'holding_updates',
] as const;

export type RowCounts = Record<(typeof WRITTEN_TABLES)[number], number>;

/** Row counts of every table a statement can write, as this session sees them. */
export async function rowCounts(s: Session): Promise<RowCounts> {
  const counts = {} as RowCounts;
  for (const table of WRITTEN_TABLES) {
    const { count, error } = await s.db.from(table).select('*', { count: 'exact', head: true });
    if (error) throw new Error(`count ${table}: ${error.message}`);
    counts[table] = count ?? 0;
  }
  return counts;
}

/**
 * The same session, except that the nth insert into `table` fails. Used to
 * prove a half-written statement is rolled back.
 */
export function failingOn(s: Session, table: string, nth: number): Session {
  let inserts = 0;
  const db = new Proxy(s.db, {
    get(target, property, receiver) {
      if (property !== 'from') return Reflect.get(target, property, receiver);
      return (name: string) => {
        const builder = target.from(name);
        if (name !== table) return builder;
        return new Proxy(builder, {
          get(inner, key, innerReceiver) {
            if (key !== 'insert') return Reflect.get(inner, key, innerReceiver);
            return (...args: unknown[]) =>
              ++inserts === nth
                ? Promise.resolve({ data: null, error: { message: 'injected failure' } })
                : (inner.insert as (...a: unknown[]) => unknown)(...args);
          },
        });
      };
    },
  });
  return { ...s, db };
}
