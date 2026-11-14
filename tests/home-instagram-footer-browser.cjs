const assert = require('node:assert/strict');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright-core');
const fontCache = require('./helpers/font-response-cache.cjs');
const base = process.env.BUILDER_TEST_URL || 'http://127.0.0.1:3259';
assert.equal(new URL(base).hostname, '127.0.0.1', 'Use a disposable local server');
const label = '\ud648\ud398\uc774\uc9c0 \ubb38\uc758 instagram : h_jayb1';
const newTab = '\uc0c8 \ud0ed\uc5d0\uc11c \uc5f4\ub9bc';
const instagram = 'https://www.instagram.com/h_jayb1?exln=MXI4bGpqeHh1aWgyaA%3D%3D&utm_source=qr';
const artifact = 'tests/artifacts/home-instagram-footer';
function contrast(a,b) {
 const luminance = color => { const rgb = color.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;});return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2]; };
 const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);
}
(async()=>{
 fs.mkdirSync(artifact,{recursive:true});
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try {
 const context=await browser.newContext(),errors=[],unexpected=[],instagramRequests=[];
 const fonts=fontCache(errors);
 const routeRequest=async route=>{
  const request=route.request(),u=new URL(request.url());
  if(await fonts(route))return;
  if(u.hostname==='www.instagram.com'){
   instagramRequests.push({url:request.url(),referer:(await request.allHeaders()).referer||''});
   return route.fulfill({contentType:'text/html',body:'<!doctype html><title>External link test destination</title>'});
  }
  if(u.origin===base)return route.continue();
  unexpected.push(u.hostname+u.pathname);return route.abort();
 };
 await context.route('**/*',routeRequest);
 await context.addInitScript(()=>{window.__footerDocumentId=crypto.randomUUID();});
 const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
 page.setDefaultTimeout(12000);
 const contact=()=>page.getByRole('link',{name:label+' ('+newTab+')',exact:true});
 const results=[];
 for(const [width,height] of [[320,568],[375,667],[390,844],[430,932],[768,1024],[1024,768],[1440,900],[1920,1080]]){
  await page.setViewportSize({width,height});await page.goto(base+'/');await page.evaluate(()=>document.fonts.ready);
  const link=contact();await link.scrollIntoViewIfNeeded();
  assert.equal(await link.count(),1);assert.equal(await link.innerText(),label);assert.equal(await link.getAttribute('href'),instagram);
  assert.equal(await link.getAttribute('target'),'_blank');assert.equal(await link.getAttribute('rel'),'noopener noreferrer');
  assert.equal(await link.locator('svg[aria-hidden="true"]').count(),1);
  assert.ok((await link.ariaSnapshot()).includes(label+' ('+newTab+')'),'Accessible role/name announces the new tab');
  assert.equal(await page.locator('.heroFootnote>span').innerText(),'A quieter beginning, for your everyday.');
  assert.equal(await page.locator('.heroFootnote .footerContact').count(),0);
  const geometry=await link.evaluate(el=>{
   const box=el.getBoundingClientRect(),text=el.querySelector('span'),previous=el.previousElementSibling.getBoundingClientRect(),end=document.querySelector('.footerEnd').getBoundingClientRect(),style=getComputedStyle(el);
   return {height:box.height,left:box.left,right:box.right,width:innerWidth,overlap:previous.bottom>box.top,endOverlap:box.bottom>end.top,textFits:text.scrollWidth<=text.clientWidth,overflow:document.documentElement.scrollWidth>innerWidth,color:style.color,background:getComputedStyle(el.closest('footer')).backgroundColor,decoration:style.textDecorationLine};
  });
  assert.ok(geometry.height>=44);assert.ok(geometry.left>=0&&geometry.right<=width);assert.equal(geometry.overlap,false);assert.equal(geometry.endOverlap,false);assert.equal(geometry.textFits,true);assert.equal(geometry.overflow,false);assert.equal(geometry.decoration,'underline');assert.ok(contrast(geometry.color,geometry.background)>=4.5);
  await page.locator('footer').screenshot({path:artifact+'/footer-'+width+'.png'});
  if(width===1440){
   const nav=page.getByRole('navigation',{name:'\ud558\ub2e8 \uba54\ub274'}),links=nav.locator('a');
   await links.nth(await links.count()-2).focus();await page.keyboard.press('Tab');assert.equal(await link.evaluate(el=>el===document.activeElement),true);
   const focus=await link.evaluate(el=>{const s=getComputedStyle(el);return {style:s.outlineStyle,width:parseFloat(s.outlineWidth),color:s.outlineColor};});
   assert.equal(focus.style,'solid');assert.ok(focus.width>=2);assert.ok(contrast(focus.color,geometry.background)>=3);
   await page.locator('footer').screenshot({path:artifact+'/footer-keyboard-focus.png'});
   const [keyboardPopup]=await Promise.all([page.waitForEvent('popup'),page.keyboard.press('Enter')]);
   await keyboardPopup.waitForURL(instagram);await keyboardPopup.waitForLoadState('domcontentloaded');assert.equal(keyboardPopup.url(),instagram);assert.equal(await keyboardPopup.evaluate(()=>window.opener),null);assert.equal(await keyboardPopup.evaluate(()=>document.referrer),'');await keyboardPopup.close();
   await link.hover();const hover=await link.evaluate(el=>getComputedStyle(el).color);assert.equal(hover,'rgb(223, 178, 152)');
   const [clickPopup]=await Promise.all([page.waitForEvent('popup'),link.locator('span').click()]);await clickPopup.waitForURL(instagram);await clickPopup.waitForLoadState('domcontentloaded');assert.equal(clickPopup.url(),instagram);await clickPopup.close();
  }
  results.push({width,touchHeight:geometry.height,noOverflow:true,readableContrast:true});
 }
 await page.setViewportSize({width:1440,height:900});await page.goto(base+'/');
 const footerWithoutContact=await page.locator('footer').evaluate(el=>{const copy=el.cloneNode(true);copy.querySelector('.footerContact').remove();return copy.innerHTML;});
 const homeDocument=await page.evaluate(()=>window.__footerDocumentId);
 await page.locator('footer a[href="/design"]').click();await page.waitForURL(base+'/design');
 assert.equal(await page.evaluate(()=>window.__footerDocumentId),homeDocument,'Exercise persistent SPA footer');assert.equal(await contact().count(),0);assert.equal(await page.locator('footer.siteFooter').count(),0);
 await page.goBack();await page.waitForURL(base+'/');await contact().waitFor();
 for(const path of ['/guide','/guide/tile','/guide/glossary','/result','/admin/login']){
  await page.goto(base+path);assert.equal(await contact().count(),0);assert.equal(await page.locator('footer').innerHTML(),footerWithoutContact,'Unchanged footer markup: '+path);
 }
 await page.goto(base+'/guide');const guideDocument=await page.evaluate(()=>window.__footerDocumentId);await page.locator('footer a[href="/"]').click();await page.waitForURL(base+'/');await contact().waitFor();assert.equal(await page.evaluate(()=>window.__footerDocumentId),guideDocument);await page.goBack();await page.waitForURL(base+'/guide');assert.equal(await contact().count(),0);
 await page.goto(base+'/design');assert.equal(await contact().count(),0);assert.equal(await page.locator('footer.siteFooter').count(),0,'Builder footer remains hidden');
 const touchContext=await browser.newContext({viewport:{width:375,height:667},isMobile:true,hasTouch:true});await touchContext.route('**/*',routeRequest);const touchPage=await touchContext.newPage();touchPage.on('pageerror',error=>errors.push(error.message));await touchPage.goto(base+'/');const touchLink=touchPage.getByRole('link',{name:label+' ('+newTab+')',exact:true});await touchLink.scrollIntoViewIfNeeded();await touchPage.locator('footer').screenshot({path:artifact+'/footer-touch-375.png'});const [touchPopup]=await Promise.all([touchPage.waitForEvent('popup'),touchLink.tap()]);await touchPopup.waitForURL(instagram);await touchPopup.waitForLoadState('domcontentloaded');assert.equal(touchPopup.url(),instagram);assert.equal(await touchPopup.evaluate(()=>window.opener),null);assert.equal(await touchPopup.evaluate(()=>document.referrer),'');await touchContext.close();
 assert.equal(instagramRequests.length,3);for(const request of instagramRequests){assert.equal(request.url,instagram);assert.equal(request.referer,'');}
 assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);
 assert.equal(execFileSync('git',['diff','HEAD','--','app/(public)/page.tsx'],{encoding:'utf8'}),'','Hero/home source unchanged');
 console.log(JSON.stringify({pass:true,labelExact:true,urlExact:true,wholeTextLink:true,mobileTouch:true,keyboardTabAndEnter:true,newTab:true,noopener:true,noreferrer:true,accessibleName:true,homeOnlyAcrossSpaAndHistory:true,otherFootersUnchanged:true,heroUnchanged:true,externalRequestsMocked:true,viewports:results}));
 await context.close();
 } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
