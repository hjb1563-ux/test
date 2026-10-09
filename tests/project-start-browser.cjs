const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.BUILDER_TEST_URL||'http://localhost:3000';
const key='bath-designer-selections-v2';
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{channel:'chrome'})});
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const name=()=>page.locator('#project-customer-name'),project=()=>page.locator('#project-name');
 const start=()=>page.getByRole('button',{name:'욕실 만들기 시작',exact:true});
 const saved=()=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);
 async function fresh(){await page.goto(base+'/design');await page.locator('.projectInfoForm,.progressHeading').first().waitFor();await page.evaluate(k=>localStorage.removeItem(k),key);await page.reload();await start().waitFor();}
 async function enterDoesNothing(){for(const input of [name(),project()]){await input.press('Enter');assert.equal(await page.locator('.projectInfoForm').isVisible(),true);assert.equal(await page.locator('progress').count(),0);}}
 try{
  for(const [width,height]of [[1920,1080],[1440,900],[1280,720],[1024,768],[768,1024],[430,932],[390,844],[375,812]]){
   await page.setViewportSize({width,height});await fresh();
   const box=await start().boundingBox();assert.ok(box.height>=44);assert.ok(box.y+box.height<=height);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   assert.equal(await start().getAttribute('type'),'button');await name().fill('홍길동');await enterDoesNothing();await start().click();await page.locator('progress').waitFor();
   assert.equal(await page.locator('progress').getAttribute('value'),'1');assert.equal(await page.locator('progress').getAttribute('max'),'16');
   assert.equal((await saved()).projectInfo.customerName,'홍길동');assert.equal((await saved()).projectInfo.projectName,'');
   await page.reload();await page.locator('progress').waitFor();assert.equal(await page.locator('.projectInfoForm').count(),0);
   console.log('PASS '+width+'x'+height+': visible CTA, input Enter blocked, click starts, exact storage, refresh');
  }
  await fresh();await start().click();assert.equal(await page.locator('#project-info-validation').textContent(),'고객명 또는 프로젝트명 중 하나를 입력해주세요.');
  assert.equal(await page.locator('progress').count(),0);await name().fill('     ');await start().click();assert.ok(await page.locator('#project-info-validation').isVisible());
  await name().fill('홍길동');assert.equal(await page.locator('#project-info-validation').count(),0);
  // The component has no keydown interception: composing Enter is left to the IME.
  const composition=await name().evaluate(e=>{e.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));const event=new KeyboardEvent('keydown',{key:'Enter',code:'Enter',isComposing:true,keyCode:229,bubbles:true,cancelable:true});e.dispatchEvent(event);e.dispatchEvent(new CompositionEvent('compositionend',{data:'홍길동',bubbles:true}));return {prevented:event.defaultPrevented,value:e.value};});
  assert.equal(composition.prevented,false);assert.equal(composition.value,'홍길동');assert.equal(await page.locator('progress').count(),0);
  await project().focus();await page.keyboard.press('Tab');assert.equal(await start().evaluate(e=>e===document.activeElement),true);await page.keyboard.press('Enter');await page.locator('progress').waitFor();
  await fresh();await project().fill('  안방 욕실 리모델링  ');await enterDoesNothing();await start().focus();await page.keyboard.press('Space');await page.locator('progress').waitFor();
  assert.equal((await saved()).projectInfo.customerName,'');assert.equal((await saved()).projectInfo.projectName,'안방 욕실 리모델링');
  await fresh();await name().fill(' 홍길동 ');await project().fill(' 홍길동 고객님 욕실 리모델링 ');await start().click();await page.locator('progress').waitFor();
  assert.equal((await saved()).projectInfo.customerName,'홍길동');assert.equal((await saved()).projectInfo.projectName,'홍길동 고객님 욕실 리모델링');
  // Edit mode returns to the saved STEP, with selections/history intact.
  await page.evaluate(k=>localStorage.setItem(k,JSON.stringify({version:3,current:7,projectInfo:{customerName:'홍길동',projectName:'기존 프로젝트'},values:{demolition:'overlay',wallTileSize:'600x600',tile:'dark',tileSurface:'matte'},imageHistoryOrder:['tile:dark','wallTileSize:600x600','demolition:overlay'],memo:'현장 메모'})),key);
  await page.goto(base+'/design?step=8');await page.locator('progress').waitFor();const before=await saved();
  await page.getByRole('button',{name:'프로젝트 정보 수정',exact:true}).click();await project().fill('수정 프로젝트');await enterDoesNothing();
  await page.getByRole('button',{name:'프로젝트 정보 저장',exact:true}).click();await page.locator('progress').waitFor();
  assert.equal(await page.locator('progress').getAttribute('value'),'8');const after=await saved();assert.deepEqual(after.values,before.values);assert.deepEqual(after.imageHistoryOrder,before.imageHistoryOrder);assert.equal(after.memo,before.memo);assert.equal(after.projectInfo.projectName,'수정 프로젝트');
  assert.deepEqual(errors,[]);console.log('PASS blank/whitespace validation, name/project/both, trim, composition event, Tab/Enter/Space, edit returns to STEP08 with state intact, no runtime errors');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
