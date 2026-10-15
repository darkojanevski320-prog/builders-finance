import { describe, expect, it } from 'vitest';
import { firstParam } from './params';

describe('firstParam', () => {
  it('returns a single non-empty string or undefined', () => {
    expect(firstParam('rent')).toBe('rent');
    expect(firstParam(['rent', 'other'])).toBe('rent');
    expect(firstParam('')).toBeUndefined();
    expect(firstParam(undefined)).toBeUndefined();
  });
});
