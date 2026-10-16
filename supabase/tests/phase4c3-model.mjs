// Pure offline fixture specification. No credentials, network or DB connections.
import {randomUUID} from 'node:crypto';
export const REF='istsrambmbzuemkgutgh',NAME='bath-designer-dev',URL=`https://${REF}.supabase.co`;
export const ACTORS=['BUSINESS_A','BUSINESS_B','GENERAL','PENDING','ANONYMOUS'];
export const BUSINESS_KEYS=['A','B','SUSPENDED'],MEMBER_KEYS=['A','B','PENDING','ANONYMOUS','SUSPENDED','REVOKED'];
export class SafetyError extends Error {}
export const need=(ok,message)=>{if(!ok)throw new SafetyError(message);};
export const uuid=v=>need(typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(v),'Invalid UUID');
const keys=(v,expected)=>need(v&&JSON.stringify(Object.keys(v).sort())===JSON.stringify([...expected].sort()),'Unexpected manifest keys');
export function validateManifest(m){
 need(m?.kind==='business-rls-v1'&&m.project_ref===REF,'Wrong business manifest/project');
 keys(m,['kind','project_ref','fixture_id','users','businesses','members','project_id']);
 keys(m.users,ACTORS);keys(m.businesses,BUSINESS_KEYS);keys(m.members,MEMBER_KEYS);
 const ids=[m.fixture_id,...Object.values(m.users),...Object.values(m.businesses),...Object.values(m.members),m.project_id];
 ids.forEach(uuid);need(new Set(ids).size===ids.length,'Duplicate fixture UUID');return m;
}
export function createManifest(users){return validateManifest({kind:'business-rls-v1',project_ref:REF,fixture_id:randomUUID(),users,
 businesses:Object.fromEntries(BUSINESS_KEYS.map(k=>[k,randomUUID()])),members:Object.fromEntries(MEMBER_KEYS.map(k=>[k,randomUUID()])),project_id:randomUUID()});}
export function rowsFor(m){
 validateManifest(m);const marker=`BATH-BUSINESS-RLS:${m.fixture_id}`;
 const businesses=BUSINESS_KEYS.map(k=>({id:m.businesses[k],business_name:`${marker}:${k}`,status:k==='SUSPENDED'?'suspended':'approved'}));
 const specs=[['A','A','BUSINESS_A','approved'],['B','B','BUSINESS_B','approved'],['PENDING','A','PENDING','pending'],
 ['ANONYMOUS','A','ANONYMOUS','approved'],['SUSPENDED','SUSPENDED','BUSINESS_A','approved'],['REVOKED','A','BUSINESS_B','revoked']];
 const members=specs.map(([k,b,u,status])=>({id:m.members[k],business_id:m.businesses[b],user_id:m.users[u],role:'member',status}));
 const project={id:m.project_id,owner_user_id:m.users.ANONYMOUS,project_info:{builderMode:'consumer',projectName:`${marker}:PROJECT`},selections:{},schema_version:3};
 return {businesses,members,project};
}
export function newJournal(m){
 const r=rowsFor(m);
 return {kind:'business-journal-v1',project_ref:REF,run_id:randomUUID(),manifest:m,created_at:new Date().toISOString(),
 plan:{auth:'5 externally provisioned dedicated users; retain, never delete here',fixture:'Direct verified PostgreSQL only; no Data API admin INSERT',cleanup:'project/probes, memberships, businesses; pre-audit all identities and inbound references; retain external Auth'},
 entries:[...r.businesses.map(body=>({table:'businesses',body,source:'fixture'})),...r.members.map(body=>({table:'business_members',body,source:'fixture'})),{table:'projects',body:r.project,source:'fixture'}],
 results:[],started:false,finished:false,cleanup_complete:false,cleanup_errors:[]};
}
export function validateJournal(j,m){
 need(j?.kind==='business-journal-v1'&&j.project_ref===REF,'Wrong journal');uuid(j.run_id);
 need(JSON.stringify(j.manifest)===JSON.stringify(m),'Journal/manifest mismatch');need(Array.isArray(j.entries)&&Array.isArray(j.results),'Invalid journal');
 const initial=newJournal(m).entries;need(j.entries.length>=initial.length,'Missing baseline journal');
 for(let i=0;i<initial.length;i++)need(JSON.stringify(j.entries[i].body)===JSON.stringify(initial[i].body)&&j.entries[i].table===initial[i].table&&j.entries[i].source==='fixture','Baseline journal drift');
 const all=[];
 for(const [index,e] of j.entries.entries()){uuid(e.body?.id);all.push(e.body.id);need(['projects','businesses','business_members'].includes(e.table),'Unknown cleanup table');
  if(index>=initial.length)need(e.source==='probe','Unexpected additional fixture row');
  need(![m.fixture_id,...Object.values(m.users)].includes(e.body.id),'Reserved UUID used as row target');
  if(e.source!=='fixture'){
   need(e.source==='probe'&&['businesses','business_members'].includes(e.table),'Invalid probe');
   if(e.table==='businesses')need(e.body.business_name===`BATH-BUSINESS-RLS:${m.fixture_id}:PROBE`&&e.body.status==='approved','Invalid business probe');
   else need(Object.values(m.businesses).includes(e.body.business_id)&&Object.values(m.users).includes(e.body.user_id)&&e.body.role==='admin'&&e.body.status==='approved','Invalid member probe');
  }
 }
 need(new Set(all).size===all.length,'Duplicate journal target');return j;
}
