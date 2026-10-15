import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSandboxState } from './sandbox';

function client(result: { data: unknown; error: unknown }): SupabaseClient {
  const chain = {
    select: () => chain,
    eq: () => chain,
    limit: () => chain,
    maybeSingle: async () => result,
  };
  return { auth: { getClaims: async () => ({ data: { claims: { sub: 'u1' } } }) }, from: () => chain } as unknown as SupabaseClient;
}

describe('getSandboxState', () => {
  it('throws when the membership query fails, instead of treating the sandbox as expired', async () => {
    await expect(getSandboxState(client({ data: null, error: { code: 'PGRST000', message: 'unavailable' } }))).rejects.toMatchObject({
      code: 'PGRST000',
    });
  });
  it('is expired when the query succeeds without a membership', async () => {
    await expect(getSandboxState(client({ data: null, error: null }))).resolves.toEqual({ kind: 'expired' });
  });
});
