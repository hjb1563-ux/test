const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.BUILDER_TEST_URL || 'http://localhost:3000';
const storage = 'bath-designer-selections-v2';
const cache = new Map();
function load(file) {
  if (!path.extname(file)) file += '.ts';
  if (file.endsWith('.json')) return JSON.parse(fs.readFileSync(file, 'utf8'));
  if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} }; cache.set(file, module);
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'module', 'exports', code)(name => load(path.resolve(path.dirname(file), name)), module, module.exports);
  return module.exports;
}
const { getVisibleSteps } = load(path.resolve('data/bathroom-builder-mode.ts'));
const { selectedImageItems } = load(path.resolve('data/bathroom-image-history.ts'));
const steps = getVisibleSteps('consumer');
const values = {};
for (const group of steps.flatMap(step => step.groups)) {
  const choice = group.choices.find(choice => choice.showBuilderImage && choice.builderImage);
  if (choice && Object.keys(values).length < 8) values[group.key] = group.multiple ? [choice.id] : choice.id;
}
delete values[Object.keys(values).at(-1)];
values.faucet = 'one-hole';
const initialImages = selectedImageItems(values);
assert.equal(initialImages.length, 8);
const initialOrder = initialImages.map(item => item.id).reverse();
(async () => {
 const browser=await chromium.launch({channel:'chrome',headless:true});const context=await browser.newContext({hasTouch:true});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const saved=()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),storage);
 async function seed(){await page.goto(base+'/design');await page.locator('.projectInfoForm,.builderCompactFlow').first().waitFor();await page.evaluate(({storage,values,initialOrder})=>localStorage.setItem(storage,JSON.stringify({version:3,current:8,values,imageHistoryOrder:initialOrder,projectInfo:{projectName:'Gallery',builderMode:'consumer'}})),{storage,values,initialOrder});await page.goto(base+'/design?step=9');await page.locator('.builderCompactFlow').waitFor();}
 async function position(index,total){await page.locator('.builderSwipeTrack').evaluate((e,i)=>e.scrollTo({left:i*e.clientWidth,behavior:'instant'}),index);await page.waitForFunction(({index,total})=>document.querySelector('.builderSwipeCounter')?.textContent===String(index+1)+' / '+total,{index,total});}
 try{
  for(const [width,height] of [[430,932],[390,844],[375,812]]){
   await page.setViewportSize({width,height});await seed();assert.equal(await page.locator('.builderSwipeSlide').count(),8);assert.equal(await page.locator('.builderSwipeCounter').textContent(),'1 / 8');
   const before=await saved();await position(4,8);assert.deepEqual((await saved()).values,before.values);assert.deepEqual((await saved()).imageHistoryOrder,before.imageHistoryOrder);
   const fifth=initialImages.find(item=>item.id===initialOrder[4]);assert.equal(await page.locator('.builderSwipeLabel').textContent(),fifth.choice.name);
   await page.locator('.choiceGroup:visible [role=radio]').nth(1).click();await page.waitForFunction(()=>document.querySelector('.builderSwipeCounter')?.textContent==='1 / 8');assert.equal(await page.locator('.builderSwipeSlide').count(),8);
   await page.locator('.mobileBuilderNav .button').click();assert.equal(await page.locator('.builderSwipeTrack').count(),0);assert.equal(await page.locator('.builderSwipeEmpty').isVisible(),true);assert.equal((await saved()).imageHistoryOrder.length,8);
   await page.locator('.choiceGroup:visible [role=checkbox]').nth(0).click();await page.locator('.choiceGroup:visible [role=checkbox]').nth(2).click();await page.waitForFunction(()=>document.querySelector('.builderSwipeCounter')?.textContent==='1 / 10');
   await position(9,10);await page.locator('.choiceGroup:visible [role=checkbox]').nth(0).click();await page.waitForFunction(()=>document.querySelector('.builderSwipeCounter')?.textContent==='1 / 9');
   await page.locator('.choiceGroup:visible [role=checkbox]').nth(3).click();await page.locator('#builder-showerFaucet-other').fill('text only');assert.equal(await page.locator('.builderSwipeSlide').count(),9);
   await page.locator('.choiceGroup:visible [role=checkbox]').nth(2).click();assert.equal(await page.locator('.builderSwipeTrack').count(),0);assert.equal((await saved()).imageHistoryOrder.length,8);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);console.log('PASS eight-image gallery '+width+'x'+height);
  }
  assert.deepEqual(errors,[]);
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
