import { CustomerProjectSync, DEV_PROJECT_REF, fromProjectRow, toProjectContent, restoreLocalDraft, type CustomerProjectPort, type ProjectRow } from './customer-project-sync';
import type { LocalProject } from './bathroom-consultation';
import type { BrowserStorage } from './customer-anonymous-auth';
import { PROJECT_LOCK, browserCloudLocks, type CloudLocks } from './customer-cloud-locks';
export type ReviewReason='revision-conflict'|'owner-mismatch'|'missing-or-inaccessible'|'uncertain-insert'|'server-diverged'|'save-failed'|'corrupt-metadata'|'metadata-changed';
export type Binding = {version:1;schema_version:3;projectRef:string;id:string;owner:string|null;revision:string|null;confirmed:ProjectRow|null;pending:LocalProject|null;attempted:boolean;blocked:ReviewReason|null};
const copy=<T,>(v:T):T=>JSON.parse(JSON.stringify(v));
const idOk=(v:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
export class CustomerProjectBinding {
  private binding?:Binding;private sync?:CustomerProjectSync;private queue:Promise<void>=Promise.resolve();
  private loaded=false;private stopped=false;
  private latest?:LocalProject;
  private expectedRaw:string|null|undefined;
  private operationSignal?:AbortSignal;
  private recoveryKey?:string;
  readonly key='bath-designer-customer-cloud-v1';
  constructor(private options:{enabled?:boolean;port:CustomerProjectPort;storage:BrowserStorage;localKey:string;uuid:()=>string;locks?:CloudLocks;tabId?:string}){}
  signal(){return this.operationSignal;}
  checkpoint(){return this.expectedRaw;}
  private assertCurrent(){this.operationSignal?.throwIfAborted();if(this.options.storage.getItem(this.key)!==this.expectedRaw)throw Error('metadata-changed');}
  private persist(){this.assertCurrent();const raw=JSON.stringify(this.binding);this.options.storage.setItem(this.key,raw);if(this.options.storage.getItem(this.key)!==raw)throw Error('metadata-storage-failed');this.expectedRaw=raw;}
  private locked<T>(work:()=>Promise<T>){return (this.options.locks??browserCloudLocks).run(PROJECT_LOCK,async signal=>{
    this.operationSignal=signal;try{return await work();}finally{this.operationSignal=undefined;}
  });}
  private preserve(project:LocalProject,reason:string){
    this.recoveryKey??=`${this.key}:pending:${this.options.tabId??this.options.uuid()}`;
    this.options.storage.setItem(this.recoveryKey,JSON.stringify({projectId:this.binding?.id??null,revision:this.binding?.revision??null,localRaw:this.options.storage.getItem(this.options.localKey),pending:project,reason}));
  }
  owner(){
    const raw=this.options.storage.getItem(this.key);if(!raw)return null;
    try{const b=JSON.parse(raw);this.validate(b);return b.owner;}catch{throw Error('corrupt-metadata');}
  }
  private validate(b:Binding){
    if(b?.version!==1||b.schema_version!==3||b.projectRef!==DEV_PROJECT_REF||!idOk(b.id)||!(b.owner===null||idOk(b.owner))||!(b.revision===null||/^[1-9][0-9]*$/.test(b.revision))||typeof b.attempted!=='boolean')throw Error('corrupt-metadata');
    if(b.confirmed){fromProjectRow(b.confirmed);if(b.confirmed.id!==b.id||b.confirmed.owner_user_id!==b.owner||b.confirmed.revision!==b.revision)throw Error('corrupt-metadata');}
    if(b.revision&&!b.confirmed)throw Error('corrupt-metadata');if(b.pending)toProjectContent(b.pending);
  }
  private async init(){
    if(this.loaded)return;
    const raw=this.options.storage.getItem(this.key);
    if(this.expectedRaw===undefined)this.expectedRaw=raw;
    this.assertCurrent();
    if(raw){this.binding=JSON.parse(raw);this.validate(this.binding!);}else{
      this.binding={version:1,schema_version:3,projectRef:DEV_PROJECT_REF,id:this.options.uuid(),owner:null,revision:null,confirmed:null,pending:null,attempted:false,blocked:null};this.validate(this.binding);this.persist();
    }
    const b=this.binding!;
    if(this.latest){b.pending=this.latest;this.persist();}
    const port:CustomerProjectPort={session:async()=>{
      if(this.stopped)throw Error('binding-stopped');const s=await this.options.port.session();
      if(this.stopped)throw Error('binding-stopped');this.assertCurrent();
      if(b.owner&&b.owner!==s.userId){b.blocked='owner-mismatch';this.persist();throw Error('owner-mismatch');}
      b.owner=s.userId;this.persist();return s;
    },get:(id,owner)=>this.options.port.get(id,owner),
    insert:async row=>{this.assertCurrent();if(b.attempted)throw Error('uncertain-insert');b.attempted=true;this.persist();const result=await this.options.port.insert(row);if(result.revision!=='1')throw Error('invalid-revision');this.confirm(result);return result;},
    update:async(id,owner,rev,content)=>{this.assertCurrent();const row=await this.options.port.update(id,owner,rev,content);if(row){if(BigInt(row.revision)!==BigInt(rev)+BigInt(1))throw Error('invalid-revision');this.confirm(row);}return row;}};
    this.sync=new CustomerProjectSync({enabled:true,projectRef:DEV_PROJECT_REF,id:b.id,port,storage:this.options.storage,localKey:this.options.localKey});
    this.loaded=true;
    if(b.owner){
      const s=await port.session();const row=await port.get(b.id,s.userId);
      if(!row){if(b.attempted||b.revision)b.blocked='missing-or-inaccessible';}
      else if(row.owner_user_id!==b.owner||row.id!==b.id)b.blocked='owner-mismatch';
      else if(!b.confirmed)b.blocked='uncertain-insert';
      else if(!same(row,b.confirmed))b.blocked='server-diverged';
      else await this.sync.resumeFromReviewedServer(row);
      this.persist();
    }
  }
  private confirm(row:ProjectRow){const b=this.binding!;fromProjectRow(row);if(row.id!==b.id||row.owner_user_id!==b.owner||!/^[1-9][0-9]*$/.test(row.revision))throw Error('invalid-server-identity');b.confirmed=copy(row);b.revision=row.revision;this.persist();}
  save(project:LocalProject):Promise<void>{
    if(this.options.enabled!==true||project.projectInfo.builderMode!=='consumer')return Promise.resolve();
    const snapshot=copy(project);
    this.latest=snapshot;
    try{if(this.expectedRaw===undefined)this.expectedRaw=this.options.storage.getItem(this.key);this.preserve(snapshot,'queued');}catch{return Promise.reject(Error('recovery-storage-failed'));}
    const work=this.queue.then(()=>this.locked(async()=>{
      if(this.stopped)return;
      this.assertCurrent();
      await this.init();const b=this.binding!;b.pending=this.latest??snapshot;this.persist();
      if(b.blocked)throw Error(b.blocked);
      try{await this.sync!.save(snapshot);if(this.latest===snapshot)b.pending=null;this.persist();}
      catch{if(!b.blocked)b.blocked='save-failed';this.persist();throw Error(b.blocked);}
    })).catch(error=>{
      const reason=error instanceof Error&&error.message==='metadata-changed'?'metadata-changed':'save-failed';
      if(this.binding){this.binding.pending=this.latest??snapshot;if(reason==='metadata-changed')this.binding.blocked=reason;}
      this.preserve(this.latest??snapshot,reason);throw error;
    });this.queue=work.catch(()=>{});return work;
  }
  async inspect(){
    if(this.options.enabled!==true)return null;await this.queue;return this.locked(async()=>{
    const current=this.options.storage.getItem(this.key);
    if(this.expectedRaw!==undefined&&current!==this.expectedRaw)return {...this.state(),blocked:'metadata-changed' as const,latestMetadata:current,local:this.options.storage.getItem(this.options.localKey)};
    await this.init();const b=this.binding!;
    const s=await this.options.port.session();if(s.userId!==b.owner){b.blocked='owner-mismatch';this.persist();return this.state();}
    const server=await this.options.port.get(b.id,s.userId);
    if(!server)b.blocked='missing-or-inaccessible';
    else if(server.owner_user_id!==b.owner||server.id!==b.id)b.blocked='owner-mismatch';
    else b.blocked=b.confirmed&&server.revision!==b.confirmed.revision?'revision-conflict':b.confirmed?'save-failed':'uncertain-insert';
    const raw=this.options.storage.getItem(this.options.localKey);
    const local=raw===null?null:restoreLocalDraft(raw).project;
    this.persist();return {...this.state(),server:server?copy(server):null,local};});
  }
  // Explicit state-only review API, no UI changes. Never applies server data to localStorage.
  async reviewServer(row:ProjectRow){if(this.options.enabled!==true)throw Error('cloud-save-disabled');await this.queue;return this.locked(async()=>{
    const raw=this.options.storage.getItem(this.key);if(raw!==this.expectedRaw){const latest=JSON.parse(raw??'null');this.validate(latest);if(latest.id!==row.id||latest.owner!==row.owner_user_id)throw Error('review-stale');this.loaded=false;this.expectedRaw=raw;}
    await this.init();const b=this.binding!;const s=await this.options.port.session();if(s.userId!==b.owner)throw Error('owner-mismatch');const latest=await this.options.port.get(b.id,s.userId);if(!same(latest,row))throw Error('review-stale');await this.sync!.resumeFromReviewedServer(row);this.confirm(row);b.blocked=null;this.persist();});}
  state(){return this.binding?copy(this.binding):null;}
  stop(){this.stopped=true;}
  async retire(){this.stopped=true;await this.queue;if(this.options.enabled!==true)return;await this.locked(async()=>{if(this.binding)this.options.storage.setItem(`${this.key}:archive:${this.binding.id}:${this.options.tabId??'retired'}`,JSON.stringify(this.binding));});}
}
export async function rotateCustomerProject(storage:BrowserStorage,uuid:()=>string,expectedRaw:string|null|undefined,locks:CloudLocks=browserCloudLocks){
  return locks.run(PROJECT_LOCK,async signal=>{
    const key='bath-designer-customer-cloud-v1',raw=storage.getItem(key);signal.throwIfAborted();
    if(raw!==expectedRaw)throw Error('metadata-changed');
    if(raw){const old=JSON.parse(raw) as Binding;if(old.version!==1||old.schema_version!==3||old.projectRef!==DEV_PROJECT_REF||!idOk(old.id))throw Error('corrupt-metadata');storage.setItem(`${key}:archive:${old.id}:reset`,raw);}
    const id=uuid();if(!idOk(id))throw Error('invalid-project-id');
    const next:Binding={version:1,schema_version:3,projectRef:DEV_PROJECT_REF,id,owner:null,revision:null,confirmed:null,pending:null,attempted:false,blocked:null};
    storage.setItem(key,JSON.stringify(next));if(storage.getItem(key)!==JSON.stringify(next))throw Error('metadata-storage-failed');
  });
}
