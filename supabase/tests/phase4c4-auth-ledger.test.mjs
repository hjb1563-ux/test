import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {ACTORS,REF,newJournal} from './phase4c3-model.mjs';
import {newAuthLedger,authMarker,beginAuthCreate,recordAuthCreated,recordAuthVerified,recordAuthCreateUnknown,manifestFromAuthLedger,recordDbFixtureAttempt,planOwnedAuthDelete,recordAuthDeleteUnknown,confirmOwnedAuthAbsent} from './phase4c4-auth-ledger.mjs';
function add(l,a){beginAuthCreate(l,a);const u={id:randomUUID(),is_anonymous:a==='ANONYMOUS',email_confirmed_at:a==='ANONYMOUS'?null:'confirmed',app_metadata:authMarker(l,a)};recordAuthCreated(l,a,u);recordAuthVerified(l,a,u);return u;}
function evidence(l,u){return {project_ref:REF,fixture_id:l.fixture_id,uid:u.id,get_only_verified:true,checked_at:new Date().toISOString(),projects:[],memberships:[],businesses:[]};}
const absent=uid=>({requested_uid:uid,method:'GET',status:404,data:{code:'user_not_found'}});
test('partial Auth create failure preserves exact known UIDs; unknown create cannot retry',()=>{
 const l=newAuthLedger(),a=add(l,'BUSINESS_A');beginAuthCreate(l,'BUSINESS_B');recordAuthCreateUnknown(l,'BUSINESS_B');
 assert.throws(()=>beginAuthCreate(l,'BUSINESS_B'));assert.throws(()=>manifestFromAuthLedger(l));
 planOwnedAuthDelete(l,a.id,a,evidence(l,a));assert.equal(confirmOwnedAuthAbsent(l,a.id,absent(a.id)),false);assert.equal(l.users.BUSINESS_B.state,'create_unknown');
});
test('unregistered Auth UID cannot be deleted or accepted as absent',()=>{const l=newAuthLedger(),u=add(l,'BUSINESS_A'),id=randomUUID();assert.throws(()=>planOwnedAuthDelete(l,id,u,evidence(l,u)));assert.throws(()=>confirmOwnedAuthAbsent(l,id,absent(id)));});
test('duplicate UID and pre-existing user adoption refused',()=>{const l=newAuthLedger(),u=add(l,'BUSINESS_A');assert.throws(()=>recordAuthCreated(l,'GENERAL',u));beginAuthCreate(l,'GENERAL');assert.throws(()=>recordAuthCreated(l,'GENERAL',u));});
test('trusted marker and confirmed email mandatory',()=>{const l=newAuthLedger();beginAuthCreate(l,'GENERAL');const u={id:randomUUID(),is_anonymous:false};recordAuthCreated(l,'GENERAL',u);assert.throws(()=>recordAuthVerified(l,'GENERAL',u));u.app_metadata=authMarker(l,'GENERAL');assert.throws(()=>recordAuthVerified(l,'GENERAL',u));});
for(const key of ['projects','memberships','businesses'])test(`residual ${key} blocks Auth cascade`,()=>{const l=newAuthLedger(),u=add(l,'ANONYMOUS'),e=evidence(l,u);e[key]=[{id:randomUUID()}];assert.throws(()=>planOwnedAuthDelete(l,u.id,u,e));assert.equal(l.users.ANONYMOUS.state,'verified');});
test('fixture attempt requires completed validated DB cleanup journal',()=>{
 const l=newAuthLedger(),users=Object.fromEntries(ACTORS.map(a=>[a,add(l,a)])),m=manifestFromAuthLedger(l);assert.deepEqual(manifestFromAuthLedger(l),m);recordDbFixtureAttempt(l,m);
 const u=users.BUSINESS_A,e=evidence(l,u);assert.throws(()=>planOwnedAuthDelete(l,u.id,u,e));e.business_journal=newJournal(m);assert.throws(()=>planOwnedAuthDelete(l,u.id,u,e));
 e.business_journal.cleanup_complete=true;assert.throws(()=>planOwnedAuthDelete(l,u.id,u,e));for(const row of e.business_journal.entries)row.cleaned=true;
 assert.equal(planOwnedAuthDelete(l,u.id,u,e).uid,u.id);
});
test('interrupted Auth deletion reconciles GET absence and safely resumes',()=>{const l=newAuthLedger(),u=add(l,'GENERAL');planOwnedAuthDelete(l,u.id,u,evidence(l,u));recordAuthDeleteUnknown(l,u.id);assert.equal(confirmOwnedAuthAbsent(l,u.id,absent(u.id)),true);assert.equal(confirmOwnedAuthAbsent(l,u.id,absent(u.id)),true);assert.throws(()=>planOwnedAuthDelete(l,u.id,u,evidence(l,u)));});
test('wrong project, stale evidence, marker mismatch all fail closed',()=>{const l=newAuthLedger(),u=add(l,'GENERAL'),e=evidence(l,u);assert.throws(()=>planOwnedAuthDelete(l,u.id,u,{...e,project_ref:'production'}));assert.throws(()=>planOwnedAuthDelete(l,u.id,u,{...e,checked_at:'2000-01-01'}));assert.throws(()=>planOwnedAuthDelete(l,u.id,{...u,app_metadata:{}},e));});
test('401/403/unrelated 404 never mean successful Auth cleanup',()=>{const l=newAuthLedger(),u=add(l,'GENERAL');assert.throws(()=>confirmOwnedAuthAbsent(l,u.id,absent(u.id)));planOwnedAuthDelete(l,u.id,u,evidence(l,u));for(const status of [401,403,500])assert.throws(()=>confirmOwnedAuthAbsent(l,u.id,{...absent(u.id),status}));assert.throws(()=>confirmOwnedAuthAbsent(l,u.id,{...absent(u.id),data:{code:'other'}}));assert.equal(l.users.GENERAL.state,'delete_requested');});
