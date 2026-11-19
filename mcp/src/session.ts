import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

export const ConfigSchema = z.object({
  url: z.string().url(),
  anonKey: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(1),
});

export type Config = z.infer<typeof ConfigSchema>;

/** Environment variable for each config field. */
export const CONFIG_ENV = {
  url: 'CHEAPSKATE_URL',
  anonKey: 'CHEAPSKATE_ANON_KEY',
  email: 'CHEAPSKATE_EMAIL',
  password: 'CHEAPSKATE_PASSWORD',
} as const satisfies Record<keyof Config, string>;

export class ConfigError extends Error {}

/** Read the config from the environment. Names the missing variables, never their values. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const fields = Object.keys(CONFIG_ENV) as (keyof Config)[];
  const raw = Object.fromEntries(fields.map((field) => [field, env[CONFIG_ENV[field]]]));
  const parsed = ConfigSchema.safeParse(raw);
  if (parsed.success) return parsed.data;

  const bad = [...new Set(parsed.error.issues.map((i) => CONFIG_ENV[i.path[0] as keyof Config]))];
  throw new ConfigError(`Missing or invalid environment variables: ${bad.join(', ')}`);
}

/** A signed-in user. Row Level Security limits `db` to this user's family. */
export interface Session {
  db: SupabaseClient;
  url: string;
  userId: string;
  email: string;
  familyId: string;
  readOnly: boolean;
}

export class SessionError extends Error {}

export async function signIn(config: Config): Promise<Session> {
  const db = createClient(config.url, config.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const { data, error } = await db.auth.signInWithPassword({
    email: config.email,
    password: config.password,
  });
  if (error || !data.user) {
    throw new SessionError(`Sign-in failed for ${config.email}: ${error?.message ?? 'no user'}`);
  }

  const familyId = data.user.user_metadata?.family_id;
  if (typeof familyId !== 'string' || !familyId) {
    throw new SessionError(
      `${config.email} has not joined a family yet. Sign in to the web app once and finish setup.`,
    );
  }

  const readOnlyFlag = data.user.app_metadata?.read_only;
  return {
    db,
    url: config.url,
    userId: data.user.id,
    email: data.user.email ?? config.email,
    familyId,
    readOnly: readOnlyFlag === true || readOnlyFlag === 'true',
  };
}
