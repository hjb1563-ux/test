// Disposable browser profiles; no real analytics, auth, DB or user data.
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(require('os').tmpdir(), 'bath-cloudflare-browser-tests/node_modules/playwright-core'));
const base = process.env.BUILDER_TEST_URL || 'http://127.0.0.1:3257';
const key = 'bath-designer-selections-v2', active = 'bath-designer-active-project-v1';
assert.equal(new URL(base).hostname, '127.0.0.1');
(async () => {
 const browser = await chromium.launch({ channel: 'chrome', headless: true });
 try {
  for (const width of [390, 1440]) {
   const context = await browser.newContext({ viewport: { width, height: 900 }, acceptDownloads: true });
   await context.addInitScript(() => {
    window.projectWrites=0; window.projectRemovals=0;
    const set=Storage.prototype.setItem,remove=Storage.prototype.removeItem;
    Storage.prototype.setItem=function(key,value){if(this===localStorage&&key==='bath-designer-selections-v2')window.projectWrites++;return set.call(this,key,value);};
    Storage.prototype.removeItem=function(key){if(this===localStorage&&key==='bath-designer-selections-v2')window.projectRemovals++;return remove.call(this,key);};
   });
   await context.route('**/*', r => new URL(r.request().url()).origin === base ? r.continue() : r.abort());
   const page = await context.newPage(); page.setDefaultTimeout(12000);
   page.on('dialog', async d => { await d.dismiss(); throw new Error('Unexpected confirmation'); });
   const errors = []; page.on('pageerror', e => errors.push(e.message));
   const raw = () => page.evaluate(k => localStorage.getItem(k), key);
   const fixture = mode => ({ version: 3, current: 6, projectInfo: { builderMode: mode, projectName: '보존 테스트', propertyType: '아파트', budget: 10000000, customInfo: 'keep' }, values: { partitionShower: 'half-partition', bathtub: 'bath-standard', sink: 'top-bowl', accessoryOther: '직접 입력', showerFaucet: ['rain'] }, imageHistoryOrder: ['sink:top-bowl','showerFaucet:rain','partitionShower:half-partition','bathtub:bath-standard'], memo: '상담서 메모', specialNotes: '특이사항', checks: { sink: '확인' }, extension: { keep: true } });
   async function seed(value) {
    await page.goto(base);
    await page.evaluate(({ key, active, value }) => { sessionStorage.removeItem(active); sessionStorage.setItem('bath-designer-style-draft-v1:unrelated','keep'); if(value === null) localStorage.removeItem(key); else localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value)); localStorage.setItem('unrelated-data','keep'); localStorage.setItem('bath-designer-other-project-fixture','other-project'); localStorage.setItem('bath-designer-admin-ui-fixture','admin-ui'); }, { key, active, value });
    await page.goto(base + '/design');
   }
   await seed(null); await page.locator('#style-preview-title').waitFor(); assert.equal(await raw(), null);
   await page.reload(); await page.locator('#style-preview-title').waitFor(); assert.equal(await raw(), null);
   await seed({}); await page.locator('#style-preview-title').waitFor(); assert.equal(await raw(), '{}');
   await seed({ version:3,current:0,values:{},projectInfo:{builderMode:'consumer'},memo:'',specialNotes:'' }); await page.locator('#style-preview-title').waitFor();
   for(const mode of ['consumer','professional']) {
    const f = fixture(mode); await seed(f);
    const choice = page.getByRole('heading',{name:'이전에 만들던 욕실이 있어요'}); await choice.waitFor();
    assert.equal(await page.locator('progress').count(),0); assert.equal(await raw(),JSON.stringify(f));
    assert.equal(await page.evaluate(()=>window.projectWrites),0,'entry inspection must never write, even identical bytes');
    assert.equal(await choice.evaluate(el => el === document.activeElement), true);
    assert.match(await page.locator('.projectEntryStep').innerText(),mode === 'consumer' ? /STEP 07/ : /STEP 08/);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({path:`verification/project-entry-${width}-${mode}.png`,fullPage:true});
    await page.keyboard.press('Tab'); assert.equal(await page.evaluate(()=>document.activeElement.textContent),'이어서 만들기');
    assert.equal(await page.getByText('저장된 내용을 이어서 만들거나, 새로 시작할 수 있어요.',{exact:true}).count(),0);
    assert.equal(await page.getByRole('button',{name:'새로 만들기',exact:true}).getAttribute('aria-describedby'),'project-new-help');
    await page.getByRole('button',{name:'이어서 만들기',exact:true}).dblclick(); await page.locator('progress').waitFor();
    assert.equal(await page.getByRole('button',{name:'욕실 스타일 미리보기',exact:true}).count(),0);
    const restored=JSON.parse(await raw());
    for(const k of ['memo','specialNotes','checks','extension','values'])assert.deepEqual(restored[k],f[k]);
    for(const [k,v] of Object.entries(f.projectInfo))assert.deepEqual(restored.projectInfo[k],v);
    assert.deepEqual(restored.imageHistoryOrder,f.imageHistoryOrder.filter(id=>!id.startsWith('bathtub:')));
    assert.equal(restored.current,mode === 'consumer' ? 8 : 7); assert.equal(await page.locator('#builder-bathtub-content').count(),0);
    const saved = await raw(); await page.reload(); await page.locator('progress').waitFor(); assert.equal(await raw(), saved);
    await page.goto(base); await page.goBack(); await page.locator('progress').waitFor(); await page.goForward(); await page.goBack(); await page.locator('progress').waitFor();
    await page.goto(base+'/result'); await page.locator('.consultationSheet').waitFor(); assert.equal(await page.locator('#consultation-memo').inputValue(),f.memo);
    await page.locator('#consultation-memo').fill('수정 메모');
    await page.waitForFunction(k => JSON.parse(localStorage.getItem(k)).memo === '수정 메모',key);
    await page.goto(base+'/design'); await page.locator('progress').waitFor();
    await page.evaluate(a=>sessionStorage.removeItem(a),active); await page.reload(); await choice.waitFor();
    await page.goto(base+'/design?step=7&returnTo=consultation'); await page.locator('progress').waitFor(); assert.equal(await page.locator('.projectEntry').count(),0);
    await page.goto(base+'/design?tile=white'); await page.locator('progress').waitFor(); assert.equal(JSON.parse(await raw()).values.tile,'white');
   }
   const firstStep = {...fixture('consumer'), current:0}; await seed(firstStep);
   await page.getByRole('button',{name:'이어서 만들기',exact:true}).dblclick(); await page.locator('progress').waitFor(); assert.deepEqual(JSON.parse(await raw()).values,firstStep.values);
   await seed({version:2,current:16,projectInfo:{builderMode:'professional',projectName:'구버전'},values:{partition:'half-partition',bathtub:'bath-standard'},memo:'구버전 메모'});
   await page.getByRole('heading',{name:'이전에 만들던 욕실이 있어요'}).waitFor();
   await page.goto(base+'/design?step=17'); await page.locator('progress').waitFor();
   assert.equal(await page.locator('.projectEntry').count(),0); assert.equal(JSON.parse(await raw()).current,14); assert.equal(JSON.parse(await raw()).memo,'구버전 메모'); assert.equal(JSON.parse(await raw()).values.bathtub,'bath-standard');
   await seed({version:3,memo:'메모만'}); await page.locator('.projectEntry').waitFor(); assert.equal(await page.locator('.projectEntryStep').count(),0);
   const f=fixture('consumer'); await seed(f);
   await page.evaluate(()=>{const remove=Storage.prototype.removeItem;window.restoreRemove=()=>Storage.prototype.removeItem=remove;Storage.prototype.removeItem=function(k){if(k==='bath-designer-selections-v2')throw new Error('blocked');return remove.call(this,k);};});
   await page.getByRole('button',{name:'새로 만들기',exact:true}).click(); await page.locator('.projectEntry [role=alert]').waitFor(); assert.equal(await raw(),JSON.stringify(f)); assert.equal(await page.evaluate(()=>window.projectWrites),0); await page.getByRole('heading',{name:'이전에 만들던 욕실이 있어요'}).waitFor();
   await page.evaluate(()=>window.restoreRemove()); await page.getByRole('button',{name:'새로 만들기',exact:true}).dblclick(); await page.locator('#style-preview-title').waitFor(); assert.equal(await raw(),null); assert.equal(await page.evaluate(()=>localStorage.getItem('unrelated-data')),'keep');
   assert.deepEqual(await page.evaluate(()=>[localStorage.getItem('bath-designer-other-project-fixture'),localStorage.getItem('bath-designer-admin-ui-fixture')]),['other-project','admin-ui']);
   assert.equal(await page.getByRole('heading',{name:'새로 만들까요?',exact:true}).count(),0);
   assert.equal(await page.getByRole('dialog').count(),0);
   assert.equal(await page.evaluate(()=>window.projectRemovals),1,'rapid double click removes the base project exactly once');
   assert.equal(await page.evaluate(()=>sessionStorage.getItem('bath-designer-style-draft-v1:unrelated')),'keep');
   await page.getByRole('button',{name:'프로젝트 정보 입력하기',exact:true}).click(); await page.locator('#project-name').fill('새 작업'); await page.getByRole('button',{name:'욕실 만들기 시작',exact:true}).click(); await page.locator('progress').waitFor(); await page.waitForFunction(k=>JSON.parse(localStorage.getItem(k)).projectInfo.projectName==='새 작업',key); assert.equal(JSON.parse(await raw()).memo,'');
   for(const corrupt of ['{broken', 'null', '[]', '{"values":42}', '{"current":999}']) {
    await seed(corrupt); await page.getByRole('heading',{name:'저장된 내용을 불러오지 못했어요'}).waitFor(); assert.equal(await raw(),corrupt);
    assert.equal(await page.evaluate(()=>window.projectWrites),0); assert.equal(await page.evaluate(()=>window.projectRemovals),0);
    await page.getByRole('button',{name:'다시 불러오기'}).click(); await page.locator('.projectEntry').waitFor(); assert.equal(await raw(),corrupt);
    const download = page.waitForEvent('download'); await page.getByRole('button',{name:'저장 원본 내보내기'}).click(); assert.equal((await download).suggestedFilename(),'bath-designer-backup.json'); assert.equal(await raw(),corrupt);
   }
   await page.evaluate(()=>{const get=Storage.prototype.getItem;window.restoreGet=()=>Storage.prototype.getItem=get;Storage.prototype.getItem=function(k){if(k==='bath-designer-selections-v2')throw new Error('blocked');return get.call(this,k);};});
   await page.getByRole('button',{name:'다시 불러오기'}).click(); await page.getByRole('heading',{name:'저장된 내용을 불러오지 못했어요'}).waitFor(); await page.evaluate(()=>window.restoreGet()); assert.equal(await raw(),'{"current":999}');
   assert.deepEqual(errors,[]); await context.close(); console.log('PASS entry lifecycle, preservation, reset, errors, focus and history at width '+width);
  }
 } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
