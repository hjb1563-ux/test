// Future approved Direct-only fixture transport. No Auth creation / grants / pooler fallback.
import {readFileSync,writeFileSync,renameSync,openSync,closeSync,unlinkSync,existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {REF,NAME,URL,need,SafetyError,validateManifest,validateJournal} from './phase4c3-model.mjs';
import {privateStorage} from './phase4c3-businesses.mjs';
import {validateConfig,childEnvironment} from './phase4a4-connection.mjs';
const here=dirname(fileURLToPath(import.meta.url));
export async function runFixture({mode='--check',env=process.env,fetcher=globalThis.fetch,spawn=spawnSync,storageCheck=privateStorage,log=console.log}={}){
 need(['--plan','--check','--run'].includes(mode),'Invalid fixture mode');
 if(mode==='--plan'){log('Direct-only: --check is read-only; --run creates 3 businesses + 6 memberships + 1 foreign project after explicit approval; no Auth creation');return {success:true};}
 const get=n=>{need(env[n],`Missing ${n}`);return env[n];};
 need(get('BATH_TEST_SUPABASE_URL')===URL&&get('BATH_RLS_TEST_CONFIRM')===NAME,'Development target mismatch');
 need(env.NODE_TLS_REJECT_UNAUTHORIZED!=='0','TLS bypass forbidden');
 const folder=resolve('tests/artifacts/phase4a2');storageCheck(folder);
 const paths=['BATH_TEST_DB_CONFIG','BATH_BUSINESS_MANIFEST','BATH_BUSINESS_JOURNAL'].map(n=>resolve(get(n)));
 need(paths.every(p=>dirname(p)===folder),'Fixture config outside private folder');
 const [configFile,manifestFile,journalFile]=paths;
 const c=validateConfig(JSON.parse(readFileSync(configFile,'utf8')));
 need(c.mode==='direct'&&c.host===`db.${REF}.supabase.co`&&c.user==='postgres','Direct only; Session Pooler forbidden');
 for(const p of [c.psql_path,c.ca_file,c.pgpass_file])need(existsSync(p),'Client/CA/password file unavailable');
 storageCheck(resolve(c.pgpass_file)); // Validate external password-file ACL, never read/copy content.
 const m=validateManifest(JSON.parse(readFileSync(manifestFile,'utf8'))),j=validateJournal(JSON.parse(readFileSync(journalFile,'utf8')),m);
 const management=get('BATH_TEST_MANAGEMENT_TOKEN');let target;
 try{const r=await fetcher(`https://api.supabase.com/v1/projects/${REF}`,{method:'GET',headers:{Authorization:`Bearer ${management}`},redirect:'error',signal:AbortSignal.timeout(15000)});need(r.ok,'Management GET failed');target=await r.json();}
 catch(e){if(e instanceof SafetyError)throw e;throw new SafetyError('Management network/protocol failure');}
 need(target.id===REF&&target.name===NAME&&target.status==='ACTIVE_HEALTHY'&&target.database?.host===c.host,'Live development identity mismatch');
 const childEnv=childEnvironment(c,env);
 const version=spawn(resolve(c.psql_path),['--version'],{env:childEnv,encoding:'utf8',windowsHide:true,timeout:10000});
 need(version.status===0&&Number(version.stdout?.match(/PostgreSQL\) (\d+)/)?.[1])>=15,'psql 15+ required');
 const args=['-X','-w','-q','-A','-t','-v','ON_ERROR_STOP=1','-v',`project_ref=${REF}`,'-v',`project_name=${NAME}`];
 if(mode==='--check'){
  const r=spawn(resolve(c.psql_path),[...args,'-c','begin read only;','-f',resolve(here,'phase4a4-connection-check.sql'),'-c',"select current_setting('transaction_read_only');",'-c','commit;'],{env:childEnv,encoding:'utf8',windowsHide:true,timeout:30000});
  need(r.status===0&&r.stdout.split(/\r?\n/).includes('on'),'Direct read-only TLS/schema check failed; no retry/fallback');
  log('DIRECT CHECK PASS: verify-full + backend TLS + schema + read_only=on');return {success:true};
 }
 need(get('BATH_TEST_SECRET_STORAGE_CONFIRM')==='private-acl-verified'&&get('BATH_BUSINESS_FIXTURE_CONFIRM')==='create-business-fixture','Separate fixture approval required');
 need(!j.started&&!j.cleanup_complete&&!j.fixture_attempted&&j.fixture_outcome===undefined,'Fixture already attempted; inspect/cleanup, never repeat');
 const lock=resolve(folder,`business-${m.fixture_id}.lock`);const fd=openSync(lock,'wx',0o600);closeSync(fd);
 const save=()=>{const temp=`${journalFile}.${randomUUID()}.tmp`;writeFileSync(temp,JSON.stringify(j,null,2),{flag:'wx',mode:0o600,flush:true});renameSync(temp,journalFile);};
 try{
  j.fixture_attempted=true;j.fixture_outcome='UNKNOWN';save();
  childEnv.BATH_BUSINESS_JOURNAL_READY=m.fixture_id;
  const r=spawn(resolve(c.psql_path),[...args,'-v',`manifest_json=${JSON.stringify(m)}`,'-f',resolve(here,'phase4c3-fixture.sql')],{env:childEnv,encoding:'utf8',windowsHide:true,timeout:60000});
  j.fixture_outcome=r.status===0?'COMMITTED':'UNKNOWN_OR_FAILED';save();
  need(r.status===0,'Fixture failed/unknown; preserve journal; no retry/fallback');
  log('FIXTURE COMMITTED: 3 businesses / 6 memberships / 1 project; verify via business --check');return {success:true};
 }finally{unlinkSync(lock);}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))runFixture({mode:process.argv[2]||'--check'}).catch(e=>{console.error(e instanceof SafetyError?e.message:'LOCAL_FIXTURE_FAILURE');process.exitCode=1;});
