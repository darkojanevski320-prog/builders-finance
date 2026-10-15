'use server';

import { redirect } from 'next/navigation';
import type { ActionResult, FormState } from '@/lib/actions/result';
import { isRateLimitError, RATE_LIMIT_MESSAGE } from '@/lib/data/errors';
import { getSandboxState } from '@/lib/data/sandbox';
import { loadSampleData } from '@/lib/data/sample';
import { todayISO } from '@/lib/finance/dates';
import { SAMPLE_BUSINESS_NAME } from '@/lib/sample-data/generate';
import { createClient } from '@/lib/supabase/server';

const START_FAILED = "Couldn't open your demo copy. Try again.";

export async function startDemo(_prev: FormState, _form: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const state = await getSandboxState(supabase);
  if (state.kind === 'ready') redirect('/');

  const { error: signInError } = await supabase.auth.signInAnonymously();
  if (signInError) {
    console.error('[startDemo] sign-in failed', { code: signInError.code, status: signInError.status });
    return { ok: false, message: isRateLimitError(signInError) ? RATE_LIMIT_MESSAGE : START_FAILED };
  }

  const { data: businessId, error: createError } = await supabase.rpc('create_business', { p_name: SAMPLE_BUSINESS_NAME });
  if (createError || !businessId) {
    console.error('[startDemo] create_business failed', { code: createError?.code });
    return { ok: false, message: START_FAILED };
  }

  // A failed load leaves an empty business; the dashboard then offers "Load sample data".
  const { error: loadError } = await loadSampleData(supabase, businessId, todayISO());
  if (loadError) console.error('[startDemo] load_sample_data failed', { code: loadError.code });

  redirect('/');
}
