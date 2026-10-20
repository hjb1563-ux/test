export const REF = 'istsrambmbzuemkgutgh';
export const URL = `https://${REF}.supabase.co`;
export const TEST_ORIGIN = 'https://visitor-integration.invalid';
export const LIMITS = Object.freeze({ maxDayRows:1, maxVisitors:2, maxHashes:2, maxNewCount:2, maxPosts:5 });
export const dayAt = now => new Date(now.getTime()+9*3600000).toISOString().slice(0,10);
export function localContext(env, ref) {
  if (ref !== REF) throw new Error('wrong-project');
  if (env.NODE_ENV === 'production' || env.VERCEL || env.VERCEL_ENV || env.CI) throw new Error('local-only');
}
export function validateApproval(a,{env,ref,now,sourcesSha256}) {
  localContext(env,ref);
  if (env.BATH_VISITOR_LIVE_TEST_APPROVED !== REF) throw new Error('explicit-approval-required');
  if (!a || a.version !== 1 || a.approved !== true || a.operation !== 'visitor-live-A-B' || a.projectRef !== REF || a.exclusiveWindowConfirmed !== true) throw new Error('invalid-approval');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(a.runId || '')) throw new Error('invalid-run-id');
  if (a.sourcesSha256 !== sourcesSha256 || !/^[0-9a-f]{64}$/.test(sourcesSha256)) throw new Error('source-version-mismatch');
  const expires = Date.parse(a.expiresAt);
  if (!Number.isFinite(expires) || expires <= now.getTime() || expires > now.getTime()+3600000) throw new Error('approval-expired-or-too-long');
  for (const [k,v] of Object.entries(LIMITS)) if(a[k] !== v) throw new Error('wrong-limits');
  checkDay(a,now);
}
export function checkDay(a,now) {
  if (a.day !== dayAt(now)) throw new Error('day-changed');
  const seoul = new Date(now.getTime()+9*3600000);
  if (seoul.getUTCHours() === 23 && seoul.getUTCMinutes() >= 55) throw new Error('midnight-window');
  if (Date.parse(a.expiresAt) <= now.getTime()) throw new Error('approval-expired');
}
export function checkProject(p) {
  if (!p || (p.ref ?? p.id) !== REF || p.name !== 'bath-designer-dev' || p.status !== 'ACTIVE_HEALTHY' || p.database?.host !== `db.${REF}.supabase.co`) throw new Error('project-identity-mismatch');
}
export function checkAudit(a,day,expectedHashes=[]) {
  if (!a || a.day !== day || a.database !== 'postgres' || a.migration !== true || a.rls !== true || a.functions !== true) throw new Error('schema-or-day-mismatch');
  const n=expectedHashes.length;
  if (a.days_rows !== (n ? 1 : 0) || a.visits_rows !== n || a.total !== n || a.other_days !== 0 || !Array.isArray(a.hashes) || JSON.stringify([...a.hashes].sort()) !== JSON.stringify([...expectedHashes].sort())) throw new Error('unexpected-db-state');
}
// No network primitives here: the CLI supplies a bounded transport after all local checks.
export async function runScenario({approval,env,clock,sourcesSha256,shared,ids,cookieSecret,secretKey,lookupProject,audit,request,writeJournal}) {
  validateApproval(approval,{env,ref:REF,now:clock(),sourcesSha256});
  if (!ids || Object.keys(ids).sort().join(',') !== 'A,B' || !/^[a-f0-9]{64}$/.test(ids.A) || !/^[a-f0-9]{64}$/.test(ids.B) || ids.A===ids.B) throw new Error('two-distinct-identities-required');
  if (!/^[a-f0-9]{64}$/.test(cookieSecret) || !/^sb_secret_[A-Za-z0-9_-]+$/.test(secretKey)) throw new Error('invalid-credentials');
  await checkProject(await lookupProject());
  const hashes={A:shared.visitorHash(cookieSecret,approval.day,ids.A),B:shared.visitorHash(cookieSecret,approval.day,ids.B)};
  if (hashes.A===hashes.B) throw new Error('hash-collision');
  const seen=new Set(),journal={version:1,runId:approval.runId,projectRef:REF,day:approval.day,sourcesSha256,status:'preparing',attempts:[],checks:[]};
  let stopped=false,posts=0;
  await checkAudit(await audit(),approval.day,[]);
  await writeJournal(journal); // Must succeed before even read-only core bootstrap.
  const save=async()=>writeJournal(structuredClone(journal));
  const guarded=async(url,o)=>{
    if(stopped)throw new Error('execution-stopped');
    try {
      validateApproval(approval,{env,ref:REF,now:clock(),sourcesSha256});
      const u=new globalThis.URL(url);
      if(u.origin!==URL || o.redirect!=='error' || o.headers.apikey!==secretKey || o.headers.Authorization)throw new Error('transport-target-mismatch');
      if(o.method==='GET') {
        if(u.pathname!=='/rest/v1/rpc/bath_visitor_today' || u.search!==`?p_day=${approval.day}` || o.body!==undefined)throw new Error('read-not-allowed');
        return await request(url,o);
      }
      if(o.method!=='POST'||u.pathname!=='/rest/v1/rpc/bath_visitor_register'||u.search)throw new Error('write-not-allowed');
      const body=JSON.parse(o.body),keys=Object.keys(body).sort().join(',');
      const actor=Object.entries(hashes).find(([,hash])=>hash===body.p_hash)?.[0];
      if(keys!=='p_day,p_hash'||body.p_day!==approval.day||!actor)throw new Error('hash-or-day-not-reserved');
      if(posts>=LIMITS.maxPosts)throw new Error('post-budget-exceeded');
      await checkAudit(await audit(),approval.day,[...seen]);
      validateApproval(approval,{env,ref:REF,now:clock(),sourcesSha256});
      const attempt={sequence:++posts,actor,status:'intent'};journal.attempts.push(attempt);journal.status='running';await save();
      const response=await request(url,o);
      if(!response.ok)throw new Error('register-rejected');
      const row=await response.clone().json(),next=new Set([...seen,body.p_hash]);
      if(row.date!==approval.day||row.count!==next.size||next.size>2)throw new Error('register-result-mismatch');
      await checkAudit(await audit(),approval.day,[...next]);
      seen.add(body.p_hash);attempt.status='confirmed';attempt.httpStatus=response.status;attempt.count=row.count;await save();
      return response;
    }catch{
      stopped=true;journal.status='stopped';
      const pending=journal.attempts.at(-1);if(pending?.status==='intent')pending.status='unknown';
      try{await save()}catch{} // Never continue registration after journal failure.
      throw new Error('integration-stopped-review-journal');
    }
  };
  const rpc=shared.createVisitorRpc({secretKey,cookieSecret,request:guarded});
  const processor=actor=>shared.createVisitorProcessor({origin:TEST_ORIGIN,cookieSecret,rpc,now:clock,randomId:()=>ids[actor]});
  const req=(method,cookie)=>new Request(TEST_ORIGIN+(method==='GET'?'/api/visitors':'/api/visitors/visit'),{method,headers:{Origin:TEST_ORIGIN,'X-Bath-Visit':'1',...(cookie?{Cookie:cookie}:{})}});
  const record=async(name,value,expected)=>{if(stopped||value.count!==expected||value.date!==approval.day)throw new Error('step-failed');journal.checks.push({name,count:value.count});await save()};
  try{
    const a=processor('A'),b=processor('B');const bootstrap=await a.get(req('GET'));
    if(bootstrap.status!==200)throw new Error('bootstrap-failed');
    const cookieA=bootstrap.headers.get('set-cookie')?.split(';')[0];if(!cookieA)throw new Error('missing-cookie');
    await record('A-RPC-first',await rpc('bath_visitor_register',approval.day,ids.A),1);
    await record('A-RPC-repeat',await rpc('bath_visitor_register',approval.day,ids.A),1);
    const repeat=await a.post(req('POST',cookieA));if(repeat.status!==200)throw new Error('core-failed');await record('B-core-A-repeat',await repeat.json(),1);
    const bootB=await b.get(req('GET'));if(bootB.status!==200)throw new Error('bootstrap-failed');const cookieB=bootB.headers.get('set-cookie')?.split(';')[0];if(!cookieB||cookieB===cookieA)throw new Error('identity-not-distinct');
    const second=await b.post(req('POST',cookieB));if(second.status!==200)throw new Error('core-failed');await record('B-core-B-first',await second.json(),2);
    await record('A-RPC-B-repeat',await rpc('bath_visitor_register',approval.day,ids.B),2);
    await record('GET-final',await rpc('bath_visitor_today',approval.day),2);
    const before=posts;
    const badOrigin=new Request(TEST_ORIGIN+'/api/visitors/visit',{method:'POST',headers:{Origin:'https://wrong.invalid','X-Bath-Visit':'1',Cookie:cookieA}});
    if((await a.post(badOrigin)).status!==403 || (await a.post(req('POST',cookieA.slice(0,-1)+'z'))).status!==428 || posts!==before)throw new Error('negative-core-failed');
    await checkAudit(await audit(),approval.day,[...seen]);journal.status='complete';await save();
    return {status:'complete',projectRef:REF,day:approval.day,daysRows:1,visitsRows:2,count:2,registrationRequests:posts,checks:journal.checks,C:'not-executed'};
  }catch{
    stopped=true;journal.status='stopped';try{await save()}catch{};throw new Error('integration-stopped-review-journal');
  }
}
