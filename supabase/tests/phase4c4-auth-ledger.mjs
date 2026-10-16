// PURE OFFLINE state/gate helpers for a future separately approved Auth executor.
// No fetch, credentials, Auth creation, deletion, or file operations occur here.
// Caller MUST atomically flush each intent before its corresponding remote request.
import {randomUUID} from 'node:crypto';
import {REF,ACTORS,need,uuid,createManifest,validateManifest,validateJournal} from './phase4c3-model.mjs';
import {authErrorCode} from './phase4b1-customers.mjs';
export function newAuthLedger(){return {kind:'business-auth-ledger-v1',project_ref:REF,fixture_id:randomUUID(),provisioning_id:randomUUID(),created_at:new Date().toISOString(),fixture_attempted:false,
 users:Object.fromEntries(ACTORS.map(a=>[a,{uid:null,state:'planned',nonce:randomUUID()}]))};}
export function validateAuthLedger(l){
 need(l?.kind==='business-auth-ledger-v1'&&l.project_ref===REF,'Wrong Auth ledger/project');uuid(l.fixture_id);uuid(l.provisioning_id);
 need(JSON.stringify(Object.keys(l.users||{}).sort())===JSON.stringify([...ACTORS].sort()),'Wrong Auth actor set');
 const ids=[l.fixture_id,l.provisioning_id];
 for(const a of ACTORS){const r=l.users[a];uuid(r.nonce);ids.push(r.nonce);
  need(['planned','create_requested','create_unknown','created_unverified','marker_unknown','verified','delete_requested','delete_unknown','deleted'].includes(r.state),'Unknown Auth state');
  if(r.uid!==null){uuid(r.uid);ids.push(r.uid);}else need(['planned','create_requested','create_unknown'].includes(r.state),'Missing created Auth UID');
 }
 need(new Set(ids).size===ids.length,'Duplicate Auth identity/nonce');return l;
}
function record(l,a){validateAuthLedger(l);need(ACTORS.includes(a),'Unregistered Auth actor');return l.users[a];}
export function authMarker(l,a){const r=record(l,a);return {bath_business_rls_fixture:l.fixture_id,bath_business_auth_provision:l.provisioning_id,bath_business_auth_actor:a,bath_business_auth_nonce:r.nonce};}
export function beginAuthCreate(l,a){const r=record(l,a);need(r.state==='planned'&&r.uid===null,'Do not recreate or adopt existing users');r.state='create_requested';r.create_requested_at=new Date().toISOString();return {actor:a,anonymous:a==='ANONYMOUS',marker:authMarker(l,a)};}
export function recordAuthCreated(l,a,u){const r=record(l,a);need(r.state==='create_requested'&&r.uid===null,'Unexpected Auth create response');uuid(u?.id);
 need(u.is_anonymous===(a==='ANONYMOUS'),'Auth type mismatch');need(!Object.values(l.users).some(x=>x.uid===u.id)&&![l.fixture_id,l.provisioning_id,...Object.values(l.users).map(x=>x.nonce)].includes(u.id),'Duplicate Auth UID');
 r.uid=u.id;r.state='created_unverified';return r.uid;
}
function verifyUser(l,a,u){const r=record(l,a);need(r.uid&&u?.id===r.uid&&u.is_anonymous===(a==='ANONYMOUS'),'Auth target mismatch');
 for(const [k,v] of Object.entries(authMarker(l,a)))need(u.app_metadata?.[k]===v,'Trusted Auth marker mismatch');
 if(a!=='ANONYMOUS')need(Boolean(u.email_confirmed_at),'Email confirmation missing');
}
export function recordAuthVerified(l,a,u){const r=record(l,a);need(['created_unverified','marker_unknown','verified'].includes(r.state),'Creation not recorded');verifyUser(l,a,u);r.state='verified';}
export function recordAuthCreateUnknown(l,a){const r=record(l,a);need(['create_requested','created_unverified'].includes(r.state),'No pending create/marker request');r.state=r.uid?'marker_unknown':'create_unknown';}
export function manifestFromAuthLedger(l){validateAuthLedger(l);need(ACTORS.every(a=>l.users[a].state==='verified'),'Five verified users required');
 if(l.manifest){validateManifest(l.manifest);need(l.manifest.fixture_id===l.fixture_id&&ACTORS.every(a=>l.manifest.users[a]===l.users[a].uid),'Manifest identity drift');return l.manifest;}
 const m={...createManifest(Object.fromEntries(ACTORS.map(a=>[a,l.users[a].uid]))),fixture_id:l.fixture_id};validateManifest(m);l.manifest=m;return m;
}
export function recordDbFixtureAttempt(l,m){validateAuthLedger(l);validateManifest(m);need(l.manifest&&JSON.stringify(l.manifest)===JSON.stringify(m),'Unbound fixture manifest');need(!l.fixture_attempted,'Fixture attempt already recorded');l.fixture_attempted=true;}
export function planOwnedAuthDelete(l,uid,observedUser,evidence){
 validateAuthLedger(l);uuid(uid);const actor=ACTORS.find(a=>l.users[a].uid===uid);need(actor,'Unregistered Auth UID; never delete');
 const r=l.users[actor];need(['verified','delete_requested','delete_unknown'].includes(r.state),'Auth user not verified/owned for deletion');verifyUser(l,actor,observedUser);
 need(evidence?.project_ref===REF&&evidence.fixture_id===l.fixture_id&&evidence.uid===uid&&evidence.get_only_verified===true,'Wrong cleanup evidence target');
 const age=Date.now()-Date.parse(evidence.checked_at);need(Number.isFinite(age)&&age>=-5000&&age<=30000,'Stale cleanup evidence');
 for(const key of ['projects','memberships','businesses'])need(Array.isArray(evidence[key])&&evidence[key].length===0,'Residual data; refuse Auth CASCADE');
 if(l.fixture_attempted){need(l.manifest&&evidence.business_journal,'Missing DB cleanup journal');validateJournal(evidence.business_journal,l.manifest);
  need(evidence.business_journal.cleanup_complete===true&&evidence.business_journal.entries.every(e=>e.cleaned===true),'DB cleanup incomplete; refuse Auth delete');
 }
 r.state='delete_requested';r.delete_requested_at=new Date().toISOString();return {actor,uid,method:'DELETE',path:`/auth/v1/admin/users/${uid}`};
}
export function recordAuthDeleteUnknown(l,uid){validateAuthLedger(l);const actor=ACTORS.find(a=>l.users[a].uid===uid);need(actor&&l.users[actor].state==='delete_requested','No recorded Auth delete intent');l.users[actor].state='delete_unknown';}
export function confirmOwnedAuthAbsent(l,uid,response){validateAuthLedger(l);const actor=ACTORS.find(a=>l.users[a].uid===uid);need(actor,'Unregistered missing Auth UID');
 const r=l.users[actor];need(['delete_requested','delete_unknown','deleted'].includes(r.state),'Missing user before delete intent is not cleanup success');
 need(response?.requested_uid===uid&&response.method==='GET'&&response.status===404&&authErrorCode(response.data,response.headers,response.status)==='user_not_found','Auth absence not verified');
 r.state='deleted';return ACTORS.every(a=>['planned','deleted'].includes(l.users[a].state));
}
