const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
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
const root = path.resolve(__dirname, '..');
const modes = load(path.join(root, 'data/bathroom-builder-mode'));
const c = load(path.join(root, 'data/bathroom-consultation'));
const selection = load(path.join(root, 'data/bathroom-selection'));
assert.equal(c.normalizeProject(null).projectInfo.builderMode, 'consumer');
assert.equal(c.normalizeProject({ values: {} }).projectInfo.builderMode, 'consumer');
assert.equal(c.normalizeProject({ values: { waterproofing: 'combined-waterproofing' } }).projectInfo.builderMode, 'professional');
assert.equal(c.normalizeProject({ values: { accessoryOther: '선반' } }).projectInfo.builderMode, 'professional');
const consumer = modes.getVisibleSteps('consumer'), pro = modes.getVisibleSteps('professional');
assert.deepEqual(consumer.map(s => s.stepIndex), [0,1,3,4,5,6,8,11,13,14]);
assert.equal(pro.length, 15);
assert.deepEqual(consumer[0].groups.map(g => g.key), ['demolition','bathroomCondition']);
assert.deepEqual(pro[0].groups.map(g => g.key), ['demolition']);
assert.equal(consumer[1].groups[0].title, '욕실 선반벽(젠다이)');
assert.equal(consumer[1].groups[2].title, '매립 선반(샴푸박스)');
assert.equal(modes.nearestVisibleStep(2, 'consumer'), 3);
assert.equal(modes.nearestVisibleStep(9, 'consumer'), 11);
for (const mode of ['consumer', 'professional']) {
  assert.equal(modes.nearestVisibleStep(15, mode), 14);
  assert.equal(modes.getVisibleSteps(mode).some(step => step.key === 'checklist'), false);
}
const values = {demolition:'full-demolition',waterproofing:'combined-waterproofing',drain:'linear-drain',drainPosition:'move',bathroomCondition:['leak'],wallTileSize:'600x600',tile:'white',tileSurface:'matte',sink:'undermount-basin',toilet:'two-piece',faucet:'concealed',showerFaucet:['concealed-shower','rain'],grout:'grout-epoxy',accessoryOther:'수건걸이'};
const project = c.normalizeProject({version:3, values, projectInfo:{projectName:'공유 프로젝트',builderMode:'professional'},imageHistoryOrder:['waterproofing:combined-waterproofing','tile:white']});
const fingerprint = JSON.stringify(project.values), history = JSON.stringify(project.imageHistoryOrder);
const hidden = ['waterproofing','drain','drainPosition','ceiling','ventilation','accessoryFinish','accessory'];
for (const mode of ['consumer','professional','consumer','professional']) {
  const next = c.updateProjectContent(project, {projectInfo:{...project.projectInfo,builderMode:mode}});
  assert.equal(JSON.stringify(next.values), fingerprint);
  assert.equal(JSON.stringify(next.imageHistoryOrder), history);
  const rows = c.consultationRows(next.values, mode);
  assert.equal(rows.length, modes.getVisibleSteps(mode).reduce((n,s)=>n+s.groups.length,0));
  assert.equal(rows.filter(r => r.pending).length, rows.filter(r => r.label === '미정').length);
  for (const key of hidden) assert.equal(rows.some(r => r.key === key), mode === 'professional');
  const texts = [c.consultationSummaryText(next), c.consultationText(rows,'','',next.projectInfo), c.consultationText(c.consultationRows(next.values),'','',next.projectInfo)];
  assert.ok(texts[0].includes('공사 개요'));
  assert.ok(texts[0].includes(mode === 'consumer' ? '시공 방식: 올철거' : '시공 방식: 전체 철거'));
  for (const label of ['액방 + 도막','라인 배수구']) assert.ok(!texts[0].includes(label), 'technical detail is not repeated in overview');
  for (const text of texts.slice(1)) {
    for (const label of ['전체 철거','액방 + 도막','라인 배수구']) assert.equal(text.includes(label), mode === 'professional', label);
    assert.ok(text.includes('600×600')); assert.ok(text.includes('매립 세면 수전'));
  }
  assert.ok(texts[0].includes('600×600')); assert.ok(texts[0].includes('매립 세면 수전'));
  assert.ok(!texts[0].includes('작성 모드'));
  assert.ok(texts[1].includes('작성 모드'));
  if (mode === 'consumer') assert.ok(texts[1].includes('03 타일'));
  else assert.ok(texts[1].includes('04 타일'));
}
assert.deepEqual(selection.toggleSelection(values,'showerFaucet','other',true).showerFaucet,['concealed-shower','rain','other']);
console.log('PASS modes: defaults, legacy, stable IDs, 10/15 mapping, sections, nearest navigation, hidden counts, shared values/history, summaries and copy filtering');
