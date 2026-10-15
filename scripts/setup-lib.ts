export function buildEnvFile(url: string, key: string): string {
  return (
    '# Written by Builders Finance scripts. Never commit this file.\n' +
    `NEXT_PUBLIC_SUPABASE_URL=${url}\n` +
    `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${key}\n`
  );
}
