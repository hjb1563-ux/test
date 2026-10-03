const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.BUILDER_TEST_URL||'http://localhost:3111';
const key='bath-designer-selections-v2';
(async()=>{
 const browser=await chromium.launch({...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{channel:'chrome'}),headless:true});
 const context=await browser.newContext({hasTouch:true});
 await context.route('https://fonts.googleapis.com/**',r=>r.abort());await context.route('https://fonts.gstatic.com/**',r=>r.abort());
 const errors=[];const imageErrors=[];
 let page;
 async function newPage(width,height){
  if(page)await page.close();page=await context.newPage();page.setDefaultTimeout(12000);await page.setViewportSize({width,height});
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/hydration|duplicate|unique.*key/i.test(m.text()))errors.push(m.text());});
  page.on('response',r=>{if(r.url().includes('/images/bathroom-builder/')&&r.status()>=400)imageErrors.push(r.url());});
  await page.goto(base+'/design',{waitUntil:'domcontentloaded'});
  await page.locator('.progressHeading').getByText('자동 저장됨').waitFor();
 }
 const saved=()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
 const group=name=>page.locator(`.choiceGroup:has(#builder-${name}-content)`);
 async function seed(current,values={waterproofing:'coating-waterproofing',showerFaucet:'rain'}){
  await page.evaluate(({key,current,values})=>localStorage.setItem(key,JSON.stringify({version:3,current,values,specialNotes:'특이사항 유지',memo:'업체 메모 유지',checks:{waterproofing:'기존 체크'},imageHistoryOrder:['showerFaucet:rain','waterproofing:coating-waterproofing']})),{key,current,values});
  await page.goto(base+'/result',{waitUntil:'domcontentloaded'});await page.locator('.sheetStep').first().waitFor();
 }
 async function edit(title,index){await page.getByRole('button',{name:title+' 수정',exact:true}).click();await page.locator('.builderConsultationEdit').waitFor();await page.waitForFunction(index=>document.querySelector('progress')?.value===index+1,index);assert.ok(page.url().includes('returnTo=consultation'));assert.equal(await page.locator('.selectedHeroImage').count(),0);}
 async function choose(key,label){const section=group(key),toggle=section.locator('.builderSectionToggle');if(await toggle.isVisible()&&await section.getAttribute('data-open')==='false')await toggle.click();await section.getByRole(key==='showerFaucet'?'checkbox':'radio',{name:label,exact:true}).click();}
 async function openPreview(){for(const selector of ['.builderPreviewPanel','.selectionHistory']){const section=page.locator(selector),toggle=section.locator('>.builderDisclosureToggle');if(await toggle.isVisible()&&await section.getAttribute('data-open')==='false')await toggle.click();}}
 async function back(){await page.getByRole('link',{name:'상담서로 돌아가기',exact:true}).click();await page.locator('.sheetStep').first().waitFor();assert.ok(new URL(page.url()).pathname==='/result');assert.ok(!page.url().includes('returnTo'));}
 async function overflow(){assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}
 try{
  for(const [width,height]of [[1920,1080],[1440,900],[1024,768],[430,932],[390,844],[375,812]]){
   await newPage(width,height);await seed(2);await edit('방수',2);
   assert.equal(await group('waterproofing').getByRole('radio',{name:'도막 방수',exact:true}).getAttribute('aria-checked'),'true');
   const returnBox=await page.getByRole('link',{name:'상담서로 돌아가기',exact:true}).boundingBox();assert.ok(returnBox.height>=44&&returnBox.x>=0&&returnBox.x+returnBox.width<=width+1);await overflow();
   if(width<768){const bottom=await page.locator('.mobileBuilderNav').boundingBox();assert.ok(returnBox.y+returnBox.height<bottom.y);assert.equal(await page.locator('.mobileBuilderNav').count(),1);}
   await choose('waterproofing','액방 + 도막');await openPreview();assert.equal(await page.locator('.selectedHeroLabel').textContent(),'액방 + 도막');
   const order=(await saved()).imageHistoryOrder;const nav=page.locator(width<768?'.mobileBuilderNav':'.navButtons');
   await nav.getByRole('button',{name:'다음',exact:true}).click();await page.waitForFunction(()=>document.querySelector('progress')?.value===4);assert.ok(page.url().includes('step=4'));assert.equal(await page.locator('.selectedHeroImage').count(),0);assert.equal(await page.getByRole('link',{name:'상담서로 돌아가기',exact:true}).count(),1);
   await page.reload({waitUntil:'domcontentloaded'});await page.locator('.builderConsultationEdit').waitFor();assert.equal(await page.locator('progress').getAttribute('value'),'4');
   await page.locator(width<768?'.mobileBuilderNav':'.navButtons').getByRole('button',{name:'이전',exact:true}).click();await page.waitForFunction(()=>document.querySelector('progress')?.value===3);await back();
   assert.ok((await page.locator('.sheetStep').nth(2).textContent()).includes('액방 + 도막'));assert.deepEqual((await saved()).imageHistoryOrder,order);assert.equal((await saved()).memo,'업체 메모 유지');assert.equal((await saved()).specialNotes,'특이사항 유지');
   await page.reload({waitUntil:'domcontentloaded'});await page.locator('.sheetStep').first().waitFor();assert.ok((await page.locator('.sheetStep').nth(2).textContent()).includes('액방 + 도막'));
   await edit('수전 & 샤워',8);assert.deepEqual((await saved()).values.showerFaucet,['rain']);
   assert.deepEqual(await group('showerFaucet').locator('[role=checkbox]').allTextContents(),['일반 샤워&욕조 수전','매립 샤워&욕조 수전','해바라기 샤워 수전','기타']);
   await choose('showerFaucet','해바라기 샤워 수전');await choose('showerFaucet','일반 샤워&욕조 수전');await choose('showerFaucet','해바라기 샤워 수전');await openPreview();
   assert.equal(await page.locator('.selectedHeroLabel').textContent(),'해바라기 샤워 수전');assert.equal((await page.locator('.selectionHistoryStrip strong').allTextContents())[0],'해바라기 샤워 수전');
   const image=page.locator('.selectedHeroImage img');assert.ok(decodeURIComponent(await image.getAttribute('src')).includes('해바라기 샤워 수전.png'));
   await image.evaluate(async img=>{if(!img.complete)await new Promise(r=>img.addEventListener('load',r,{once:true}));});assert.ok(await image.evaluate(img=>img.naturalWidth>0));
   await page.getByRole('button',{name:'해바라기 샤워 수전 이미지 크게 보기',exact:true}).tap();assert.equal(await page.locator('.historyPreviewButton[aria-pressed=true]').count(),1);await overflow();
   await back();assert.ok((await page.locator('.sheetStep').nth(8).textContent()).includes('해바라기 샤워 수전'));
   await edit('수전 & 샤워',8);await choose('showerFaucet','기타');await page.locator('#builder-showerFaucet-other').fill('벽부형 샤워 수전');assert.equal(await page.locator('.selectedHeroImage').count(),0);await back();assert.ok((await page.locator('.sheetStep').nth(8).textContent()).includes('기타 · 벽부형 샤워 수전'));
   await edit('줄눈',13);await choose('grout','에폭시 줄눈');await back();assert.ok((await page.locator('.sheetStep').nth(13).textContent()).includes('에폭시 줄눈'));
   await edit('줄눈',13);await choose('grout','에폭시 줄눈');await back();assert.ok((await page.locator('.sheetStep').nth(13).textContent()).includes('미정'));
   await page.goto(base+'/design',{waitUntil:'domcontentloaded'});await page.locator('.progressHeading').getByText('자동 저장됨').waitFor();assert.equal(await page.getByRole('link',{name:'상담서로 돌아가기',exact:true}).count(),0);
   console.log(`PASS ${width}×${height}: edit/return latest, previous/next+refresh context, rain image/order, other/empty, memo/history, overflow and touch target`);
  }
  await newPage(1440,900);await seed(15);
  const titles=await page.locator('.sheetStep h3').allTextContents();
  for(let i=0;i<titles.length;i++){const title=titles[i].replace(/^\s*\d+\s*/, '').trim();await edit(title,i);await back();}
  await page.goto(base+'/design?step=16',{waitUntil:'domcontentloaded'});await page.getByRole('button',{name:'방수 수정',exact:true}).click();await page.locator('.builderConsultationEdit').waitFor();assert.ok(page.url().includes('step=3'));await back();
  await edit('방수',2);page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'처음부터 다시 만들기',exact:true}).click();await page.waitForFunction(()=>document.querySelector('progress')?.value===1);assert.equal(await page.locator('.builderConsultationEdit').count(),0);assert.ok(!page.url().includes('returnTo'));await page.reload({waitUntil:'domcontentloaded'});assert.equal(await page.locator('.builderConsultationEdit').count(),0);
  await seed(8,{showerFaucet:'rain'});await context.grantPermissions(['clipboard-read','clipboard-write']);await page.getByRole('button',{name:'선택 내용 복사',exact:true}).click();assert.ok((await page.evaluate(()=>navigator.clipboard.readText())).includes('해바라기 샤워 수전'));
  await page.emulateMedia({media:'print'});assert.ok((await page.locator('.sheetStep').nth(8).textContent()).includes('해바라기 샤워 수전'));await page.pdf({path:require('node:path').join(require('node:os').tmpdir(),'bath-consultation-edit.pdf'),format:'A4'});
  assert.deepEqual(errors,[]);assert.deepEqual(imageErrors,[]);console.log('PASS all 15 category mappings, STEP16 edit, reset/normal entry, copy/Print/PDF, no hydration/runtime/image errors');
 }catch(e){console.error(e);throw e;}finally{await Promise.race([browser.close(),new Promise(r=>setTimeout(r,3000))]);}
})().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1);});
