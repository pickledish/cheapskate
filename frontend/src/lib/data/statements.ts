import { supabase } from '../supabase'

export interface Statement {
  id: number
  account_id: number
  statement_date: string
  created_at: string
}

export async function listStatements(): Promise<Statement[]> {
  const { data, error } = await supabase
    .from('statements')
    .select('*')
    .order('statement_date', { ascending: false })

  if (error) throw error
  return data || []
}

export async function getStatement(id: number): Promise<Statement | null> {
  const { data, error } = await supabase
    .from('statements')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw error
  }
  return data
}

export async function insertStatement(statement: {
  account_id: number
  statement_date: string
}): Promise<Statement> {
  const { data, error } = await supabase
    .from('statements')
    .insert({
      account_id: statement.account_id,
      statement_date: statement.statement_date
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteStatement(id: number): Promise<void> {
  const { error } = await supabase
    .from('statements')
    .delete()
    .eq('id', id)

  if (error) throw error
}
