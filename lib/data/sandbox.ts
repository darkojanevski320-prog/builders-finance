import 'server-only';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { resolveSandboxState, type MembershipRow, type SandboxState } from './sandbox-state';

export type Sandbox = Extract<SandboxState, { kind: 'ready' }> & { supabase: SupabaseClient };

export async function getSandboxState(supabase: SupabaseClient): Promise<SandboxState> {
  const { data } = await supabase.auth.getClaims();
  const sub = data?.claims?.sub;
  const userId = typeof sub === 'string' ? sub : null;
  if (!userId) return resolveSandboxState(null, null);
  const { data: membership } = await supabase
    .from('business_members')
    .select('business_id, businesses(name)')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle<MembershipRow>();
  return resolveSandboxState(userId, membership ?? null);
}

/** Returns the visitor's sandbox or redirects to the welcome screen. Cached per request. */
export const requireSandbox = cache(async (): Promise<Sandbox> => {
  const supabase = await createClient();
  const state = await getSandboxState(supabase);
  if (state.kind === 'none') redirect('/welcome');
  if (state.kind === 'expired') redirect('/welcome?expired=1');
  return { ...state, supabase };
});
