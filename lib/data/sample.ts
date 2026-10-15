import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { generateSampleBusiness } from '@/lib/sample-data/generate';
import type { DbErrorLike } from './errors';

/** Replaces everything in the business with freshly generated sample data, in one transaction. */
export async function loadSampleData(
  supabase: SupabaseClient,
  businessId: string,
  today: string,
): Promise<{ error: DbErrorLike | null }> {
  const { error } = await supabase.rpc('load_sample_data', {
    p_business_id: businessId,
    p_data: generateSampleBusiness({ today }),
  });
  return { error };
}
