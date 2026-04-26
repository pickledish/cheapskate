import { supabase } from '../supabase'

export interface Family {
  id: string
  created_at: string
}

export async function insertFamily(id: string): Promise<void> {
  const { error } = await supabase
    .from('families')
    .insert({ id })

  if (error) throw error
}
