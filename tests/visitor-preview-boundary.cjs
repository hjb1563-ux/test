// Offline environment-boundary checks. No credentials, accounts, or network.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (m, f) => m._compile(ts.transpileModule(fs.readFileSync(f, 'utf8').replace("import 'server-only';", ''), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, f);
const { createVisitorAdmin } = require('../server/visitor-admin.ts');
const { createVisitorHandlers } = require('../server/visitors.ts');
const origin = 'https://offline-preview.example';
const config = { NODE_ENV: 'production', VERCEL_ENV: 'preview', SUPABASE_URL: 'https://istsrambmbzuemkgutgh.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_OFFLINE_ONLY', VISITOR_ADMIN_ENABLED: 'true', VISITOR_ADMIN_ORIGIN: origin, VISITOR_ADMIN_USER_IDS: '11111111-1111-4111-8111-111111111111' };
test('missing production configuration and incomplete preview settings never reach Auth or RPC', async () => {
  for (const env of [{ NODE_ENV: 'production', VERCEL_ENV: 'production' }, { ...config, VISITOR_ADMIN_ENABLED: 'false' }, { ...config, VISITOR_ADMIN_ORIGIN: undefined }, { ...config, VISITOR_ADMIN_USER_IDS: undefined }]) {
    let calls = 0;
    const admin = createVisitorAdmin({ env, request: async () => { calls++; throw Error('network forbidden'); } });
    const r = await admin.get(new Request(origin + '/api/admin/visitors'));
    assert.equal(r.status, 503);
    assert.deepEqual(await r.json(), { available: false });
    assert.equal(calls, 0);
  }
});
test('preview refuses visitor registration even with an accidentally enabled collection flag', async () => {
  let calls = 0;
  const visitor = createVisitorHandlers({ env: { ...config, VISITOR_COUNTER_ENABLED: 'true' }, request: async () => { calls++; throw Error('network forbidden'); } });
  assert.equal((await visitor.post(new Request(origin + '/api/visitors/visit', { method: 'POST' }))).status, 403);
  assert.equal(calls, 0);
});
test('configured preview without an application session remains unauthorized; public statistics stay unavailable', async () => {
  let calls = 0;
  const admin = createVisitorAdmin({ env: config, request: async () => { calls++; throw Error('network forbidden'); } });
  assert.equal((await admin.get(new Request(origin + '/api/admin/visitors'))).status, 401);
  assert.equal((await admin.publicTotal(new Request(origin + '/api/visitors/total'))).status, 404);
  assert.equal(calls, 0);
});
test('candidate has no collection endpoints or environment files', () => {
  for (const file of ['app/api/visitors/route.ts', 'app/api/visitors/visit/route.ts', '.env', '.env.local', '.env.production', '.env.production.local']) assert.equal(fs.existsSync(file), false, file);
});
