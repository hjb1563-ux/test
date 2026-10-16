// Operator only. Default --check is GET + read-only psql SELECTs.
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
export const REF = 'istsrambmbzuemkgutgh';
export const SESSION_HOST = 'aws-0-ap-northeast-2.pooler.supabase.com'; // User verified in development Dashboard.
const here = dirname(fileURLToPath(import.meta.url));
const need = (ok, message) => { if (!ok) throw Error(message); };
export function validateConfig(c) {
  need(c.project_ref === REF && c.project_name === 'bath-designer-dev', 'Development project mismatch');
  need(c.dashboard_confirmed === true, 'Confirm actual development Dashboard Connect values first');
  need(c.port === 5432 && c.database === 'postgres', 'Only port 5432 / postgres allowed');
  need(['direct','session'].includes(c.mode), 'Only direct or session allowed');
  need(typeof c.host === 'string' && /^[a-z0-9.-]+$/.test(c.host), 'Invalid exact Dashboard hostname');
  need(c.mode === 'direct' ? c.host === `db.${REF}.supabase.co` && c.user === 'postgres'
    : c.user === `postgres.${REF}` && c.host === SESSION_HOST, 'Connection identity mismatch');
  for (const name of ['psql_path','ca_file','pgpass_file']) need(typeof c[name] === 'string' && c[name].length > 0, `Missing ${name}`);
  return c;
}
export function validatePooler(c, rows) {
  // Do not infer an endpoint from region, suffix, cached CLI data or a 6543 URI.
  // If this API only returns transaction configuration, stop for manual review.
  need(Array.isArray(rows) && rows.some(p => p.database_type === 'PRIMARY' && p.pool_mode === 'session'
    && p.db_host === c.host && Number(p.db_port) === 5432 && p.db_name === c.database && p.db_user === c.user),
  'Live Management API does not attest this exact Session endpoint; STOP');
}
export function childEnvironment(c, parent) {
  // Clear libpq overrides, password env, Node credentials and unrelated Auth keys.
  const e = {};
  for (const key of ['SystemRoot','SYSTEMROOT','WINDIR','TEMP','TMP','PATH','Path']) if (parent[key]) e[key] = parent[key];
  return {...e, PGHOST:c.host, PGPORT:'5432', PGDATABASE:'postgres', PGUSER:c.user,
    PGSSLMODE:'verify-full', PGSSLROOTCERT:resolve(c.ca_file), PGPASSFILE:resolve(c.pgpass_file),
    PGCONNECT_TIMEOUT:'15', PGAPPNAME:'bath-phase4a4', PGOPTIONS:'-c search_path=pg_catalog,public',
    BATH_VERIFIED_REF:REF, BATH_VERIFIED_HOST:c.host, BATH_VERIFIED_USER:c.user};
}
async function main() {
  const mode = process.argv[2] || '--check';
  need(['--check','--fixture'].includes(mode) && process.argv.length <= 3, 'Use --check or --fixture');
  need(process.env.NODE_TLS_REJECT_UNAUTHORIZED !== '0', 'TLS verification must remain enabled');
  need(process.env.BATH_TEST_SECRET_STORAGE_CONFIRM === 'private-acl-verified', 'Verify private file ACL first');
  const configPath = process.env.BATH_TEST_DB_CONFIG;
  need(configPath && dirname(resolve(configPath)) === resolve('tests/artifacts/phase4a2'), 'Private DB config path required');
  const c = validateConfig(JSON.parse(readFileSync(configPath,'utf8')));
  for (const name of ['psql_path','ca_file','pgpass_file']) need(existsSync(c[name]), `Unavailable ${name}`);
  need(dirname(resolve(c.pgpass_file)) === dirname(resolve(configPath)), 'Keep password file inside protected directory');
  need(!/[\r\n]/.test(c.pgpass_file), 'Invalid password-file path');
  const token = process.env.BATH_TEST_MANAGEMENT_TOKEN;
  need(token, 'Missing BATH_TEST_MANAGEMENT_TOKEN');
  async function get(path) {
    const r = await fetch(`https://api.supabase.com/v1/projects/${REF}${path}`, {
      method:'GET', headers:{Authorization:`Bearer ${token}`},redirect:'error',signal:AbortSignal.timeout(15000)});
    need(r.ok, `Management GET failed HTTP ${r.status}`); return r.json();
  }
  const p = await get('');
  need(p.id === REF && p.name === 'bath-designer-dev' && p.status === 'ACTIVE_HEALTHY'
    && p.database?.host === `db.${REF}.supabase.co`, 'Live development identity mismatch');
  if (c.mode === 'session') validatePooler(c, await get('/config/database/pooler'));
  const childEnv = childEnvironment(c, process.env);
  const version = spawnSync(resolve(c.psql_path), ['--version'], {encoding:'utf8',env:childEnv,windowsHide:true,timeout:10000});
  need(version.status === 0 && Number(version.stdout?.match(/PostgreSQL\) (\d+)/)?.[1]) >= 15, 'psql 15+ required');
  const vars = ['-v',`project_ref=${REF}`,'-v','project_name=bath-designer-dev'];
  let sql = resolve(here,'phase4a4-connection-check.sql');
  if (mode === '--fixture') {
    need(process.env.BATH_TEST_FIXTURE_CONFIRM === 'create-dedicated-development-fixture', 'Separate Fixture execution approval required');
    const m = JSON.parse(readFileSync(process.env.BATH_TEST_FIXTURE_FILE,'utf8'));
    need(m.project_ref === REF, 'Manifest project mismatch');
    const values = {fixture_id:m.fixture_id,customer_a:m.users?.CUSTOMER_A,customer_b:m.users?.CUSTOMER_B,
      business_a_user:m.users?.BUSINESS_A,business_b_user:m.users?.BUSINESS_B,general_user:m.users?.GENERAL,pending_user:m.users?.PENDING,
      business_a_id:m.businesses?.A,business_b_id:m.businesses?.B,suspended_business_id:m.businesses?.SUSPENDED,
      member_a_id:m.members?.A,member_b_id:m.members?.B,pending_member_id:m.members?.PENDING,
      anonymous_member_id:m.members?.ANONYMOUS,suspended_member_id:m.members?.SUSPENDED,revoked_member_id:m.members?.REVOKED};
    need(Object.values(values).every(v => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v))
      && new Set(Object.values(values)).size === Object.keys(values).length, 'Manifest UUIDs missing/duplicate');
    for (const [k,v] of Object.entries(values)) vars.push('-v',`${k}=${v}`);
    sql = resolve(here,'phase2-fixtures.sql');
  } else childEnv.PGOPTIONS += ' -c default_transaction_read_only=on';
  const result = spawnSync(resolve(c.psql_path), ['-X','-w','-q','-A','-t','-v','ON_ERROR_STOP=1',...vars,'-f',sql],
    {encoding:'utf8',env:childEnv,windowsHide:true,timeout:60000,maxBuffer:1024*1024});
  // Never forward raw libpq diagnostics, SQL parameters or credential-bearing responses.
  need(result.status === 0, `psql failed (exit ${result.status ?? 'unavailable'}); no automatic retry`);
  const line = result.stdout.split(/\r?\n/).find(s => s.startsWith('{"bath_connection"'));
  need(line, 'Missing connection verification result');
  const report = JSON.parse(line).bath_connection;
  console.log(JSON.stringify({mode,project_ref:REF,database:report.database,user:report.user,
    session_user:report.session_user,tls:report.tls,migrations:report.migrations,tables:report.tables,rows:report.rows}));
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    // Only locally defined errors are safe; network/fs errors can include private paths.
    const safe = /^(Development|Confirm |Only |Invalid |Connection |Missing |Live |Keep |Unavailable |Verify |Private |Use |TLS |psql |Manifest |Separate |Management GET|Missing connection)/;
    console.error(safe.test(error.message) ? error.message : 'Connection preparation failed; inspect private configuration locally');
    process.exitCode = 1;
  });
}
