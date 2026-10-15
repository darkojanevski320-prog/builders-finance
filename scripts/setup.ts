// Prepares your own Supabase project for Builders Finance:
// turns on anonymous sign-in, applies the database migrations, and writes an env file.
// Usage: npm run setup -- [PROJECT_REF] [ENV_FILE]
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { buildEnvFile, isProjectRef, pickPublishableKey, projectUrl, SETUP_AUTH_CONFIG } from './setup-lib';

const API = 'https://api.supabase.com/v1';

function fail(message: string): never {
  console.error(`\n${message}`);
  process.exit(1);
}

async function main() {
  const [refArg, envFileArg] = process.argv.slice(2);
  const envFile = envFileArg ?? '.env.local';
  const rl = createInterface({ input: stdin, output: stdout });

  console.log('Builders Finance setup\n');
  console.log('Do not show this terminal on a stream while you paste your token.\n');
  const token =
    process.env.SUPABASE_ACCESS_TOKEN?.trim() ||
    (await rl.question('Supabase access token (create one at supabase.com/dashboard/account/tokens): ')).trim();
  const ref = (refArg || process.env.SUPABASE_PROJECT_REF || (await rl.question('Project ref (the 20 letters in your project URL): '))).trim();
  rl.close();

  if (!token) fail('An access token is required.');
  if (!isProjectRef(ref)) fail('That project ref looks wrong. It is 20 lowercase letters, for example abcdefghijklmnopqrst.');

  const api = (path: string, init: RequestInit = {}) =>
    fetch(`${API}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
    });

  console.log('1/4 Checking the project...');
  const project = await api(`/projects/${ref}`);
  if (project.status === 401) fail('Supabase rejected the access token. Create a new one and try again.');
  if (project.status === 404) fail(`No project with ref ${ref} on this account.`);
  if (!project.ok) fail(`Could not read the project (HTTP ${project.status}).`);

  console.log('2/4 Turning on anonymous sign-in...');
  const auth = await api(`/projects/${ref}/config/auth`, { method: 'PATCH', body: JSON.stringify(SETUP_AUTH_CONFIG) });
  if (!auth.ok) fail(`Could not update auth settings (HTTP ${auth.status}).`);

  console.log('3/4 Applying database migrations...');
  console.log('    If the CLI asks for a database password, paste the one you set when you created the project.');
  try {
    execFileSync('npx', ['supabase', 'db', 'push', '--project-ref', ref, '--yes'], {
      stdio: 'inherit',
      env: { ...process.env, SUPABASE_ACCESS_TOKEN: token },
    });
  } catch {
    fail('Applying migrations failed. Read the error above, fix it, and run setup again. It is safe to rerun.');
  }

  console.log('4/4 Writing your env file...');
  let key = pickPublishableKey(await (await api(`/projects/${ref}/api-keys?reveal=true`)).json());
  if (!key) {
    const created = await api(`/projects/${ref}/api-keys`, {
      method: 'POST',
      body: JSON.stringify({ type: 'publishable', name: 'builders_finance' }),
    });
    if (!created.ok) fail(`Could not create a publishable key (HTTP ${created.status}).`);
    key = pickPublishableKey([await created.json()]);
  }
  if (!key) fail('No publishable key found for this project.');

  if (existsSync(envFile)) copyFileSync(envFile, `${envFile}.bak`);
  writeFileSync(envFile, buildEnvFile(projectUrl(ref), key));

  console.log(`\nDone. Wrote ${envFile}.`);
  console.log('Next: run `npm run dev` and open http://localhost:3000');
}

main().catch((error) => fail(error instanceof Error ? error.message : String(error)));
