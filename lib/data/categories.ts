import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Category, TransactionKind } from '@/lib/finance/types';
import { toCategory, type CategoryRow } from './rows';

export async function listCategories(supabase: SupabaseClient, kind?: TransactionKind): Promise<Category[]> {
  let query = supabase.from('categories').select('id, kind, name');
  if (kind) query = query.eq('kind', kind);
  const { data, error } = await query.order('name');
  if (error) throw error;
  return (data as CategoryRow[]).map(toCategory);
}
