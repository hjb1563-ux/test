const assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.BUILDER_TEST_URL||'http://127.0.0.1:3259',key='bath-designer-selections-v2';
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  fs.mkdirSync('tests/artifacts/bathtub-skip-output',{recursive:true});
  for(const mode of ['consumer','professional'])for(const width of [1440,390]){
   const context=await browser.newContext({viewport:{width,height:900},permissions:['clipboard-read','clipboard-write']});
   try{
    const errors=[];await context.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());
    await require('./helpers/font-response-cache.cjs').install(context,errors);
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.name));
    await page.goto(base+'/');assert.equal(await page.locator('script[data-cf-beacon]').count(),0);
    await page.evaluate(({key,mode})=>localStorage.setItem(key,JSON.stringify({version:3,current:6,projectInfo:{builderMode:mode,projectName:'OUTPUT_FIXTURE'},values:{partitionShower:'full-partition',bathtub:'bath-standard',demolition:'full-demolition'},memo:'PRESERVE_OUTPUT_FIXTURE'})),{key,mode});
    await page.goto(base+'/result');const bath=page.locator('[data-selection-key="bathtub"]');await bath.waitFor();
    assert.equal(await bath.getAttribute('data-selection-status'),'excluded');assert.ok((await bath.innerText()).includes('선택 대상 제외'));
    const before=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);
    await page.getByRole('button',{name:'상담서 전체 텍스트 복사',exact:true}).click();
    await page.getByText('상담서 전체 텍스트를 복사했어요.',{exact:true}).waitFor();
    const text=await page.evaluate(()=>navigator.clipboard.readText());assert.ok(text.includes((await bath.locator('dt').innerText())+': 해당 없음 · 선택 대상 제외'));assert.ok(!text.includes('일반 욕조'));
    await page.getByRole('button',{name:'상담서 전체 복사',exact:true}).click();await page.getByText('상담서 전체가 PNG 이미지로 복사되었습니다.',{exact:true}).waitFor({timeout:60000});
    const png=await page.evaluate(async()=>{const item=(await navigator.clipboard.read()).find(i=>i.types.includes('image/png'));const blob=await item.getType('image/png');return Array.from(new Uint8Array(await blob.arrayBuffer()));});
    assert.ok(png.length>10000);const output='tests/artifacts/bathtub-skip-output/'+mode+'-'+width;fs.writeFileSync(output+'.png',Buffer.from(png));
    const pdf=await page.pdf({format:'A4',printBackground:true});assert.equal(pdf.subarray(0,4).toString(),'%PDF');assert.ok(pdf.length>10000);fs.writeFileSync(output+'.pdf',pdf);
    assert.deepEqual((await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key)).values,before.values);
    await page.goto(base+'/design?step=1');await page.locator('progress').waitFor();
    if(mode==='consumer'){
     const construction=page.locator('#builder-demolition-content');assert.ok((await construction.textContent()).includes('희망하는 방식을 선택해주세요.'));
     assert.deepEqual(await construction.getByRole('radio').allTextContents(),['덧방','올철거','부분철거']);
    }
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);assert.deepEqual(errors,[]);
    console.log(JSON.stringify({mode,width,excludedText:true,pngBytes:png.length,pdfBytes:pdf.length,storedBathtubPreserved:true,constructionUiPreserved:true}));
   }finally{await context.close();}
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
