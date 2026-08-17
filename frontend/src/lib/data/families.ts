import { supabase } from '../supabase';

/** Well-known demo household from `scripts/seed-demo.ts`. */
export const DEMO_FAMILY_ID = '11111111-1111-4111-8111-111111111111';

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

  if (error) throw error;
}
