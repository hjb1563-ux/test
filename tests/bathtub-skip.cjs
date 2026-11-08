const assert = require('node:assert/strict');
const path = require('node:path');
const { load } = require('./bathroom-style-draft.cjs');
const s = load(path.resolve('data/bathroom-selection.ts'));
const m = load(path.resolve('data/bathroom-builder-mode.ts'));
const c = load(path.resolve('data/bathroom-consultation.ts'));
const d = load(path.resolve('data/bathroom-style-draft.ts'));
for (const mode of ['consumer', 'professional']) {
  const all = m.getVisibleSteps(mode), bath = all.find(step => step.groups.some(g => g.key === 'bathtub'));
  assert.deepEqual(bath.groups.map(g => g.key), ['bathtub']);
  assert.equal(all.length, mode === 'consumer' ? 10 : 15);
  for (const id of ['half-partition', 'full-partition', 'fixed-glass', 'door-booth']) {
    const values = s.normalizeBathroomValues({ partitionShower: id, bathtub: 'bath-standard' });
    const before = JSON.stringify(values), nav = m.getNavigableSteps(mode, values);
    assert.equal(nav.length, all.length - 1);
    assert.ok(!nav.some(step => step.stepIndex === bath.stepIndex));
    assert.equal(m.nearestVisibleStep(bath.stepIndex, mode, values), all[all.indexOf(bath) + 1].stepIndex);
    const row = c.consultationRows(values, mode).find(r => r.key === 'bathtub');
    assert.equal(row.status, 'excluded'); assert.equal(row.pending, false); assert.deepEqual(row.choices, []);
    assert.ok(!c.consultationSummaryText(c.normalizeProject({ values, projectInfo: { builderMode: mode } })).includes('일반 욕조'));
    assert.ok(c.consultationText(c.consultationRows(values, mode), '', '', c.normalizeProjectInfo({ builderMode: mode })).includes(row.displayLabel));
    assert.equal(JSON.stringify(values), before);
    const restored = c.normalizeProject(JSON.parse(JSON.stringify({ version: 3, values, projectInfo: { builderMode: mode } })));
    assert.equal(restored.values.bathtub, 'bath-standard');
    const cleared = s.toggleSelection(restored.values, 'partitionShower', id);
    assert.equal(c.consultationRows(cleared, mode).find(r => r.key === 'bathtub').status, 'selected');
    assert.equal(m.getNavigableSteps(mode, cleared).length, all.length);
  }
  for (const id of ['none', 'bathtub-partition', '']) assert.equal(m.getNavigableSteps(mode, { partitionShower: id }).length, all.length);
  for (const id of ['essential-01','essential-02','balanced-01','balanced-02','balanced-03','premium-01','premium-02']) {
    const v = d.styleDraftValues(id, mode);
    assert.equal(c.consultationRows(v, mode).find(r => r.key === 'bathtub').status === 'excluded', s.isBathtubExcluded(v));
  }
}
assert.equal(s.isBathtubExcluded({ partitionShower: ['other', 'door-booth'] }), true);
console.log('PASS bathtub skip: four IDs, both modes, stable steps, direct navigation, retained/restored data, output and seven examples');
