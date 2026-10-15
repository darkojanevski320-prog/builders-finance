import { describe, expect, it } from 'vitest';
import { buildEnvFile, isProjectRef, pickPublishableKey, projectUrl, SETUP_AUTH_CONFIG } from './setup-lib';

describe('buildEnvFile', () => {
  it('writes both public variables and a do-not-commit header', () => {
    expect(buildEnvFile('http://127.0.0.1:54321', 'sb_publishable_abc')).toBe(
      '# Written by Builders Finance scripts. Never commit this file.\n' +
        'NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321\n' +
        'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_abc\n',
    );
  });
});


describe('setup helpers', () => {
  it('validates project refs', () => {
    expect(isProjectRef('abcdefghijklmnopqrst')).toBe(true);
    expect(isProjectRef('abc')).toBe(false);
    expect(isProjectRef('ABCDEFGHIJKLMNOPQRST')).toBe(false);
    expect(isProjectRef('abcdefghijklmnopqrs1')).toBe(false);
  });
  it('builds the project URL', () => {
    expect(projectUrl('abcdefghijklmnopqrst')).toBe('https://abcdefghijklmnopqrst.supabase.co');
  });
  it('picks only a publishable key', () => {
    expect(pickPublishableKey([
      { type: 'secret', api_key: 'sb_secret_x' },
      { type: 'legacy', api_key: 'eyJ...' },
      { type: 'publishable', api_key: 'sb_publishable_ok' },
    ])).toBe('sb_publishable_ok');
    expect(pickPublishableKey([{ type: 'secret', api_key: 'sb_secret_x' }])).toBeNull();
    expect(pickPublishableKey({ error: 'nope' })).toBeNull();
  });
  it('turns on anonymous sign-in with a 300 per hour limit and turns off email and phone sign-up', () => {
    expect(SETUP_AUTH_CONFIG).toEqual({
      external_anonymous_users_enabled: true,
      rate_limit_anonymous_users: 300,
      external_email_enabled: false,
      external_phone_enabled: false,
    });
  });
});
