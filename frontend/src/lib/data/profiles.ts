import { supabase } from '../supabase'

export interface LocalLlmConfig {
  api: 'disabled' | 'ollama' | 'openai'
  port: string
}

export interface UserPreferences {
  local_llm?: LocalLlmConfig
}

export interface Profile {
  id: string
  name: string
  family_id: string
  created_at: string
  preferences: UserPreferences
}

export async function listProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at')

  if (error) throw error
  return data || []
}

export async function getProfile(id: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw error
  }
  return data
}

export async function listProfilesByFamily(familyId: string): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('family_id', familyId)
    .order('created_at')

  if (error) throw error
  return data || []
}

export async function insertProfile(profile: {
  id: string
  name: string
  family_id: string
}): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .insert({
      id: profile.id,
      name: profile.name,
      family_id: profile.family_id
    })

  if (error) throw error
}

export async function updateProfile(id: string, updates: { name: string }): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ name: updates.name })
    .eq('id', id)

  if (error) throw error
}

export async function updatePreferences(id: string, preferences: UserPreferences): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ preferences })
    .eq('id', id)

  if (error) throw error
}
