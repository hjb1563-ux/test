const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.BUILDER_TEST_URL||'http://localhost:3111';
const key='bath-designer-selections-v2';
const message='욕조 파티션 선택 시 선택 불가';
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 const context=await browser.newContext({hasTouch:true});const page=await context.newPage();
 page.setDefaultTimeout(10000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error'&&!/favicon.ico/.test(m.location().url||''))errors.push(m.text());});
 page.on('requestfailed',r=>{if(!r.url().endsWith('/favicon.ico'))errors.push(r.url()+': '+r.failure()?.errorText);});
 page.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('/favicon.ico'))errors.push(r.status()+' '+r.url());});
 await context.route('**/*',r=>{const u=new URL(r.request().url());if(u.origin===new URL(base).origin||['fonts.googleapis.com','fonts.gstatic.com'].includes(u.hostname))return r.continue();errors.push('Unexpected external request: '+u.hostname);return r.abort();});
 const imageUrl=require('../data/bathroom-builder-image-settings.generated.json')['partitionShower:bathtub-partition'].builderImage;
 assert.ok(imageUrl&&decodeURIComponent(imageUrl).endsWith('/inbox/욕조 파티션.png'));
 const output=path.join(require('node:os').tmpdir(),'bath-bathtub-partition');await fs.mkdir(output,{recursive:true});
 const group=k=>page.locator(`.choiceGroup:has(#builder-${k}-content)`);
 const saved=()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
 async function ready(){await page.locator('.progressHeading').getByText('자동 저장됨').waitFor({state:'attached'});}
 async function seed(current,values,mode){await page.goto(base+'/');await page.evaluate(({key,current,values,mode})=>localStorage.setItem(key,JSON.stringify({version:3,current,values,projectInfo:{projectName:'욕조 검증',builderMode:mode},memo:'기존 메모',checks:{bathtub:'유지'}})),{key,current,values,mode});await page.goto(base+'/design?step='+(current+1));await ready();}
 async function step(current){await page.goto(base+'/design?step='+(current+1));await ready();}
 async function partition(){if(!await group('partitionShower').isVisible())await page.locator('.mobileBuilderNav:visible').getByRole('button',{name:'다음 항목 →',exact:true}).click();return group('partitionShower').getByRole('radio',{name:'욕조 파티션',exact:true});}
 async function settled(predicate){await page.waitForFunction(({key,source})=>new Function('s','return '+source)(JSON.parse(localStorage.getItem(key))),{key,source:predicate});}
 try{
 await page.goto(base+'/');
 assert.equal((await context.request.get(base+imageUrl)).status(),200);
 for(const mode of ['consumer','professional'])for(const width of [375,390,430,768,1024,1440]){
  await page.setViewportSize({width,height:width===1024?768:900});
  await seed(1,{bathtub:'none',tile:'ivory'},mode);
  await (await partition()).tap();
  await settled('s.values.partitionShower==="bathtub-partition"&&!s.values.bathtub');
  assert.ok((await saved()).imageHistoryOrder.includes('partitionShower:bathtub-partition'));
  const previewToggle=page.locator('.builderPreviewPanel>.builderDisclosureToggle');
  if(await previewToggle.isVisible()&&await previewToggle.getAttribute('aria-expanded')==='false')await previewToggle.click();
  await page.waitForFunction(url=>Array.from(document.images).some(img=>new URL(img.src).pathname===url&&img.naturalWidth>0),imageUrl);
  assert.ok((await page.locator('.selectionHistoryStrip').textContent()).includes('욕조 파티션'));
  await page.screenshot({path:path.join(output,`${mode}-${width}-partition.png`),fullPage:true});
  assert.equal((await saved()).values.tile,'ivory');
  await step(6);
  const none=group('bathtub').getByRole('radio',{name:/^욕조 없음/});
  assert.equal(await none.isDisabled(),true);assert.equal(await none.getAttribute('tabindex'),'-1');
  const label=none.locator('.builderChoiceLabel');assert.equal(await label.textContent(),'욕조 없음'+message);
  assert.equal(await none.locator('.builderChoiceDescription').textContent(),message);
  const disabledColors=()=>none.evaluate(el=>{const card=getComputedStyle(el);return {background:card.backgroundColor,border:card.borderTopColor,title:getComputedStyle(el.querySelector('.builderChoiceLabel')).color,description:getComputedStyle(el.querySelector('small')).color,icon:getComputedStyle(el.querySelector('.builderChoiceIndicator')).color,opacity:card.opacity,shadow:card.boxShadow,transform:card.transform};});
  const expectedColors={background:'rgb(231, 231, 229)',border:'rgb(190, 195, 198)',title:'rgb(75, 85, 99)',description:'rgb(92, 102, 112)',icon:'rgb(111, 116, 120)',opacity:'1',shadow:'none',transform:'none'};
  assert.deepEqual(await disabledColors(),expectedColors);
  await none.hover();assert.deepEqual(await disabledColors(),expectedColors);
  await page.mouse.down();try{assert.deepEqual(await disabledColors(),expectedColors);}finally{await page.mouse.up();}
  const prohibited=none.locator('svg.builderChoiceProhibitedIcon');assert.equal(await prohibited.count(),1);
  assert.equal(await none.locator('svg.lucide-circle-x').count(),0);
  assert.equal(await prohibited.locator('circle').count(),1);assert.equal(await prohibited.locator('line').count(),1);assert.equal(await prohibited.locator('path,text').count(),0);
  assert.ok(await prohibited.evaluate(el=>{const c=el.querySelector('circle'),l=el.querySelector('line'),b=el.getBoundingClientRect(),p=el.parentElement.getBoundingClientRect();const n=(e,k)=>Number(e.getAttribute(k));const cx=n(c,'cx'),cy=n(c,'cy'),x1=n(l,'x1'),y1=n(l,'y1'),x2=n(l,'x2'),y2=n(l,'y2');const inner=n(c,'r')-Number(el.getAttribute('stroke-width'))/2;return x1<x2&&y1>y2&&(x1+x2)/2===cx&&(y1+y2)/2===cy&&Math.abs(Math.hypot(x1-cx,y1-cy)-inner)<.02&&Math.abs(Math.hypot(x2-cx,y2-cy)-inner)<.02&&b.width===19&&b.height===19&&Math.abs(b.x+b.width/2-p.x-p.width/2)<1&&Math.abs(b.y+b.height/2-p.y-p.height/2)<1&&getComputedStyle(el).strokeWidth==='1.5px';}));
  assert.equal(await none.locator('.builderChoiceIndicator').evaluate(el=>getComputedStyle(el).borderTopWidth),'0px');
  assert.equal(await group('bathtub').locator('.builderChoiceCard:not(:disabled) svg.builderChoiceProhibitedIcon').count(),0);
  assert.ok(await none.locator('.builderChoiceDescription').evaluate(el=>{const style=getComputedStyle(el);return style.whiteSpace==='nowrap'&&style.textOverflow!=='ellipsis'&&el.scrollWidth<=el.clientWidth&&el.getBoundingClientRect().height<=parseFloat(style.lineHeight)+1;}));
  await none.evaluate(el=>el.click());await page.keyboard.press('Enter');assert.ok(!(await saved()).values.bathtub);
  const standard=group('bathtub').getByRole('radio',{name:'일반 욕조',exact:true});await standard.focus();await page.keyboard.press('ArrowUp');
  assert.notEqual(await page.evaluate(()=>document.activeElement?.textContent),'욕조 없음'+message);
  await standard.tap();await settled('s.values.bathtub==="bath-standard"');
  await page.reload();await ready();assert.equal(await none.isDisabled(),true);assert.equal((await saved()).values.bathtub,'bath-standard');
  await page.screenshot({path:path.join(output,`${mode}-${width}.png`),fullPage:true});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  assert.ok(await none.evaluate(el=>{const b=el.getBoundingClientRect(),d=el.querySelector('small').getBoundingClientRect();return d.left>=b.left&&d.right<=b.right&&d.bottom<=b.bottom;}));
  if(width<1200)assert.ok(await page.evaluate(()=>document.querySelector('.builderSelectionScroll').getBoundingClientRect().bottom<=document.querySelector('.mobileBuilderNav').getBoundingClientRect().top+1));
  await step(1);await (await partition()).tap();await settled('!s.values.partitionShower');
  assert.ok(!(await saved()).imageHistoryOrder.includes('partitionShower:bathtub-partition'));
  assert.equal(await page.locator('img').evaluateAll((imgs,url)=>imgs.filter(img=>new URL(img.src).pathname===url).length,imageUrl),0);
  await step(6);const enabled=group('bathtub').getByRole('radio',{name:'욕조 없음',exact:true});assert.equal(await enabled.isEnabled(),true);assert.equal(await enabled.locator('small').count(),0);assert.equal(await enabled.locator('svg.builderChoiceProhibitedIcon').count(),0);assert.equal(await enabled.locator('.builderChoiceIndicator--disabled').count(),0);assert.equal((await saved()).values.bathtub,'bath-standard');
  await page.mouse.move(0,0);
  const normalAppearance=el=>{const s=getComputedStyle(el);return {background:s.backgroundColor,border:s.borderTopColor,color:s.color,borderRadius:s.borderRadius,padding:s.padding};};
  assert.deepEqual(await enabled.evaluate(normalAppearance),await group('bathtub').getByRole('radio',{name:'조적 욕조',exact:true}).evaluate(normalAppearance));
  await enabled.tap();await settled('s.values.bathtub==="none"');
  await seed(6,{partitionShower:'bathtub-partition',bathtub:'none',tile:'ivory'},mode);
  assert.equal((await saved()).values.bathtub,undefined);assert.equal((await saved()).memo,'기존 메모');assert.equal((await saved()).checks.bathtub,'유지');
  await page.reload();await ready();assert.equal((await saved()).values.bathtub,undefined);
  await page.getByRole('button',{name:'프로젝트 정보 수정',exact:true}).click();
  await page.getByRole('radio',{name:mode==='consumer'?/^전문가용/:/^일반 고객용/}).click();await page.getByRole('button',{name:'프로젝트 정보 저장',exact:true}).click();await ready();
  assert.equal(await none.isDisabled(),true);assert.equal((await saved()).values.partitionShower,'bathtub-partition');assert.equal((await saved()).values.tile,'ivory');
  console.log(`PASS ${mode} ${width}: A/B/C/D, touch, keyboard, reload, inner notice/readability bounds and overflow`);
 }
 await page.setViewportSize({width:1440,height:900});await seed(6,{partitionShower:'bathtub-partition',bathtub:'bath-standard'},'consumer');
 for(const width of [768,1024]){
  await page.setViewportSize({width,height:768});await seed(1,{jendai:['new'],partitionShower:'bathtub-partition',bathtub:'bath-standard'},'professional');
  const jendai=group('jendai').getByRole('checkbox',{name:'젠다이 신설',exact:true});await jendai.click();await jendai.click();
  await page.locator('.selectedHeroImage img').waitFor();
  await page.locator('.builderSummaryPanel>.builderDisclosureToggle').click();
  assert.ok(await page.evaluate(()=>document.querySelector('.builderSummaryPanel').getBoundingClientRect().bottom<=document.querySelector('.mobileBuilderNav').getBoundingClientRect().top));
  console.log('PASS expanded summary/navigation '+width+'x768');
 }
 await page.setViewportSize({width:1440,height:900});await seed(6,{partitionShower:'bathtub-partition',bathtub:'bath-standard'},'consumer');
 const result=base+'/result?plan='+encodeURIComponent(encodeURIComponent(JSON.stringify({partitionShower:'bathtub-partition',bathtub:'none',tile:'ivory'})))+'&builderMode=consumer';
 await page.goto(result);await page.locator('.consultationSheet').waitFor();const text=await page.locator('.consultationSheet').textContent();assert.ok(text.includes('욕조 파티션'));assert.ok(!text.includes('욕조 없음'));
 await context.grantPermissions(['clipboard-read','clipboard-write']);await page.getByRole('button',{name:'요약만 복사',exact:true}).click();const copied=await page.evaluate(()=>navigator.clipboard.readText());assert.ok(copied.includes('욕조 파티션'));assert.ok(!copied.includes('욕조 없음'));
 await page.emulateMedia({media:'print'});await page.pdf({path:path.join(output,'consultation.pdf'),format:'A4'});
 await page.emulateMedia({media:'screen'});await page.getByRole('button',{name:'상담서 이미지 복사',exact:true}).click();await page.getByText('상담서 이미지가 복사되었습니다.',{exact:true}).waitFor();
 const png=await page.evaluate(async()=>{const items=await navigator.clipboard.read();const item=items.find(i=>i.types.includes('image/png'));const blob=await item.getType('image/png');const bitmap=await createImageBitmap(blob);return {width:bitmap.width,height:bitmap.height,size:blob.size};});assert.ok(png.width>0&&png.height>0&&png.size>0);
 await page.goto(base+'/result');await page.locator('.consultationSheet').waitFor();
 await page.getByRole('button',{name:'구조와 샤워 공간 수정',exact:true}).click();await ready();await (await partition()).waitFor();assert.equal((await saved()).values.partitionShower,'bathtub-partition');
 await page.getByRole('link',{name:'상담서로 돌아가기',exact:true}).click();await page.locator('.consultationSheet').waitFor();assert.ok((await page.locator('.consultationSheet').textContent()).includes('욕조 파티션'));
 assert.deepEqual(errors,[]);console.log('PASS conflicting URL consultation, clipboard, print PDF and runtime errors; screenshots: '+output);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
