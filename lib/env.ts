const REQUIRED = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'] as const;

export interface AppEnv {
  supabaseUrl: string;
  supabasePublishableKey: string;
}

// NEXT_PUBLIC_ variables must be referenced literally so Next.js can inline them.
export function readEnv(
  source: Record<string, string | undefined> = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  },
): AppEnv {
  const missing = REQUIRED.filter((name) => !source[name]?.trim());
  if (missing.length > 0) {
    throw new Error(
      `Missing environment variables: ${missing.join(', ')}. ` +
        'Run `npm run setup` or see https://github.com/darkojanevski320-prog/builders-finance#setup',
    );
  }
  return {
    supabaseUrl: source.NEXT_PUBLIC_SUPABASE_URL!.trim(),
    supabasePublishableKey: source.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!.trim(),
  };
}
