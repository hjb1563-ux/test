// Offline only: no network, psql process or credentials.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateConfig, validatePooler, childEnvironment, REF, SESSION_HOST } from './phase4a4-connection.mjs';
const c = {project_ref:REF,project_name:'bath-designer-dev',mode:'session',dashboard_confirmed:true,
  host:SESSION_HOST,port:5432,database:'postgres',user:`postgres.${REF}`,
  psql_path:'not-executed',ca_file:'not-read',pgpass_file:'not-read'};
const p = {database_type:'PRIMARY',pool_mode:'session',db_host:c.host,db_port:5432,db_name:'postgres',db_user:c.user};
test('exact live endpoint, tenant, port and session attestation required', () => {
  validateConfig(c); validatePooler(c,[p]);
  for (const change of [{db_host:'other.invalid'},{db_user:'postgres.other'},{db_port:6543},
    {pool_mode:'transaction'},{database_type:'READ_REPLICA'},{db_name:'other'}]) {
    assert.throws(() => validatePooler(c,[{...p,...change}]));
  }
  assert.throws(() => validatePooler(c,[]));
});
test('unconfirmed Dashboard, other project, transaction port and identity blocked', () => {
  for (const change of [{dashboard_confirmed:false},{project_ref:'other'},{project_name:'production'},
    {port:6543},{database:'other'},{user:'postgres.other'},{mode:'transaction'},{host:'host value'}, {host:'other.pooler.supabase.com'}]) {
    assert.throws(() => validateConfig({...c,...change}));
  }
  validateConfig({...c,mode:'direct',host:`db.${REF}.supabase.co`,user:'postgres'});
  assert.throws(() => validateConfig({...c,mode:'direct'}));
});
test('child cannot inherit password, service, hostaddr, TLS bypass or Auth keys', () => {
  const e = childEnvironment(c,{PGPASSWORD:'secret',PGSERVICE:'other',PGHOSTADDR:'wrong',PGSSLMODE:'disable',
    PGOPTIONS:'-c role=other',BATH_TEST_ADMIN_KEY:'secret',BATH_TEST_MANAGEMENT_TOKEN:'secret',NODE_TLS_REJECT_UNAUTHORIZED:'0'});
  for (const name of ['PGPASSWORD','PGSERVICE','PGHOSTADDR','BATH_TEST_ADMIN_KEY','BATH_TEST_MANAGEMENT_TOKEN','NODE_TLS_REJECT_UNAUTHORIZED']) assert.equal(e[name],undefined);
  assert.equal(e.PGSSLMODE,'verify-full'); assert.equal(e.PGHOST,c.host); assert.equal(e.PGUSER,c.user);
});
test('Fixture checks same connection before any mutation, original body untouched', () => {
  const fixture = readFileSync(new URL('./phase2-fixtures.sql',import.meta.url),'utf8');
  assert.ok(fixture.indexOf('\\ir phase4a4-connection-check.sql') < fixture.indexOf('\nbegin;'));
  for (const s of ['pg_advisory_xact_lock','raw_app_meta_data','Fixture collision/drift/customer data','on conflict (id) do nothing']) assert.ok(fixture.includes(s));
  const sql = readFileSync(new URL('./phase4a4-connection-check.sql',import.meta.url),'utf8');
  assert.ok(sql.includes('pg_stat_ssl')); assert.ok(sql.includes('as safe_schema from schema_state \\gset'));
  assert.doesNotMatch(sql,/\b(insert|update|delete|create|alter|drop|truncate)\b/i);
});
