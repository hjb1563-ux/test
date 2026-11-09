const assert = require('node:assert/strict'), path = require('node:path');
const { load } = require('./bathroom-style-draft.cjs');
const entry = load(path.resolve('data/bathroom-project-entry.ts'));
let raw = null, writes = 0; const session = new Map();
global.localStorage = { getItem: () => raw, setItem: () => writes++, removeItem: () => writes++ };
global.sessionStorage = { getItem: k => session.get(k) ?? null, setItem: (k,v) => session.set(k,v), removeItem: k => session.delete(k) };
function inspect(value) { raw = value === null ? null : JSON.stringify(value); return entry.inspectProject(); }
for(const value of [null, {}, {version:3,current:0,values:{},projectInfo:{builderMode:'consumer'},memo:'',specialNotes:''}])assert.equal(inspect(value).meaningful,false);
for(const value of [{memo:'memo'}, {specialNotes:'note'}, {current:1}, {projectInfo:{budget:0}}, {projectInfo:{areaPyeong:'20'}}, {projectInfo:{builderMode:'professional'}}, {values:{tile:'white'}}])assert.equal(inspect(value).meaningful,true);
assert.equal(inspect({memo:'memo'}).stepNumber,null);
assert.equal(inspect({version:2,current:16,projectInfo:{builderMode:'professional'}}).stepNumber,15);
for(const mode of ['consumer','professional']){
 const p={version:3,current:6,projectInfo:{builderMode:mode,projectName:'test',extra:'preserve'},values:{partitionShower:'half-partition',bathtub:'bath-standard'},memo:'memo',specialNotes:'notes',extension:{preserve:true}};
 const snapshot=inspect(p); assert.equal(snapshot.stepNumber,mode==='consumer'?7:8); assert.equal(snapshot.project.values.bathtub,'bath-standard');assert.deepEqual(snapshot.project.extension,p.extension);assert.equal(snapshot.project.projectInfo.extra,'preserve');
 const original=raw; assert.equal(entry.isActiveProject(raw),false);entry.activateProject(raw);assert.equal(entry.isActiveProject(raw),true);
 raw=JSON.stringify({...p,memo:'edited on result'});assert.equal(entry.isActiveProject(raw),true);entry.activateProject(null);assert.equal(entry.isActiveProject(raw),false);raw=original;
 for(let i=0;i<3;i++)entry.inspectProject();assert.equal(raw,original);
}
for(const invalid of ['{broken','null','[]','{"current":-1}','{"values":2}','{"values":{"tile":true}}','{"imageHistoryOrder":[3]}']){raw=invalid;assert.throws(()=>entry.inspectProject());assert.equal(raw,invalid);}
global.localStorage.getItem=()=>{throw new Error('blocked');};assert.throws(()=>entry.inspectProject());assert.equal(writes,0);
console.log('PASS read-only inspection, defaults/progress/metadata, both modes, bathtub skip, extensions, repeated reads, sessions, corrupt/blocked storage');
