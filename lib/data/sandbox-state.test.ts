import { describe, expect, it } from 'vitest';
import { resolveSandboxState } from './sandbox-state';

describe('resolveSandboxState', () => {
  it('is none without a user', () => {
    expect(resolveSandboxState(null, null)).toEqual({ kind: 'none' });
    expect(resolveSandboxState(undefined, null)).toEqual({ kind: 'none' });
  });
  it('is expired when a valid token has no business, for example after cleanup deleted it', () => {
    expect(resolveSandboxState('u1', null)).toEqual({ kind: 'expired' });
    expect(resolveSandboxState('u1', { business_id: 'b1', businesses: null })).toEqual({ kind: 'expired' });
  });
  it('is ready with a business, whether the join returns an object or an array', () => {
    const ready = { kind: 'ready', userId: 'u1', businessId: 'b1', businessName: 'Northfield Studio' };
    expect(resolveSandboxState('u1', { business_id: 'b1', businesses: { name: 'Northfield Studio' } })).toEqual(ready);
    expect(resolveSandboxState('u1', { business_id: 'b1', businesses: [{ name: 'Northfield Studio' }] })).toEqual(ready);
  });
});
