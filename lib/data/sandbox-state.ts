export type SandboxState =
  | { kind: 'none' }
  | { kind: 'expired' }
  | { kind: 'ready'; userId: string; businessId: string; businessName: string };

export interface MembershipRow {
  business_id: string;
  businesses: { name: string } | { name: string }[] | null;
}

/** A valid token without a business means the sandbox was cleaned up or never finished. */
export function resolveSandboxState(userId: string | null | undefined, membership: MembershipRow | null): SandboxState {
  if (!userId) return { kind: 'none' };
  if (!membership) return { kind: 'expired' };
  const business = Array.isArray(membership.businesses) ? membership.businesses[0] : membership.businesses;
  if (!business) return { kind: 'expired' };
  return { kind: 'ready', userId, businessId: membership.business_id, businessName: business.name };
}
