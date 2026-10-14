import { supabase } from '../supabase';
import { throwIfError } from '../util/error';

/** Well-known demo household from `scripts/seed-demo.ts`. */
export const DEMO_FAMILY_ID = '11111111-1111-4111-8111-111111111111';

/** Alex, the seeded read-only demo login. Password is shared by the demo users. */
export const DEMO_EMAIL = 'alex@skate.cheap';
export const DEMO_PASSWORD = 'demo-password-123';

export interface Family {
  id: string;
  created_at: string;
}

/**
 * Throws if `familyId` is the seeded demo family.
 *
 * TODO: client-side only — a determined user can call PostgREST / Auth
 * directly and join the demo family. We'll address this later if it ever
 * becomes an issue, not over-engineering in advance
 */
export function assertCanJoinFamily(familyId: string): void {
  // Only enforce in browsers, so the seed script can still insert demo users
  if (typeof window === 'undefined') return;

  if (familyId === DEMO_FAMILY_ID) {
    throw new Error('This family is not accepting new members');
  }
}

export async function insertFamily(id: string): Promise<void> {
  const { error } = await supabase.from('families').insert({ id });

  throwIfError(error);
}
