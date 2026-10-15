import { describe, expect, it } from 'vitest';
import { buildEnvFile } from './setup-lib';

describe('buildEnvFile', () => {
  it('writes both public variables and a do-not-commit header', () => {
    expect(buildEnvFile('http://127.0.0.1:54321', 'sb_publishable_abc')).toBe(
      '# Written by Builders Finance scripts. Never commit this file.\n' +
        'NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321\n' +
        'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_abc\n',
    );
  });
});
