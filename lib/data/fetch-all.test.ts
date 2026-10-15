import { describe, expect, it } from 'vitest';
import { fetchAll } from './fetch-all';

function source(total: number) {
  const all = Array.from({ length: total }, (_, i) => i);
  const calls: [number, number][] = [];
  const page = async (from: number, to: number) => {
    calls.push([from, to]);
    return { data: all.slice(from, to + 1), error: null };
  };
  return { page, calls };
}

describe('fetchAll', () => {
  it('keeps paging past the 1,000 row limit', async () => {
    const { page, calls } = source(2500);
    expect(await fetchAll(page)).toHaveLength(2500);
    expect(calls).toEqual([[0, 999], [1000, 1999], [2000, 2999]]);
  });
  it('makes one call when the first page is short', async () => {
    const { page, calls } = source(10);
    expect(await fetchAll(page)).toHaveLength(10);
    expect(calls).toHaveLength(1);
  });
  it('handles an exact multiple of the page size', async () => {
    const { page, calls } = source(2000);
    expect(await fetchAll(page)).toHaveLength(2000);
    expect(calls).toHaveLength(3);
  });
  it('throws the query error', async () => {
    const failure = { code: '42501', message: 'denied' };
    await expect(fetchAll(async () => ({ data: null, error: failure }))).rejects.toBe(failure);
  });
});
