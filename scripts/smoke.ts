// Checks that a deployed copy serves the welcome screen. Usage: npm run smoke -- https://your-app.vercel.app
async function main() {
  const base = process.argv[2] ?? process.env.SMOKE_URL;
  if (!base) {
    console.error('Usage: npm run smoke -- https://your-app.vercel.app');
    process.exit(1);
  }

  const url = new URL('/welcome', base);
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      const response = await fetch(url, { redirect: 'follow' });
      const body = await response.text();
      if (response.ok && body.includes('Open your demo copy')) {
        console.log(`Smoke test passed: ${url}`);
        process.exit(0);
      }
      console.log(`Attempt ${attempt}: HTTP ${response.status}, welcome text ${body.includes('Open your demo copy') ? 'found' : 'missing'}`);
    } catch (error) {
      console.log(`Attempt ${attempt}: ${error instanceof Error ? error.message : String(error)}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 5_000));
  }
  console.error(`Smoke test failed: ${url}`);
  process.exit(1);
}

main();
