import { describe, expect, it } from 'vitest';
import { matchPreset, parseRangeParams, presetRange } from './date-range';

const today = '2026-10-15';

describe('presetRange', () => {
  it('builds each preset ending today', () => {
    expect(presetRange('this-month', today)).toEqual({ from: '2026-10-01', to: today });
    expect(presetRange('last-3-months', today)).toEqual({ from: '2026-08-01', to: today });
    expect(presetRange('last-12-months', today)).toEqual({ from: '2025-11-01', to: today });
    expect(presetRange('year-to-date', today)).toEqual({ from: '2026-01-01', to: today });
  });
});

describe('parseRangeParams', () => {
  it('uses valid from and to', () => {
    expect(parseRangeParams({ from: '2026-01-01', to: '2026-03-31' }, today)).toEqual({ from: '2026-01-01', to: '2026-03-31' });
  });
  it('falls back to the last 12 months for missing, invalid, or reversed ranges', () => {
    const fallback = presetRange('last-12-months', today);
    expect(parseRangeParams({}, today)).toEqual(fallback);
    expect(parseRangeParams({ from: '2026-02-30', to: '2026-03-01' }, today)).toEqual(fallback);
    expect(parseRangeParams({ from: '2026-05-01', to: '2026-04-01' }, today)).toEqual(fallback);
    expect(parseRangeParams({ from: ['2026-01-01', 'x'], to: '2026-02-01' }, today)).toEqual(fallback);
  });
});

describe('matchPreset', () => {
  it('recognizes presets and custom ranges', () => {
    expect(matchPreset(presetRange('year-to-date', today), today)).toBe('year-to-date');
    expect(matchPreset({ from: '2026-02-01', to: '2026-02-28' }, today)).toBe('custom');
  });
});
