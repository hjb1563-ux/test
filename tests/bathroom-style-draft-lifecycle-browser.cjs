const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {load}=require('./bathroom-style-draft.cjs'),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const {normalizeProject}=load(path.resolve('data/bathroom-consultation.ts')),{styleDraftValues}=load(path.resolve('data/bathroom-style-draft.ts'));
(async()=>{const browser=await chromium.launch({channel:'chrome'});try{
 for(const mode of ['consumer','professional']){
  const context=await browser.newContext({viewport:{width:1366,height:768},permissions:['clipboard-read','clipboard-write']});await context.route('**/api/**',r=>r.abort());const page=await context.newPage();
  await page.goto((process.env.BUILDER_TEST_URL||'http://localhost:3120')+"/",{waitUntil:'domcontentloaded'});
  const project=normalizeProject({projectInfo:{builderMode:mode},values:styleDraftValues('premium-02',mode)});
  await page.evaluate(project=>{localStorage.setItem('bath-designer-selections-v2','{"version":3,"memo":"original"}');sessionStorage.setItem('bath-designer-style-draft-v1:lifecycle',JSON.stringify({exampleId:'premium-02',project}));},project);
  const before=await page.evaluate(()=>localStorage.getItem('bath-designer-selections-v2'));
  await page.goto((process.env.BUILDER_TEST_URL||'http://localhost:3120')+"/result?styleDraft=lifecycle",{waitUntil:'domcontentloaded'});await page.locator('[data-style-draft-notice]').waitFor();
  await page.getByRole('link',{name:'프로젝트 정보 입력·수정'}).click();await page.locator('#project-name').fill('Cancelled change');await page.getByRole('button',{name:'취소',exact:true}).click();await page.getByRole('link',{name:'상담서로 돌아가기',exact:true}).first().click();
  assert.equal(await page.locator('.sheetProjectTitle').count(),0);
  await page.getByRole('link',{name:'프로젝트 정보 입력·수정'}).click();await page.locator('#project-name').fill('Draft project');await page.getByRole('button',{name:'욕실 만들기 시작',exact:false}).click();await page.getByRole('link',{name:'상담서로 돌아가기',exact:true}).first().click();await page.getByText('Draft project',{exact:true}).waitFor();
  await page.getByRole('button',{name:'공사 개요만 복사',exact:true}).click();const text=await page.evaluate(()=>navigator.clipboard.readText());assert.ok(text.includes('Draft project')&&text.includes('예시 기반 상담서 초안'));
  await page.getByRole('button',{name:'상담서 전체 복사',exact:true}).click();await page.getByText('상담서 전체가 PNG 이미지로 복사되었습니다.',{exact:true}).waitFor({timeout:60000});
  const png=await page.evaluate(async()=>{const items=await navigator.clipboard.read();const blob=await items.find(i=>i.types.includes('image/png')).getType('image/png');const buffer=await blob.arrayBuffer();return Array.from(new Uint8Array(buffer));});
  fs.mkdirSync('tests/artifacts/style-draft',{recursive:true});fs.writeFileSync(`tests/artifacts/style-draft/${mode}-clipboard.png`,Buffer.from(png));
  await page.emulateMedia({media:'print'});const pdf=await page.pdf({path:`tests/artifacts/style-draft/${mode}-final.pdf`,format:'A4',printBackground:true});assert.ok(pdf.length>10000);
  assert.equal(await page.evaluate(()=>localStorage.getItem('bath-designer-selections-v2')),before);
  await page.emulateMedia({media:'screen'});await page.reload();await page.getByText('Draft project',{exact:true}).waitFor();
  await page.evaluate(()=>sessionStorage.removeItem('bath-designer-style-draft-v1:lifecycle'));await page.reload();await page.locator('p[role="alert"]').waitFor();assert.equal(await page.evaluate(()=>localStorage.getItem('bath-designer-selections-v2')),before);
  console.log(`PASS ${mode}: project info cancel/save, summary text, actual clipboard PNG ${png.length} bytes, PDF ${pdf.length} bytes, refresh/expiry, original localStorage untouched`);await context.close();
 }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
