// Fails fast at server start with a clear list of missing settings.
export async function register() {
  const { readEnv } = await import('./lib/env');
  readEnv();
}
