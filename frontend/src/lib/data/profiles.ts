import { supabase } from '../supabase';
import { assertCanJoinFamily } from './families';
import { throwIfError } from '../util/error';

export interface LocalLlmConfig {
  api: 'disabled' | 'ollama' | 'openai';
  port: string;
}

export interface UserPreferences {
  local_llm?: LocalLlmConfig;
  show_closed_accounts?: boolean;
  show_former_assets?: boolean;
}

export interface Profile {
  id: string;
  name: string;
  family_id: string;
  created_at: string;
  preferences: UserPreferences;
}

export async function listProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase.from('profiles').select('*').order('created_at');

  throwIfError(error);
  return data || [];
}

export async function getProfile(id: string): Promise<Profile | null> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', id).single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throwIfError(error);
  }
  return data;
}

export async function listProfilesByFamily(familyId: string): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('family_id', familyId)
    .order('created_at');

  throwIfError(error);
  return data || [];
}

export async function insertProfile(profile: {
  id: string;
  name: string;
  family_id: string;
}): Promise<void> {
  assertCanJoinFamily(profile.family_id);

  const { error } = await supabase.from('profiles').insert({
    id: profile.id,
    name: profile.name,
    family_id: profile.family_id,
  });

  throwIfError(error);
}

export async function updateProfile(id: string, updates: { name: string }): Promise<void> {
  const { error } = await supabase.from('profiles').update({ name: updates.name }).eq('id', id);

  throwIfError(error);
}

export async function updateProfileFamily(id: string, familyId: string): Promise<void> {
  assertCanJoinFamily(familyId);

  const { error } = await supabase.from('profiles').update({ family_id: familyId }).eq('id', id);

  throwIfError(error);
}

export async function updatePreferences(
  id: string,
  preferences: Partial<UserPreferences>,
): Promise<void> {
  const profile = await getProfile(id);
  const current = profile?.preferences ?? {};
  const merged: UserPreferences = { ...current, ...preferences };
  if (preferences.local_llm) {
    merged.local_llm = { ...current.local_llm, ...preferences.local_llm };
  }

  const { error } = await supabase.from('profiles').update({ preferences: merged }).eq('id', id);

  throwIfError(error);
}
