// Storage edge cases in fresh, disposable Chrome contexts. No user profile,
// external analytics, Auth or DB calls. Only loopback responses are allowed.
const assert=require('node:assert/strict'),path=require('node:path'),os=require('node:os');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||path.join(os.tmpdir(),'bath-cloudflare-browser-tests/node_modules/playwright-core'));
const base=process.env.BUILDER_TEST_URL||'http://127.0.0.1:3257',key='bath-designer-selections-v2';
assert.equal(new URL(base).hostname,'127.0.0.1');

(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  for(const mobile of [false,true]){
   const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:900},isMobile:mobile,hasTouch:mobile});
   try{
    await context.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());
    const page=await context.newPage(),errors=[];page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push(e.name));
    const raw=()=>page.evaluate(k=>localStorage.getItem(k),key);
    const saved=async()=>JSON.parse(await raw());
    const content=p=>({values:p.values,projectInfo:p.projectInfo,memo:p.memo,specialNotes:p.specialNotes,imageHistoryOrder:p.imageHistoryOrder,checks:p.checks});
    const next=async()=>{
     const desktop=page.locator('.navButtons:visible');if(await desktop.count())return desktop.getByRole('button',{name:'다음',exact:true}).click();
     const nav=page.locator('.mobileBuilderNav:visible'),skip=nav.getByRole('button',{name:'현재 STEP 전체 건너뛰기',exact:true});
     if(await skip.isVisible())return skip.click();return nav.locator('button.button').click();
    };

    // No saved project: initialization is read-only until the user proceeds.
    await page.goto(base+'/design');await page.locator('#style-preview-title').waitFor();assert.equal(await raw(),null);
    await page.reload();await page.locator('#style-preview-title').waitFor();assert.equal(await raw(),null);

    const fixture={version:3,current:3,values:{demolition:'overlay',tile:'white',sink:'top-bowl',showerFaucet:[]},projectInfo:{builderMode:'consumer',projectName:'STORAGE_FIXTURE'},memo:'MEMO_STORAGE_FIXTURE',specialNotes:'NOTES_STORAGE_FIXTURE',imageHistoryOrder:['sink:top-bowl','tile:white','demolition:overlay']};
    await page.evaluate(({key,fixture})=>localStorage.setItem(key,JSON.stringify(fixture)),{key,fixture});
    await page.reload();await page.getByRole('button',{name:'이어서 만들기',exact:true}).click();await page.locator('progress').waitFor();
    const existing=await saved();assert.deepEqual(existing.values,fixture.values);assert.equal(existing.memo,fixture.memo);assert.equal(existing.specialNotes,fixture.specialNotes);assert.equal(existing.projectInfo.projectName,fixture.projectInfo.projectName);
    const expected=content(existing);
    await page.reload();await page.locator('progress').waitFor();assert.deepEqual(content(await saved()),expected);

    await page.locator('a[href="/"]').first().click();await page.waitForURL(base+'/');
    await page.goBack();await page.waitForURL(base+'/design');await page.locator('progress').waitFor();assert.deepEqual(content(await saved()),expected);
    await page.goForward();await page.waitForURL(base+'/');await page.goBack();await page.waitForURL(base+'/design');await page.locator('progress').waitFor();assert.deepEqual(content(await saved()),expected);

    const report=()=>page.locator('a[href^="/result"]:visible').first();
    for(let i=0;i<32&&!await report().count();i++)await next();
    assert.equal(await report().count(),1);await report().click();await page.locator('.consultationSheet').waitFor();
    assert.deepEqual(content(await saved()),expected);assert.equal(await page.locator('#consultation-memo').inputValue(),fixture.memo);assert.equal(await page.locator('#consultation-special-notes').inputValue(),fixture.specialNotes);
    const pdf=await page.pdf({format:'A4',printBackground:true});assert.equal(pdf.subarray(0,4).toString(),'%PDF');assert.ok(pdf.length>10000);assert.deepEqual(content(await saved()),expected);
    await page.reload();await page.locator('.consultationSheet').waitFor();assert.deepEqual(content(await saved()),expected);
    await page.goBack();await page.waitForURL(base+'/design');await page.locator('progress').waitFor();assert.deepEqual(content(await saved()),expected);
    await page.goForward();await page.locator('.consultationSheet').waitFor();assert.deepEqual(content(await saved()),expected);

    // Deliberately removed fixture data behaves like a new visit, without an
    // empty project being silently written over the removed key.
    await page.evaluate(k=>localStorage.removeItem(k),key);assert.equal(await raw(),null);
    await page.goto(base+'/design');await page.locator('#style-preview-title').waitFor();assert.equal(await raw(),null);
    await page.reload();await page.locator('#style-preview-title').waitFor();assert.equal(await raw(),null);

    // Corrupt JSON must remain recoverable, rather than be automatically erased.
    const corrupt='{invalid-storage-fixture';await page.evaluate(({key,corrupt})=>localStorage.setItem(key,corrupt),{key,corrupt});
    await page.reload();await page.getByRole('heading',{name:'저장된 내용을 불러오지 못했어요'}).waitFor();assert.equal(await raw(),corrupt);
    await page.getByRole('button',{name:'다시 불러오기'}).click();await page.locator('.projectEntry').waitFor();assert.equal(await raw(),corrupt);
    await page.reload();await page.locator('.projectEntry').waitFor();assert.equal(await raw(),corrupt);
    await page.getByRole('button',{name:'새로 만들기',exact:true}).click();await page.getByRole('button',{name:'취소',exact:true}).click();assert.equal(await raw(),corrupt);
    await page.getByRole('button',{name:'새로 만들기',exact:true}).click();await page.getByRole('button',{name:'삭제하고 새로 만들기'}).click();await page.locator('#style-preview-title').waitFor();assert.equal(await raw(),null);
    await page.getByRole('button',{name:'프로젝트 정보 입력하기',exact:true}).click();assert.equal(await page.locator('#project-name').inputValue(),'');
    assert.deepEqual(errors,[]);
    console.log(JSON.stringify({device:mobile?'mobile':'desktop',missing:true,validPreserved:true,refreshHistoryReportPreserved:true,deleted:true,corruptPreservedAndWarned:true,explicitResetOnly:true,pdfBytes:pdf.length,uncaughtErrors:0}));
   }finally{await context.close();}
  }
 }finally{await browser.close();}
})().catch(e=>{console.log(e.name+': '+e.message);process.exitCode=1});
