import { describe, expect, it } from 'vitest';

describe('test environment', () => {
  it('runs in Pacific/Honolulu', () => {
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe('Pacific/Honolulu');
  });
});
