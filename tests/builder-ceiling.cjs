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
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  new Function('require', 'module', 'exports', source)(name => load(path.resolve(path.dirname(file), name)), module, module.exports);
  return module.exports;
}
const root = path.resolve(__dirname, '..');
const modes = load(path.join(root, 'data/bathroom-builder-mode'));
const selection = load(path.join(root, 'data/bathroom-selection'));
const consultation = load(path.join(root, 'data/bathroom-consultation'));
const history = load(path.join(root, 'data/bathroom-image-history'));
const professional = modes.getVisibleSteps('professional').find(step => step.key === 'ceiling');
const consumer = {groups: load(path.join(root, 'data/bathroom-builder-options')).builderBathroomSteps.find(step=>step.key==='ceiling').groups.filter(g=>g.key==='ceilingPreference')};
assert.equal(modes.getVisibleSteps('consumer').some(step=>step.key==='ceiling'),false);
assert.equal(modes.getVisibleSteps('consumer').length, 10); assert.equal(modes.getVisibleSteps('professional').length, 15);
assert.equal(professional.groups.length, 1); assert.equal(consumer.groups.length, 1);
assert.equal(professional.groups[0].key, 'ceiling'); assert.equal(consumer.groups[0].key, 'ceilingPreference');
assert.deepEqual(professional.groups[0].choices.map(choice => choice.name), ['SMC 평천장','SMC 돔천장','이노솔','도장','기타']);
assert.deepEqual(consumer.groups[0].choices.map(choice => choice.name), ['일반용','고급용','자유로운 디자인']);
assert.ok(!professional.groups[0].multiple && !consumer.groups[0].multiple);
for (const choice of consumer.groups[0].choices) {
  assert.equal(choice.showBuilderImage, false); assert.equal(choice.builderImage, null);
  assert.equal(history.selectedImageItems({ ceilingPreference: choice.id }).length, 0);
}
const sample = { ceiling: 'inosol', ceilingPreference: 'premium', jendai: ['new'] };
const normalized = selection.normalizeBathroomValues(sample);
assert.deepEqual(normalized, { ...sample, showerFaucet: [] });
for (const mode of ['consumer','professional','consumer','professional']) {
  const project = consultation.normalizeProject({ version: 3, values: sample, projectInfo: { projectName: '테스트', builderMode: mode } });
  assert.deepEqual(project.values, normalized);
  const rows = consultation.consultationRows(project.values, mode);
  const row = rows.find(row => row.key === (mode === 'consumer' ? 'ceilingPreference' : 'ceiling'));
  if (mode === 'consumer') assert.equal(row, undefined); else assert.equal(row.label, '이노솔');
  const text = consultation.consultationSummaryText(project);
  assert.equal(text.includes('이노솔'), mode === 'professional');
  assert.ok(!text.includes('고급용'));
  assert.ok(!text.includes(mode === 'consumer' ? '이노솔' : '고급용'));
  const changed = selection.toggleSelection(project.values, mode === 'consumer' ? 'ceilingPreference' : 'ceiling', mode === 'consumer' ? 'free-design' : 'painted');
  assert.equal(changed[mode === 'consumer' ? 'ceiling' : 'ceilingPreference'], mode === 'consumer' ? 'inosol' : 'premium');
}
for (const id of ['smc-flat','smc-dome','other']) {
  const project = consultation.normalizeProject({ version: 3, values: { ceiling: id, ceilingOther: '기존 입력' }, projectInfo: { builderMode: 'consumer' } });
  assert.equal(project.values.ceiling, id); assert.equal(project.values.ceilingPreference, undefined);
  assert.equal(consultation.consultationRows(project.values, 'consumer').find(row => row.key === 'ceilingPreference'), undefined);
}
for (const id of ['inosol','painted','smc-flat','smc-dome']) {
  const item = history.selectedImageItems({ ceiling: id })[0]; assert.ok(item.choice.showBuilderImage);
  assert.ok(fs.existsSync(path.join(root, 'public', decodeURIComponent(item.choice.builderImage))));
}
const jendai = history.selectedImageItems({ jendai: ['new'] })[0];
assert.equal(jendai.id, 'jendai:new'); assert.ok(decodeURIComponent(jendai.choice.builderImage).endsWith('젠다이 신설6.png'));
assert.ok(fs.existsSync(path.join(root, 'public/images/bathroom-builder/structure/jendai/젠다이 신설2.png')));
console.log('PASS ceiling: independent mode fields, legacy/custom values, 10/15 steps, mode-aware report/summary, single choice, no-image consumer, shared images and unchanged jendai ID');
