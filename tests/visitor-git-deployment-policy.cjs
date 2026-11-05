const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
test('only the exact verification branch disables Git deployments', () => {
  const config = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
  assert.deepEqual(config, {
    $schema: 'https://openapi.vercel.sh/vercel.json',
    git: { deploymentEnabled: { 'verify/visitor-admin-https-20261106': false } },
  });
  // No wildcard, explicit master override, or global false setting is permitted.
  assert.equal(Object.keys(config.git.deploymentEnabled).length, 1);
  for (const file of ['vercel.ts', 'vercel.toml']) assert.equal(fs.existsSync(file), false);
});
