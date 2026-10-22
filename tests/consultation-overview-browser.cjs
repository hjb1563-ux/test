const { run } = require('./helpers/browser-ui.cjs'), fs = require('node:fs');
run('consultation-overview', async h => {
  const { page, assert } = h, output='tests/artifacts/overview';
  fs.mkdirSync(output,{recursive:true});
  const values={demolition:'full-demolition',partitionShower:'full-partition',bathtub:'none',wallTileSize:'600x600',tile:'dark',tileSurface:'matte',sink:'vanity-basin',toilet:'one-piece',faucet:'concealed',waterproofing:'consult',drainPosition:'consult',bathroomCondition:['leak']};
  for(const [width,height] of h.sizes)for(const mode of ['consumer','professional']){
    await page.setViewportSize({width,height});await h.seed(3,values,mode);await h.report();
    const before=await h.saved();
    assert.equal(await page.getByRole('heading',{name:'공사 개요',exact:true}).count(),1);
    assert.equal(await page.getByRole('heading',{name:'핵심 선택 요약',exact:true}).count(),0);
    assert.deepEqual(await page.locator('.sheetCoreSummary dt').allTextContents(),['시공 방식','공간 구성','타일','주요 설비',...(mode==='professional'?['미정 사항']:[])]);
    assert.deepEqual(await page.locator('.sheetCoreSummary dd').allTextContents(),[mode==='consumer'?'올철거':'전체 철거','풀 파티션 · 욕조 없음','600×600 · 다크 · 무광','일반 세면대 · 원피스 변기 · 매립 세면 수전',...(mode==='professional'?['방수 방식 · 배수 위치']:[])]);
    const overlap=await page.locator('.sheetCoreSummary').evaluate(root=>{
      const rows=[...root.querySelectorAll('dl>div')];
      return rows.some((row,i)=>{const dt=row.querySelector('dt').getBoundingClientRect(),dd=row.querySelector('dd').getBoundingClientRect(),r=row.getBoundingClientRect(),next=rows[i+1]?.getBoundingClientRect();return dt.right>dd.left||dd.right>r.right+1||(next&&r.bottom>next.top+1)||row.querySelector('dd').scrollWidth>row.querySelector('dd').clientWidth;});
    });assert.equal(overlap,false,'labels/values/rows never overlap or clip');await h.noOverflow();
    assert.ok((await page.locator('#consultation-faucet').innerText()).includes('매립 세면 수전'));
    if(mode==='professional')assert.ok(!(await page.locator('.sheetSelections').innerText()).includes('현재 욕실 상태'));
    const text=await h.copy();assert.ok(text.includes('[공사 개요]'));assert.ok(text.includes('타일: 600×600 · 다크 · 무광'));assert.ok(!text.includes('핵심 선택 요약'));
    await page.reload();await page.locator('.sheetCoreSummary dl').waitFor();assert.deepEqual(await h.saved(),before);
    await page.screenshot({path:`${output}/${mode}-${width}-screen.png`,fullPage:true});
    await page.locator('.sheetCoreSummary').screenshot({path:`${output}/${mode}-${width}-overview.png`});
    if(width===390||width===1440){
      await page.emulateMedia({media:'print'});assert.equal(await page.locator('.sheetCoreSummary:visible').count(),1);
      await page.screenshot({path:`${output}/${mode}-${width}-print.png`,fullPage:true});
      await page.pdf({path:`${output}/${mode}-${width}.pdf`,format:'A4',printBackground:true});await page.emulateMedia({media:'screen'});
    }
    await page.getByRole('button',{name:'타일 수정',exact:true}).click();await page.locator('.builderConsultationEdit').waitFor();
    await h.choose('tile','화이트');await page.getByRole('link',{name:'상담서로 돌아가기',exact:true}).click();await page.locator('.sheetCoreSummary dl').waitFor();
    assert.ok((await page.locator('.sheetCoreSummary').innerText()).includes('600×600 · 화이트 · 무광'));
    assert.equal((await h.saved()).values.tile,'white');assert.equal((await h.saved()).memo,before.memo);
    console.log(`PASS overview ${mode} ${width}: exact 4/5 rows, copy/PDF, no overlap, storage restoration, selection edit updates`);
  }
  // A valid explicitly pending custom choice and long custom label must wrap,
  // rather than getting clipped, while the full detail remains available.
  await page.setViewportSize({width:375,height:812});
  await h.seed(14,{sink:'other',sinkOther:'아직 모르겠어요',wallTileSize:'other',wallTileSizeOther:'맞춤 모자이크 타일과 넓은 벽면을 위한 타일 구성',bathtub:'none'},'consumer');await h.report();
  assert.deepEqual(await page.locator('.sheetCoreSummary dt').allTextContents(),['공간 구성','타일','미정 사항']);
  assert.equal(await page.locator('.sheetCoreSummary dd').last().innerText(),'세면대');
  await h.noOverflow();
  await page.locator('.sheetCoreSummary').screenshot({path:output+'/custom-pending-375.png'});
  const text=await h.copy();assert.ok(text.includes('미정 사항: 세면대'));assert.ok(text.includes('맞춤 모자이크 타일과 넓은 벽면을 위한 타일 구성'));
  await page.evaluate(()=>{
    const serialize=XMLSerializer.prototype.serializeToString;
    XMLSerializer.prototype.serializeToString=function(node){const out=serialize.call(this,node);if(node.nodeName==='svg'&&out.includes('consultationDocument'))window.__overviewPngText=node.textContent;return out;};
  });
  const before=await h.saved();
  await page.getByRole('button',{name:'상담서 전체 복사',exact:true}).click();
  await page.getByText('상담서 전체가 PNG 이미지로 복사되었습니다.',{exact:true}).waitFor({timeout:120000});
  const png=await page.evaluate(async()=>{
    const item=(await navigator.clipboard.read()).find(i=>i.types.includes('image/png')),blob=await item.getType('image/png'),bitmap=await createImageBitmap(blob);
    return {width:bitmap.width,height:bitmap.height,bytes:[...new Uint8Array(await blob.arrayBuffer())],text:window.__overviewPngText};
  });
  fs.writeFileSync(output+'/custom-pending-375.png-export.png',Buffer.from(png.bytes));
  assert.equal(png.width,1600);for(const value of ['공사 개요','미정 사항','세면대','맞춤 모자이크 타일과 넓은 벽면을 위한 타일 구성'])assert.ok(png.text.includes(value));
  assert.deepEqual(await h.saved(),before);
  console.log('PASS custom/explicit pending: actual 1600px PNG and text, full long label preserved');
}).catch(e=>{console.error(e);process.exitCode=1;});
