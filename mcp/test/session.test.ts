import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { ConfigError, loadConfig, SessionError, signIn } from '../src/session.js';
import { createUser, TEST_ANON_KEY, TEST_URL } from './helpers.js';

describe('loadConfig', () => {
  it('names the missing variables and never echoes values', () => {
    const env = { CHEAPSKATE_URL: TEST_URL, CHEAPSKATE_PASSWORD: 'hunter2-do-not-print' };
    let message = '';
    try {
      loadConfig(env);
    } catch (err) {
      expect(err).toBeInstanceOf(ConfigError);
      message = (err as Error).message;
    }
    expect(message).toContain('CHEAPSKATE_ANON_KEY');
    expect(message).toContain('CHEAPSKATE_EMAIL');
    expect(message).not.toContain('hunter2');
  });
});

describe('signIn', () => {
  it('rejects a wrong password without echoing it', async () => {
    const user = await createUser();
    const attempt = signIn({ ...user, password: 'wrong-password-do-not-print' });
    await expect(attempt).rejects.toThrow(SessionError);
    await expect(attempt).rejects.not.toThrow(/wrong-password/);
  });

  it('refuses a user who has not joined a family', async () => {
    const config = {
      url: TEST_URL,
      anonKey: TEST_ANON_KEY,
      email: `test-${randomUUID()}@example.invalid`,
      password: randomUUID(),
    };
    const db = createClient(config.url, config.anonKey, { auth: { persistSession: false } });
    await db.auth.signUp({ email: config.email, password: config.password });
    await expect(signIn(config)).rejects.toThrow(/has not joined a family/);
  });
});
