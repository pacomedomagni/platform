import { killPort } from '@nx/node/utils';
/* eslint-disable */

module.exports = async function () {
  // Skip teardown if running against an external API server
  if (process.env.SKIP_TEARDOWN === 'true') {
    console.log('\n[E2E] Skipping teardown (external API).\n');
    return;
  }
  // Put clean up logic here (e.g. stopping services, docker-compose, etc.).
  // Hint: `globalThis` is shared between setup and teardown.
  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  await killPort(port);
  console.log(globalThis.__TEARDOWN_MESSAGE__);
};
