import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

export async function listClientNames(supabase: SupabaseClient): Promise<string[]> {
  const { data, error } = await supabase.from('clients').select('name').order('name');
  if (error) throw error;
  return (data as { name: string }[]).map((row) => row.name);
}
