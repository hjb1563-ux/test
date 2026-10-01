const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs/promises');const path=require('node:path');
const base=process.env.BUILDER_TEST_URL||'http://localhost:3000';
const output=path.join(require('node:os').tmpdir(),'bath-empty-selection');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 const context=await browser.newContext();const page=await context.newPage();const errors=[];
 page.on('pageerror',e=>errors.push({url:page.url(),message:e.message,stack:e.stack}));page.on('console',m=>{if(m.type()==='error'&&/hydration|duplicate|unique.*key|undefined/i.test(m.text()))errors.push(m.text());});
 await fs.mkdir(output,{recursive:true});await page.goto(base+'/design');
 const key='bath-designer-selections-v2';
 async function seed(current,values={},version=3){await page.evaluate(({key,current,values,version})=>localStorage.setItem(key,JSON.stringify({current,values,version})),{key,current,values,version});await page.goto(base+'/design');await page.waitForFunction(({current,version})=>document.querySelector('progress')?.value===(version===3||current<5?current+1:current),{current,version});await page.locator('.progressHeading').getByText('자동 저장됨').waitFor();}
 const saved=()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
 async function noOverflow(label){assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1),label);}
 const group=k=>page.locator(`.choiceGroup:has(#builder-${k}-content)`);
 async function open(k){const g=group(k);if(await g.getAttribute('data-open')==='false'&&await page.locator(`#builder-${k}-toggle`).isVisible())await page.locator(`#builder-${k}-toggle`).click();return g;}
 try{
 await page.setViewportSize({width:1440,height:1000});await seed(1);
 assert.equal(await page.locator('.choiceGroup').count(),3);assert.equal(await group('jendai').getByRole('checkbox').count(),4);
 assert.equal(await group('partitionShower').getByRole('radio').count(),5);
 await group('partitionShower').getByRole('radio',{name:'하프 파티션',exact:true}).click();await group('partitionShower').getByRole('radio',{name:'도어형 샤워부스',exact:true}).click();assert.equal((await saved()).values.partitionShower,'door-booth');
 assert.equal(await group('partitionShower').locator('[aria-checked=true]').count(),1);
 await seed(4);await group('sink').getByRole('radio',{name:'탑볼 세면대',exact:true}).click();await group('toilet').getByRole('radio',{name:'원피스',exact:true}).click();assert.equal((await saved()).values.sink,'top-bowl');assert.equal((await saved()).values.toilet,'one-piece');
 await group('sink').getByRole('radio',{name:'기타',exact:true}).click();await page.locator('#builder-sink-other').fill('낮은 세면대');await group('toilet').getByRole('radio',{name:'기타',exact:true}).click();await page.locator('#builder-toilet-other').fill('원하는 변기');await page.reload();assert.equal(await page.locator('#builder-sink-other').inputValue(),'낮은 세면대');assert.equal(await page.locator('#builder-toilet-other').inputValue(),'원하는 변기');
 await seed(12);const input=page.locator('#builder-accessory-other');const draft='휴지걸이, 수건걸이, 코너 선반';await input.fill(draft);await page.reload();assert.equal(await input.inputValue(),draft);assert.equal(await group('accessory').getByRole('radio').count(),0);assert.equal(await input.getAttribute('type'),'text');assert.equal(await input.getAttribute('placeholder'),'(ex : 휴지걸이, 수건걸이, 코너 선반· ·)');await input.fill('   ');assert.equal(await page.locator('.summaryRow').filter({hasText:'액세서리 종류'}).locator('b').innerText(),'미정');await input.fill(draft);
 await seed(16,{partition:'half-partition',showerBooth:'door-booth',jendai:['new','sink-ledger'],concealed:['concealed-basin'],window:'yes',accessory:['paper-holder'],sink:'top-bowl',toilet:'one-piece',accessoryOther:draft},2);
 assert.equal((await saved()).current,15);assert.equal((await saved()).values.partitionShower,'half-partition');assert.equal((await saved()).values.window,undefined);assert.equal(await page.locator('.reviewCategory').count(),15);assert.ok((await page.locator('.finalCheck').innerText()).includes(draft));
 await page.getByRole('link',{name:'욕실 리모델링 상담서 보기',exact:true}).click();await page.locator('.sheetStep').first().waitFor();assert.equal(await page.locator('.sheetStep').count(),15);assert.ok((await page.locator('.sheetSelections').innerText()).includes('세면대 & 변기'));assert.ok(!/욕실 창문|매립 설비|세면대 젠다이/.test(await page.locator('.sheetSelections').innerText()));
 await page.emulateMedia({media:'print'});await page.pdf({path:path.join(output,'consultation.pdf'),format:'A4',printBackground:true});await page.emulateMedia({media:'screen'});
 for(const [width,height] of [[1920,1080],[1440,900],[430,932],[390,844],[375,812]]){
  await page.setViewportSize({width,height});
  for(let current=0;current<16;current++){
   await seed(current,{accessoryOther:draft.repeat(8),sink:'other',sinkOther:'기타 세면대',toilet:'other',toiletOther:'기타 변기'});
   await noOverflow(`${width} STEP ${current+1}`);assert.equal(await page.getByRole('radio',{name:/모르겠|^미정$/}).count(),0);assert.equal(await page.getByRole('checkbox',{name:/모르겠|^미정$/}).count(),0);assert.equal(await page.locator('progress').getAttribute('max'),'16');
   if([4,12].includes(current)){for(const k of current===4?['sink','toilet']:['accessoryFinish','accessory']){await open(k);await noOverflow(`${width} ${k}`);}}
   if(current===12){const box=await input.boundingBox();assert.ok(box.height>=44&&box.height<=52);await input.fill('');assert.equal(await group('accessory').locator('textarea').count(),0);}
   if([1,4,8,12,15].includes(current))await page.screenshot({path:path.join(output,`${width}-step${current+1}.png`),fullPage:true});
  }
  await page.goto(base+'/result');await page.locator('.sheetStep').first().waitFor();await noOverflow(`${width} report`);
  console.log(`PASS ${width}px: all 16 steps + report, no overflow`);
 }
 await page.setViewportSize({width:390,height:844});await seed(4);await group('sink').getByRole('radio',{name:'일반 세면대',exact:true}).click();assert.equal(await group('toilet').getAttribute('data-open'),'true');await group('toilet').getByRole('radio',{name:'원피스',exact:true}).click();assert.equal((await saved()).values.sink,'vanity-basin');
 // Empty navigation, legacy unknown state, section counts, and review edit links.
 await page.setViewportSize({width:1440,height:900});await seed(0);
 for(let step=1;step<=15;step++){
  assert.equal(await page.locator('.builderChoiceCard[aria-checked=true]').count(),0);
  assert.equal(await page.locator('.selectedGallery img').count(),0);
  await page.locator('.navButtons').getByRole('button',{name:'다음',exact:true}).click();
  await page.waitForFunction(expected=>document.querySelector('progress').value===expected,step+1);
 }
 assert.ok((await page.locator('.consultationCounts').innerText()).includes('미결정'));assert.equal(await page.locator('.consultationCounts b').nth(0).innerText(),'0');assert.equal(await page.locator('.consultationCounts b').nth(1).innerText(),'25');
 await page.getByRole('button',{name:'세면대 & 변기 수정',exact:true}).click();assert.equal(await page.locator('.builderChoiceCard[aria-checked=true]').count(),0);
 await seed(15,{sink:'top-bowl',toilet:'notSure',lighting:['undecided'],bathroomCondition:['unknown-condition'],accessory:'아직 모르겠어요',showerFaucet:'shower'});
 assert.equal(await page.locator('.consultationCounts b').nth(0).innerText(),'2');assert.equal(await page.locator('.consultationCounts b').nth(1).innerText(),'23');assert.ok(!/모르겠/.test(await page.locator('.finalCheck').innerText()));
 await page.getByRole('link',{name:'욕실 리모델링 상담서 보기',exact:true}).click();await page.locator('.sheetStep').first().waitFor();assert.ok((await page.locator('.sheetSelections').innerText()).includes('일반 샤워&욕조 수전'));assert.ok((await page.locator('.sheetSelections').innerText()).includes('미정'));assert.ok(!/모르겠/.test(await page.locator('.sheetSelections').innerText()));
 await context.grantPermissions(['clipboard-read','clipboard-write']);await page.getByRole('button',{name:'선택 내용 복사',exact:true}).click();const copied=await page.evaluate(()=>navigator.clipboard.readText());assert.ok(copied.includes('샤워 수전: 일반 샤워&욕조 수전'));assert.ok(copied.includes('변기: 미정'));assert.ok(!/모르겠/.test(copied));
 await page.emulateMedia({media:'print'});await page.pdf({path:path.join(output,'missing-consultation.pdf'),format:'A4',printBackground:true});await page.emulateMedia({media:'screen'});
 for(const [id,label] of [['shower','일반 샤워&욕조 수전'],['concealed-shower','매립 샤워&욕조 수전']]){
  await seed(8,{showerFaucet:id});assert.equal(await group('showerFaucet').getByRole('radio',{name:label,exact:true}).getAttribute('aria-checked'),'true');
  const img=page.locator('.selectedHeroImage img');assert.ok(await img.evaluate(img=>img.complete&&img.naturalWidth>0));assert.ok((await page.locator('.summary').innerText()).includes(label));
 }
 await page.goto(base+'/guide');assert.equal(await page.locator('.guideCardPro').count(),17);
 assert.deepEqual(errors,[]);console.log('PASS browser interactions, refresh, legacy storage, mobile accordion, print/PDF, 17 guide categories, no runtime/hydration/key errors');console.log(output);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
