import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const files=[];function walk(root){for(const e of fs.readdirSync(root,{withFileTypes:true})){const p=path.join(root,e.name);if(e.isDirectory())walk(p);else files.push(p)}}walk('.next');
const chunks=files.filter(f=>f.startsWith(path.join('.next','static')+path.sep)&&/\.(js|map)$/.test(f));
const forbidden=['tests/visitor-live','tests\\visitor-live','BATH_VISITOR_LIVE_TEST_APPROVED','BATH_TEST_MANAGEMENT_TOKEN','BATH_TEST_ADMIN_KEY','exclusiveWindowConfirmed'];
for(const f of chunks){const s=fs.readFileSync(f,'utf8');for(const word of [...forbidden,'SUPABASE_SECRET_KEY','VISITOR_COOKIE_SECRET'])assert.ok(!s.includes(word),'client exposure: '+f);assert.ok(!/sb_secret_[A-Za-z0-9_-]{15,}|sbp_[A-Za-z0-9]{20,}/.test(s),'secret pattern: '+f)}
const traces=files.filter(f=>f.endsWith('.nft.json'));assert.ok(traces.length>0);
for(const f of traces){const trace=JSON.parse(fs.readFileSync(f,'utf8'));for(const entry of trace.files??[]){const p=entry.replaceAll('\\','/');assert.ok(!p.includes('visitor-live')&&!p.includes('tests/artifacts')&&!/credentials.*env|approval\.json|\.recovery\.dpapi|\.journal\.json/.test(p),'trace includes local test resource: '+f)}}
const functions=files.filter(f=>f.includes(path.join('server','app'))&&f.endsWith('.js'));for(const f of functions){const s=fs.readFileSync(f,'utf8');for(const word of forbidden)assert.ok(!s.includes(word),'server bundle includes runner: '+f)}
const exclusions=fs.readFileSync('.vercelignore','utf8');for(const entry of ['tests/visitor-live/','tests/visitor-live-safety.test.mjs','tests/artifacts/','.env*'])assert.ok(exclusions.includes(entry),'missing exclusion');
console.log(JSON.stringify({clientFiles:chunks.length,traces:traces.length,serverAppBundles:functions.length,runnerOrCredentialMatches:0,vercelIgnore:'PASS',scope:'local Next build/traces; no Vercel deployment performed'}));
