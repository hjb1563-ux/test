const fs=require('node:fs'),{run}=require('./helpers/browser-ui.cjs');
run('jendai-threshold',async h=>{
 const {page,assert}=h,output=process.env.JENDAI_QA_OUTPUT||'tests/artifacts/jendai-threshold';fs.mkdirSync(output,{recursive:true});
 const keep='기존 젠다이 유지',description='덧방·부분철거 시',threshold='기존 문턱 유지';
 for(const [width,height]of h.sizes)for(const mode of ['consumer','professional']){
  await page.setViewportSize({width,height});
  const values={demolition:'overlay',jendai:['keep'],threshold:'threshold-tile',tile:'white',bathtub:'none'};
  await h.seed(1,values,mode,{imageHistoryOrder:['tile:white']});
  const j=await h.focus('jendai'),choice=j.getByRole('checkbox',{name:new RegExp('^'+keep)});
  assert.equal(await choice.locator('.builderChoiceLabel').evaluate(el=>el.firstChild.textContent),keep);
  assert.equal(await choice.locator('.builderChoiceDescription').innerText(),description);
  const geometry=await choice.evaluate(el=>{
   const label=el.querySelector('.builderChoiceLabel'),sub=el.querySelector('small'),indicator=el.querySelector('.builderChoiceIndicator');
   const r=el.getBoundingClientRect(),l=label.getBoundingClientRect(),s=sub.getBoundingClientRect(),i=indicator.getBoundingClientRect(),style=getComputedStyle(sub),title=getComputedStyle(label);
   return {fits:l.left>=r.left&&l.right<=i.left&&s.bottom<=r.bottom&&sub.scrollWidth<=sub.clientWidth,below:s.top>l.top,small:parseFloat(style.fontSize)<parseFloat(title.fontSize),muted:style.color!==title.color,whiteSpace:style.whiteSpace,oneLine:s.height<=parseFloat(style.lineHeight)+1};
  });assert.ok(geometry.fits&&geometry.below&&geometry.small&&geometry.muted&&geometry.oneLine);assert.notEqual(geometry.whiteSpace,'nowrap');
  assert.equal(await j.locator('.builderChoiceDescription').count(),1,'other jendai cards stay unchanged');
  assert.equal(await choice.count(),1);assert.equal(await choice.getAttribute('aria-checked'),'true','legacy keep ID is restored');
  assert.equal(await j.getByRole('checkbox').count(),4);assert.ok((await h.summary()).includes(keep));
  await choice.click();assert.deepEqual((await h.saved()).values.jendai,[]);await choice.click();assert.deepEqual((await h.saved()).values.jendai,['keep']);
  const image=h.settings['jendai:keep'];if(image?.showBuilderImage&&image.builderImage)await h.preview(keep,image.builderImage);
  await h.noOverflow();await page.screenshot({path:`${output}/${mode}-${width}-jendai.png`,fullPage:true});
  await page.goto(h.base+'/design?step=15');await page.locator('progress').waitFor();
  const g=await h.focus('threshold'),options=g.getByRole('radio');
  assert.deepEqual(await options.allTextContents(),[threshold,'타일 마감','인조대리석 마감']);
  assert.equal(await g.getByRole('radio',{name:'타일 마감',exact:true}).getAttribute('aria-checked'),'true','old threshold ID still restores');
  const radio=options.first();await radio.click();assert.equal((await h.saved()).values.threshold,'threshold-keep');assert.equal(await radio.getAttribute('aria-checked'),'true');
  const rect=await options.evaluateAll(els=>els.map(e=>{const r=e.getBoundingClientRect();return {width:r.width,height:r.height,selected:e.classList.contains('selected'),clipped:e.scrollWidth>e.clientWidth};}));
  assert.ok(rect[0].selected);assert.ok(rect.every(r=>r.width===rect[0].width&&r.height===rect[0].height&&!r.clipped),'same card dimensions with no clipping');
  await radio.click();assert.equal((await h.saved()).values.threshold,'');await radio.click();
  const history=(await h.saved()).imageHistoryOrder;
  await page.reload();await page.locator('progress').waitFor();await h.focus('threshold');
  assert.equal(await h.group('threshold').getByRole('radio',{name:threshold,exact:true}).getAttribute('aria-checked'),'true');
  assert.ok((await h.summary()).includes(threshold));assert.deepEqual((await h.saved()).imageHistoryOrder,history,'text choice adds no unrelated image');
  assert.equal((await h.saved()).values.tile,'white');assert.deepEqual((await h.saved()).values.jendai,['keep']);await h.noOverflow();
  await page.screenshot({path:`${output}/${mode}-${width}-threshold.png`,fullPage:true});await h.report();
  assert.ok((await page.locator('#consultation-layout').innerText()).includes(keep));
  assert.ok(!(await page.locator('#consultation-layout').innerText()).includes('(덧방용)'));
  assert.ok((await page.locator('#consultation-threshold').innerText()).includes(threshold));
  assert.equal(await page.getByRole('heading',{name:'공사 개요',exact:true}).count(),1);
  assert.equal(await page.getByRole('button',{name:'공사 개요만 복사',exact:true}).count(),1);
  const fullCopy=page.getByRole('button',{name:'상담서 전체 복사',exact:true});assert.equal(await fullCopy.count(),1);
  const helpId=await fullCopy.getAttribute('aria-describedby');assert.equal(await page.locator('#'+helpId).innerText(),'상담서 전체를 PNG 이미지로 클립보드에 복사합니다.');
  assert.ok((await page.locator('.sheetCoreSummary').innerText()).includes(keep));
  const before=await h.saved(),text=await h.copy();for(const value of [keep,'문턱 마감: '+threshold])assert.ok(text.includes(value));
  if(width===375||width===1440){
   await page.evaluate(()=>{const serialize=XMLSerializer.prototype.serializeToString;XMLSerializer.prototype.serializeToString=function(node){const out=serialize.call(this,node);if(node.nodeName==='svg'&&out.includes('consultationDocument'))window.__choicePngText=node.textContent;return out;};});
   await page.getByRole('button',{name:'상담서 전체 복사',exact:true}).click();await page.getByText('상담서 전체가 PNG 이미지로 복사되었습니다.',{exact:true}).waitFor({timeout:120000});
   const png=await page.evaluate(async()=>{const item=(await navigator.clipboard.read()).find(i=>i.types.includes('image/png')),blob=await item.getType('image/png'),bitmap=await createImageBitmap(blob);return {width:bitmap.width,height:bitmap.height,bytes:[...new Uint8Array(await blob.arrayBuffer())],text:window.__choicePngText};});
   assert.equal(png.width,1600);for(const value of [keep,threshold,'공사 개요'])assert.ok(png.text.includes(value));assert.ok(!png.text.includes('기존 젠다이 유지(덧방용)'));
   fs.writeFileSync(`${output}/${mode}-${width}.png`,Buffer.from(png.bytes));
  }
  if(width===390||width===1440){
   await page.emulateMedia({media:'print'});for(const selector of ['#consultation-layout','#consultation-threshold'])assert.equal(await page.locator(selector+':visible').count(),1);
   const pdf=await page.pdf({path:`${output}/${mode}-${width}.pdf`,format:'A4',printBackground:true});assert.ok(pdf.length>10000);await page.emulateMedia({media:'screen'});
  }
  assert.deepEqual(await h.saved(),before,'all copy/print operations preserve stored data');
  console.log(`PASS ${mode} ${width}: legacy jendai, first unique threshold, toggle/restore/history, overview/details/text, PNG/PDF`);
 }
}).catch(e=>{console.error(e);process.exitCode=1;});
