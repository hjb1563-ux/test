// Preparation only: no SDK, fetch, environment credentials, or Builder integration.
import { normalizeProject, type LocalProject } from './bathroom-consultation';
export const CUSTOMER_CLOUD_SAVE_ENABLED = false;
export const DEV_PROJECT_REF = 'istsrambmbzuemkgutgh';
type StoragePort = Pick<Storage, 'getItem' | 'setItem'>;
export type Session = { userId: string; anonymous: boolean; expiresAt: number };
export type ProjectContent = ReturnType<typeof toProjectContent>;
export type ProjectRow = ProjectContent & { id: string; owner_user_id: string; revision: string };
// Future transport must use a publishable-key client with the actual user's JWT.
// update performs WHERE id/owner_user_id/revision and returns exactly one row.
export interface CustomerProjectPort {
  session(): Promise<Session>; // validate actual user; refresh existing session, never silently replace identity
  insert(row: ProjectContent & { id: string; owner_user_id: string }): Promise<ProjectRow>;
  update(id: string, owner: string, revision: string, content: ProjectContent): Promise<ProjectRow | null>;
  get(id: string, owner: string): Promise<ProjectRow | null>;
}
function requireValue(ok: unknown, code: string): asserts ok { if (!ok) throw new Error(code); }
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
const object = (v: unknown) => !!v && typeof v === 'object' && !Array.isArray(v);
const uuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
function jsonLimit(value: unknown, limit: number) {
  // Conservative upper bound for JSONB text spacing, including UTF-8 Korean.
  const text = JSON.stringify(value);
  requireValue(new TextEncoder().encode(text).length + (text.match(/[:,]/g)?.length ?? 0) <= limit, 'size-limit');
}
export function toProjectContent(p: LocalProject) {
  requireValue(p.version === 3 && p.projectInfo.builderMode === 'consumer', 'consumer-v3-required');
  requireValue(object(p.values) && Object.values(p.values).every(v => typeof v === 'string' || Array.isArray(v) && v.every(x => typeof x === 'string')), 'invalid-selections');
  requireValue(typeof p.memo === 'string' && Array.from(p.memo).length <= 65536 && typeof p.specialNotes === 'string' && Array.from(p.specialNotes).length <= 500, 'text-limit');
  requireValue(Number.isInteger(p.current) && p.current >= 0 && p.current <= 15, 'invalid-step');
  requireValue(object(p.checks) && Object.values(p.checks).every(v => typeof v === 'string'), 'invalid-checks');
  requireValue(Array.isArray(p.imageHistoryOrder) && p.imageHistoryOrder.every(v => typeof v === 'string'), 'invalid-history');
  requireValue(p.lastModifiedAt === null || Number.isFinite(Date.parse(p.lastModifiedAt)), 'invalid-date');
  jsonLimit(p.projectInfo,65536);jsonLimit(p.values,524288);jsonLimit(p.checks,65536);jsonLimit(p.imageHistoryOrder,65536);
  return clone({project_info:p.projectInfo,builder_mode:'consumer' as const,selections:p.values,consultation_memo:p.memo,special_notes:p.specialNotes,current_step:p.current,consultation_checks:p.checks,image_history_order:p.imageHistoryOrder,content_modified_at:p.lastModifiedAt,schema_version:3 as const});
}
export function fromProjectRow(row: ProjectRow): LocalProject {
  requireValue(row.schema_version === 3 && row.builder_mode === 'consumer' && row.project_info.builderMode === 'consumer', 'unsupported-server-schema');
  const p: LocalProject = {version:3,projectInfo:clone(row.project_info),values:clone(row.selections),memo:row.consultation_memo,specialNotes:row.special_notes,current:row.current_step,checks:clone(row.consultation_checks),imageHistoryOrder:clone(row.image_history_order),lastModifiedAt:row.content_modified_at};
  toProjectContent(p);return p;
}
export function restoreLocalDraft(raw: string): { project: LocalProject; original: string } {
  // Legacy normalizer is reused, but the original bytes remain available for recovery.
  const parsed = JSON.parse(raw);requireValue(object(parsed),'invalid-local-data');
  return {project:normalizeProject(parsed),original:raw};
}
export class CustomerProjectSync {
  status: 'off'|'idle'|'saving'|'saved'|'blocked' = 'off';
  private owner?: string; private revision?: string; private tail: Promise<void> = Promise.resolve();
  private pending?: LocalProject;
  constructor(private options: { enabled?: boolean; projectRef: string; id: string; port: CustomerProjectPort; storage: StoragePort; localKey: string }) {
    requireValue(options.projectRef === DEV_PROJECT_REF && uuid(options.id),'invalid-target');
    if(options.enabled === true)this.status='idle';
  }
  private async identity() {
    requireValue(this.options.enabled === true,'cloud-save-disabled');
    const s=await this.options.port.session();requireValue(uuid(s.userId)&&s.anonymous&&s.expiresAt>Date.now()+60000,'session-expired-or-invalid');
    requireValue(!this.owner||this.owner===s.userId,'session-owner-changed');this.owner=s.userId;return s.userId;
  }
  private backup() {
    const {storage,localKey,id}=this.options,key=`${localKey}:cloud-backup:${id}`;
    const raw=storage.getItem(localKey);if(raw!==null&&storage.getItem(key)===null){storage.setItem(key,raw);requireValue(storage.getItem(key)===raw,'backup-failed');}
  }
  private accept(row: ProjectRow,owner: string) {
    requireValue(row.id===this.options.id&&row.owner_user_id===owner&&/^[1-9][0-9]*$/.test(row.revision),'invalid-server-identity');
    fromProjectRow(row);this.revision=row.revision;
  }
  save(project: LocalProject): Promise<void> {
    if(this.options.enabled!==true)return Promise.resolve();
    const snapshot=clone(project);this.pending=snapshot;
    const work=this.tail.then(async()=>{
      requireValue(this.status!=='blocked','resolve-before-retry');this.status='saving';
      try {this.backup();const owner=await this.identity(),content=toProjectContent(snapshot);
        const previous=this.revision;
        const row=previous?await this.options.port.update(this.options.id,owner,previous,content):await this.options.port.insert({...content,id:this.options.id,owner_user_id:owner});
        requireValue(row,'revision-conflict');this.accept(row,owner);
        requireValue(!previous||BigInt(row.revision)===BigInt(previous)+BigInt(1),'invalid-revision');
        if(this.pending===snapshot)this.pending=undefined;this.status='saved';
      } catch {this.status='blocked';throw new Error('save-blocked-local-preserved');}
    });this.tail=work.catch(()=>{});return work;
  }
  async load(): Promise<LocalProject|null> {
    requireValue(this.options.enabled===true,'cloud-save-disabled');
    await this.tail;this.backup();const owner=await this.identity();const row=await this.options.port.get(this.options.id,owner);
    if(!row)return null; // Caller must never replace a local draft with an empty server result.
    // Existing local state is never overwritten automatically. Explicit reconciliation required.
    return fromProjectRow((this.acceptRead(row,owner)));
  }
  private acceptRead(row: ProjectRow,owner: string) {
    requireValue(row.id===this.options.id&&row.owner_user_id===owner,'invalid-server-identity');return row;
  }
  async resumeFromReviewedServer(row: ProjectRow): Promise<void> {
    await this.tail;this.backup();this.accept(row,await this.identity());this.status='idle';
  }
  pendingDraft() {return this.pending?clone(this.pending):null;}
}

