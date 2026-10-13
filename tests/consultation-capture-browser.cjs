const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.BUILDER_TEST_URL || 'http://localhost:3001';
const key = 'bath-designer-selections-v2';
const sizes = [[1920,1080],[1440,900],[1280,720],[1024,768],[768,1024],[430,932],[390,844],[375,812]];
const values = {demolition:'full-demolition',waterproofing:'combined-waterproofing',drain:'linear-drain',wallTileSize:'600x600',tile:'white',tileSurface:'matte',sink:'top-bowl',toilet:'two-piece',faucet:'one-hole',showerFaucet:['rain','concealed-shower'],ventilationOther:'힘펠 휴젠뜨',accessoryOther:'수건걸이'};
const info = {projectName:'전체 문서 캡처 검증',customerName:'김검증',propertyType:'아파트',occupancyStatus:'살고 있다',areaPyeong:'34',constructionDate:'2026-12-31',budget:10000000};
const memo = Array.from({length:32},(_,i)=>`${i+1}. 업체 메모: 수납과 청소 편의를 확인해주세요.`).join('\n')+'\n메모의 마지막 줄도 포함됩니다.';
(async()=>{
  const browser = await chromium.launch({headless:true,channel:'chrome'});
  const context = await browser.newContext({permissions:['clipboard-read','clipboard-write']});
  const page = await context.newPage(), errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  fs.mkdirSync('tests/artifacts/consultation-capture',{recursive:true});
  const saved=()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
  async function seed(mode,current=0) {
    await page.goto(base+'/');
    await page.evaluate(({key,mode,current,values,info,memo})=>localStorage.setItem(key,JSON.stringify({version:3,current,values,projectInfo:{...info,builderMode:mode},memo,specialNotes:'기존 누수 흔적 확인',imageHistoryOrder:['tile:white','faucet:one-hole']})),{key,mode,current,values,info,memo});
    await page.goto(base+'/design'); await page.locator('.builderProgress').waitFor();
  }
  const nav=()=>page.locator('.mobileBuilderNav:visible');
  async function next() {
    if(await nav().count()) await nav().getByRole('button',{name:'현재 STEP 전체 건너뛰기',exact:true}).click();
    else await page.locator('.navButtons:visible').getByRole('button',{name:'다음',exact:true}).click();
  }
  async function readPNG() {
    return page.evaluate(async()=>{
      const items=await navigator.clipboard.read(), item=items.find(item=>item.types.includes('image/png'));
      if(!item)throw Error('Clipboard PNG missing');
      const blob=await item.getType('image/png'),bitmap=await createImageBitmap(blob);
      const dimensions={width:bitmap.width,height:bitmap.height};bitmap.close();
      const data=await new Promise(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.readAsDataURL(blob);});
      return {...dimensions,data,mime:blob.type,size:blob.size};
    });
  }
  try {
    for(const [width,height] of process.env.CAPTURE_FLOWS_ONLY ? [] : sizes) {
      await page.setViewportSize({width,height});
      for(const mode of ['consumer','professional']) {
        const total=mode==='consumer'?13:15;
        await seed(mode);
        assert.equal(await page.locator('progress').getAttribute('max'),String(total));
        assert.equal(await page.getByText('최종 검토',{exact:true}).count(),0);
        await seed(mode,13); await next();
        assert.equal(await page.locator('progress').getAttribute('value'),String(total));
        assert.equal(await page.locator('progress').getAttribute('max'),String(total));
        assert.equal(await page.locator('.selectionWarning').count(),0);
        const activeNav=await nav().count()?nav():page.locator('.navButtons:visible');
        await activeNav.getByRole('button',{name:'이전',exact:true}).click();
        assert.equal(await page.locator('progress').getAttribute('value'),String(total-1));
        await next();
        await page.getByRole('link',{name:/^상담서 보기/}).filter({visible:true}).click();
        await page.locator('.sheetStep').first().waitFor();
        assert.equal(await page.locator('.sheetStep').count(),total);
        assert.equal(await page.locator('.consultationDocument .resultActions').count(),0);
        assert.equal(await page.locator('.selectionWarning').count(),0);
        assert.ok((await page.locator('.sheetProjectIdentity').textContent()).includes('작성 모드'));
        await page.getByRole('button',{name:'요약만 복사',exact:true}).click();
        let text=await page.evaluate(()=>navigator.clipboard.readText());
        assert.ok(!text.includes('작성 모드'));for(const value of ['김검증','아파트','살고 있다','34평','2026.12.31','10,000,000','600×600','메모의 마지막 줄도 포함됩니다.'])assert.ok(text.includes(value),value);
        await page.getByRole('button',{name:'선택 내용 복사',exact:true}).click();text=await page.evaluate(()=>navigator.clipboard.readText());assert.ok(text.includes('작성 모드'));
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
        const documentHeight=await page.locator('.consultationDocument').evaluate(root=>root.scrollHeight);
        assert.ok(documentHeight>height);
        const before=await saved();
        await page.getByRole('button',{name:'상담서 이미지 복사',exact:true}).click();
        await page.getByText('상담서 이미지가 복사되었습니다.',{exact:true}).waitFor({timeout:60000});
        assert.equal(await page.getByRole('button',{name:'상담서 이미지 복사',exact:true}).isEnabled(),true);
        const png=await readPNG();
        assert.equal(png.mime,'image/png');assert.ok(png.size>20000);assert.ok(png.height>height*2);assert.ok(png.height>documentHeight);assert.ok(png.width<=16384);assert.ok(png.height<=16384);assert.ok(png.width*png.height<=24000000);
        fs.writeFileSync(`tests/artifacts/consultation-capture/${mode}-${width}.png`,Buffer.from(png.data.split(',')[1],'base64'));
        assert.deepEqual((await saved()).values,before.values);
        assert.deepEqual((await saved()).imageHistoryOrder,before.imageHistoryOrder);
        assert.equal((await saved()).memo,memo);
        assert.equal(await page.locator('body>div[aria-hidden="true"] .consultationDocument').count(),0);
        await page.screenshot({path:`tests/artifacts/consultation-capture/${mode}-${width}-screen.png`,fullPage:true});
        console.log(`PASS ${mode} ${width}x${height}: ${total} steps, last CTA, no review, warning scope, summary metadata, PNG ${png.width}x${png.height}, actions wrap, data preserved`);
      }
    }
    await page.setViewportSize({width:390,height:844});
    for(const mode of ['consumer','professional']) {
      await seed(mode,15);
      assert.equal(await page.locator('progress').getAttribute('value'),mode==='consumer'?'13':'15');
      assert.equal(await page.getByText('최종 검토',{exact:true}).count(),0);
      await page.goto(base+'/design?step=16&returnTo=consultation');await page.locator('.builderProgress').waitFor();
      assert.equal((await saved()).current,14);
      for(const step of [3,6,7,8,11,12,13,14]) {
        await page.goto(base+`/design?step=${step+1}`);await page.locator('.builderProgress').waitFor();
        assert.equal(await page.locator('.selectionWarning').count(),step===8?1:0);
      }
      await page.goto(base+'/design?step=9');await page.locator('.selectionWarning').waitFor();
      assert.ok((await page.locator('.selectionWarning').textContent()).startsWith('탑볼 세면대와 낮은 수전의 높이 조합을 확인하세요'));
      await page.locator('#builder-faucet-content').getByRole('radio',{name:'매립 세면 수전',exact:true}).click();
      assert.equal(await page.locator('.selectionWarning').count(),0);
      assert.equal(await page.locator('progress').getAttribute('value'),mode==='consumer'?'8':'9');
      await page.goto(base+'/result');await page.locator('.sheetStep').first().waitFor();
      const category=mode==='consumer'?'타일 수정':'방수 수정';
      await page.getByRole('button',{name:category,exact:true}).click();await page.locator('.builderProgress').waitFor();
      assert.equal(await page.locator('progress').getAttribute('value'),'3');
      assert.equal(await page.locator('progress').getAttribute('max'),mode==='consumer'?'13':'15');
      await page.getByRole('link',{name:'상담서로 돌아가기',exact:true}).click();await page.locator('.sheetStep').first().waitFor();
      await page.getByRole('button',{name:'욕실 문틀 하부 / 문턱 수정',exact:true}).click();await page.locator('.builderProgress').waitFor();
      await page.getByRole('link',{name:/^상담서 보기/}).filter({visible:true}).click();await page.locator('.sheetStep').first().waitFor();
      await page.locator('#consultation-special-notes').fill('상담서에서 특이사항 수정');await page.reload();await page.locator('.sheetStep').first().waitFor();assert.equal(await page.locator('#consultation-special-notes').inputValue(),'상담서에서 특이사항 수정');
      await page.emulateMedia({media:'print'});assert.equal(await page.locator('.consultationActionsWrap:visible').count(),0);assert.equal(await page.locator('.printOnly.memoPrint:visible').first().textContent(),memo);
      await page.screenshot({path:`tests/artifacts/consultation-capture/${mode}-print.png`,fullPage:true});await page.emulateMedia({media:'screen'});
      await page.getByRole('button',{name:'선택 수정',exact:true}).click();await page.locator('.builderProgress').waitFor();assert.equal((await saved()).current,0);
    }
    await page.goto(base+'/result');await page.locator('.sheetStep').first().waitFor();
    await page.evaluate(()=>{window.originalClipboardItem=window.ClipboardItem;window.ClipboardItem=undefined;});
    await page.getByRole('button',{name:'상담서 이미지 복사',exact:true}).click();await page.getByText('상담서 이미지 복사에 실패했습니다.',{exact:true}).waitFor();
    assert.equal(await page.getByRole('button',{name:'상담서 이미지 복사',exact:true}).isEnabled(),true);
    await page.evaluate(()=>{window.ClipboardItem=window.originalClipboardItem;});
    assert.deepEqual(errors,[]);
    console.log('PASS legacy current/index16 clamp, exact warning stable key and changed selection, edit/return, special notes persistence, print, general edit entry, unsupported clipboard feedback, no runtime errors');
  } catch(e) {await page.screenshot({path:'tests/artifacts/consultation-capture/failure.png',fullPage:true});throw e;}
  finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
