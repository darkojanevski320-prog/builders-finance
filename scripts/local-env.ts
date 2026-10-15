// Writes .env.local for the local Supabase stack started with `npm run db:start`.
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, writeFileSync } from 'node:fs';
import { buildEnvFile } from './setup-lib';

let status: Record<string, string>;
try {
  status = JSON.parse(execFileSync('npx', ['supabase', 'status', '-o', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
} catch {
  console.error('Local Supabase is not running. Start Docker, then run `npm run db:start`.');
  process.exit(1);
}

const url = status.API_URL;
const key = status.PUBLISHABLE_KEY ?? status.ANON_KEY;
if (!url || !key) {
  console.error('Could not read API_URL and PUBLISHABLE_KEY from `supabase status`.');
  process.exit(1);
}

if (existsSync('.env.local')) copyFileSync('.env.local', '.env.local.bak');
writeFileSync('.env.local', buildEnvFile(url, key));
console.log(`Wrote .env.local for local Supabase at ${url}.`);
