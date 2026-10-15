import { describe, expect, it } from 'vitest';
import { chance, createRandom, pick, randInt } from './random';

describe('createRandom', () => {
  it('repeats the same sequence for the same seed', () => {
    const a = createRandom(42);
    const b = createRandom(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
  it('returns numbers in [0, 1)', () => {
    const rng = createRandom(7);
    for (let i = 0; i < 1000; i += 1) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
  it('differs between seeds', () => {
    expect(createRandom(1)()).not.toBe(createRandom(2)());
  });
});

describe('helpers', () => {
  it('randInt stays inside inclusive bounds and hits both ends', () => {
    const rng = createRandom(3);
    const seen = new Set<number>();
    for (let i = 0; i < 500; i += 1) seen.add(randInt(rng, 1, 3));
    expect([...seen].sort()).toEqual([1, 2, 3]);
  });
  it('pick and chance use the generator', () => {
    const rng = createRandom(5);
    expect(['a', 'b', 'c']).toContain(pick(rng, ['a', 'b', 'c']));
    expect(chance(createRandom(5), 0)).toBe(false);
    expect(chance(createRandom(5), 1)).toBe(true);
  });
});
