const assert = require('node:assert/strict'), fs = require('node:fs'), ts = require('typescript');
require.extensions['.ts'] = (m, f) => m._compile(ts.transpileModule(fs.readFileSync(f, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, f);
const { generateConsultationSummary: overview, normalizeProject, consultationSummaryText, consultationRows } = require('../data/bathroom-consultation.ts');
const { getVisibleSteps } = require('../data/bathroom-builder-mode.ts');
const groups = require('../data/bathroom-builder-options.ts').builderBathroomSteps.flatMap(s => s.groups);
const full = { demolition:'full-demolition', partitionShower:'full-partition', bathtub:'none', wallTileSize:'600x600', tile:'dark', tileSurface:'matte', sink:'vanity-basin', toilet:'one-piece', faucet:'concealed', waterproofing:'consult', drainPosition:'consult' };
const row = (values, mode, id) => overview(values, mode).find(r => r.id === id)?.text;
for (const mode of ['consumer','professional']) {
  const before = JSON.stringify(full), result = overview(full,mode);
  assert.equal(result.length, mode==='consumer'?4:5);
  assert.equal(row(full,mode,'construction'),mode==='consumer'?'올철거':'전체 철거');
  assert.equal(row(full,mode,'space'),'풀 파티션 · 욕조 없음');
  assert.equal(row(full,mode,'tile'),'600×600 · 다크 · 무광');
  assert.equal(row(full,mode,'fixtures'),'일반 세면대 · 원피스 변기 · 매립 세면 수전');
  assert.equal(row(full,mode,'pending'),mode==='professional'?'방수 방식 · 배수 위치':undefined);
  assert.equal(JSON.stringify(full),before);
  const restored=normalizeProject({version:3,values:full,projectInfo:{builderMode:mode}});
  assert.deepEqual(overview(restored.values,mode),result);
  const text=consultationSummaryText(restored);
  assert.ok(text.includes('[공사 개요]')); assert.ok(!text.includes('핵심 선택 요약'));
  for(const item of result) assert.ok(text.includes(item.title+': '+item.text));
  assert.deepEqual(overview({},mode),[]);
  assert.equal(row({bathtub:'none'},mode,'space'),'욕조 없음');
  assert.equal(row({bathtub:'bath-masonry'},mode,'fixtures'),'조적 욕조');
  assert.ok(!JSON.stringify(overview({partitionShower:'bathtub-partition',bathtub:'none'},mode)).includes('욕조 없음'));
  assert.equal(row({partitionShower:'bathtub-partition',bathtub:'bath-standard'},mode,'space'),'욕조 파티션');
  assert.equal(row({partitionShower:'bathtub-partition',bathtub:'bath-standard'},mode,'fixtures'),'일반 욕조');
  assert.deepEqual(overview({sink:'undecided',toilet:'invalid',tileSurface:'unknown',bathtubOther:'선택하지 않은 텍스트'},mode),[]);
  assert.equal(row({sink:'other',sinkOther:'아직 모르겠어요'},mode,'pending'),'세면대');
  assert.equal(row({sink:'other',sinkOther:''},mode,'pending'),undefined);
  const duplicate=overview({sink:'other',sinkOther:'맞춤 설비',toilet:'other',toiletOther:'맞춤 설비',showerFaucet:['rain','rain']},mode);
  assert.equal(duplicate[0].text,'맞춤 설비 · 해바라기 샤워 수전');
  assert.ok(!JSON.stringify(overview({bathroomCondition:['leak'],waterproofing:'coating-waterproofing',drain:'linear-drain',ventilationOther:'제품명',grout:'grout-epoxy'},mode)).includes('누수'));
  // Exhaust the real catalog, not a parallel hardcoded label map.
  for(const group of getVisibleSteps(mode).flatMap(s=>s.groups)) for(const choice of group.choices) {
    const values={...full,[group.key]:group.multiple?[choice.id]:choice.id};
    if(choice.requiresCustomText)values[group.key+'Other']='맞춤 '+group.title;
    const result=overview(values,mode);
    assert.ok(result.length<=5);
    for(const r of result){assert.ok(r.text.trim());assert.equal(r.items.length,new Set(r.items).size);if(r.id!=='pending')assert.ok(r.items.length<=3);}
    const flattened=result.filter(r=>r.id!=='pending').flatMap(r=>r.items);assert.equal(flattened.length,new Set(flattened).size);
    assert.ok(!result.some(r=>r.id==='condition'));
  }
  // Compression never removes selected rows from the separate detailed document.
  const dense={...full,bathtub:'bath-standard',showerFaucet:['shower','concealed-shower','rain','other'],showerFaucetOther:'추가 수전'};
  assert.equal(overview(dense,mode).find(r=>r.id==='fixtures').items.length,3);
  assert.ok(consultationRows(dense,mode).find(r=>r.key==='showerFaucet').label.includes('추가 수전'));
}
assert.equal(groups.find(g=>g.key==='demolition').choices.find(c=>c.id==='partial-demolition-overlay').name,'부분 철거 + 덧방');
console.log('PASS consultation-overview: all current choices in both modes, exact labels, <=5 rows, deduplication, explicit pending vs unanswered, no-bath/partition invariant, restoration, full details and text');
