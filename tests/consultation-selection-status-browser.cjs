const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {load}=require('./bathroom-style-draft.cjs'),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const c=load(path.resolve('data/bathroom-consultation.ts')),m=load(path.resolve('data/bathroom-builder-mode.ts')),d=load(path.resolve('data/bathroom-style-draft.ts'));
const ids=['essential-01','essential-02','balanced-01','balanced-02','balanced-03','premium-01','premium-02'];
const folder='tests/artifacts/consultation-selection-status';
(async()=>{fs.mkdirSync(folder,{recursive:true});const browser=await chromium.launch({channel:'chrome'});try{
for(const[width,height]of [[375,812],[390,844],[430,932],[768,1024],[1024,768],[1366,768],[1440,900],[1920,1080]]){
 if(process.env.STATUS_WIDTHS&&!process.env.STATUS_WIDTHS.split(',').includes(String(width)))continue;
 const context=await browser.newContext({viewport:{width,height},isMobile:width<768,hasTouch:width<768,permissions:['clipboard-read','clipboard-write']});await context.route('**/api/**',r=>r.abort());const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto((process.env.BUILDER_TEST_URL||'http://localhost:3120')+"/",{waitUntil:'domcontentloaded'});
 await page.evaluate(()=>localStorage.setItem('bath-designer-selections-v2','{"version":3,"memo":"preserve original"}'));const original=await page.evaluate(()=>localStorage.getItem('bath-designer-selections-v2'));
 for(const mode of ['consumer','professional'])for(const id of ids){
  const project=c.normalizeProject({projectInfo:{builderMode:mode},values:d.styleDraftValues(id,mode)}),expected=c.consultationOutputRows(project.values,mode);
  await page.evaluate(({id,project})=>sessionStorage.setItem('bath-designer-style-draft-v1:status',JSON.stringify({exampleId:id,project})),{id,project});
  await page.goto((process.env.BUILDER_TEST_URL||'http://localhost:3120')+"/result?styleDraft=status",{waitUntil:'domcontentloaded'});await page.locator('[data-style-draft-notice]').waitFor();
  assert.equal(await page.locator('.sheetStep').count(),mode==='consumer'?10:15);
  const actual=await page.locator('[data-selection-key]').evaluateAll(es=>es.map(e=>({key:e.dataset.selectionKey,status:e.dataset.selectionStatus,title:e.querySelector('dt').textContent,badge:e.querySelector('.sheetStatusBadge').textContent,value:e.querySelector('strong')?.textContent??null})));
  assert.deepEqual(actual,expected.map(r=>({key:r.key,status:r.status,title:r.title,badge:c.consultationStatusLabel(r.status),value:r.status==='selected'?r.displayLabel:null})));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.equal(await page.locator('.sheetStatusBadge').evaluateAll(es=>es.some(e=>e.scrollWidth>e.clientWidth)),false);
  assert.equal(await page.evaluate(()=>localStorage.getItem('bath-designer-selections-v2')),original);
  const stored=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('bath-designer-style-draft-v1:status')).project.values);assert.deepEqual(stored,project.values);
  if(id==='essential-01')await page.screenshot({path:`${folder}/${width}-${mode}.png`,fullPage:true});
  if(id==='premium-02'&&[390,1366].includes(width)){
   await page.getByRole('button',{name:'상담서 전체 텍스트 복사',exact:true}).click();const full=await page.evaluate(()=>navigator.clipboard.readText());for(const r of expected)assert.ok(full.includes(r.title+': '+r.displayLabel));assert.ok(full.includes('미선택'));
   await page.getByRole('button',{name:'공사 개요만 복사',exact:true}).click();const summary=await page.evaluate(()=>navigator.clipboard.readText());assert.ok(!summary.includes('미선택'));assert.ok(summary.includes('화이트'));
   await page.getByRole('button',{name:'상담서 전체 복사',exact:true}).click();await page.getByText('상담서 전체가 PNG 이미지로 복사되었습니다.',{exact:true}).waitFor({timeout:60000});
   const png=await page.evaluate(async()=>{const items=await navigator.clipboard.read();const blob=await items.find(i=>i.types.includes('image/png')).getType('image/png');return Array.from(new Uint8Array(await blob.arrayBuffer()));});fs.writeFileSync(`${folder}/${width}-${mode}-clipboard.png`,Buffer.from(png));
   await page.emulateMedia({media:'print'});await page.locator('[data-style-draft-notice]').waitFor();assert.equal(await page.locator('[data-selection-key]').count(),expected.length);await page.pdf({path:`${folder}/${width}-${mode}.pdf`,format:'A4',printBackground:true});await page.emulateMedia({media:'screen'});
  }
 }
 assert.deepEqual(errors,[]);console.log(`PASS ${width}: both modes / seven examples, full ordered rows and badges, responsive layout, unchanged selections/storage`);await context.close();
}
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
