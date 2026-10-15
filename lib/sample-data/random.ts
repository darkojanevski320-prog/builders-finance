export type Random = () => number;

/** mulberry32: a tiny seeded generator. Same seed, same sequence, on every machine. */
export function createRandom(seed: number): Random {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

export function randInt(rng: Random, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

export function pick<T>(rng: Random, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)];
}

export function chance(rng: Random, probability: number): boolean {
  return rng() < probability;
}
