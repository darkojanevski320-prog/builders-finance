export function buildEnvFile(url: string, key: string): string {
  return (
    '# Written by Builders Finance scripts. Never commit this file.\n' +
    `NEXT_PUBLIC_SUPABASE_URL=${url}\n` +
    `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${key}\n`
  );
}

export const SETUP_AUTH_CONFIG = {
  external_anonymous_users_enabled: true,
  rate_limit_anonymous_users: 300,
  // Only anonymous demo sessions; email or phone users would never be cleaned up.
  external_email_enabled: false,
  external_phone_enabled: false,
} as const;

export function isProjectRef(ref: string): boolean {
  return /^[a-z]{20}$/.test(ref);
}

export function projectUrl(ref: string): string {
  return `https://${ref}.supabase.co`;
}

export function pickPublishableKey(keys: unknown): string | null {
  if (!Array.isArray(keys)) return null;
  const match = keys.find(
    (k) => k && typeof k === 'object' && k.type === 'publishable' && typeof k.api_key === 'string' && k.api_key.startsWith('sb_publishable_'),
  );
  return match ? (match.api_key as string) : null;
}
