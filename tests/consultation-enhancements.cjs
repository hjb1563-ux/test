// Component-level regression checks; no browser or additional packages required.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
let slots = [], cursor = 0, effects = [], dirty = false;
const storage = new Map();
const params = new URLSearchParams();
let storageFailure = false, confirmReset = false, printCalls = 0, clipboardText = '', clipboardFailure = false, navigatedTo = '';
const timers = new Map(); let timerIndex = 0;
const browserWindow = { setTimeout(fn, ms) { const id = ++timerIndex; timers.set(id, {fn, ms}); return id; }, clearTimeout(id) { timers.delete(id); }, history: { replaceState: (_state, _title, url) => { navigatedTo = url; } }, scrollTo: () => {}, confirm: () => confirmReset, print: () => printCalls++, location: { assign: url => { navigatedTo = url; } } };
const browserNavigator = { clipboard: { writeText: async value => { if (clipboardFailure) throw new Error('Clipboard blocked'); clipboardText = value; } } };
const hooks = {
  useState(initial) {
    const index = cursor++;
    const scope = slots;
    if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
    return [slots[index], value => {
      const next = typeof value === 'function' ? value(scope[index]) : value;
      if (!Object.is(next, scope[index])) { scope[index] = next; dirty = true; }
    }];
  },
  useMemo(fn, deps) {
    const index = cursor++;
    if (!slots[index] || deps.some((v, i) => v !== slots[index].deps[i])) slots[index] = { value: fn(), deps };
    return slots[index].value;
  },
  useEffect(fn, deps) {
    const index = cursor++;
    if (!slots[index] || deps.some((v, i) => v !== slots[index][i])) { slots[index] = deps; effects.push(fn); }
  },
};
const cache = new Map();
function evaluate(source, filename) {
  const module = { exports: {} };
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true, target: ts.ScriptTarget.ES2022 } }).outputText;
  const localRequire = name => {
    if (name === 'react') return { ...React, ...hooks };
    if (name === 'next/navigation') return { useSearchParams: () => params };
    if (name === 'next/link') return { default: props => React.createElement('a', props), __esModule: true };
    if (name === 'next/image') return { default: props => React.createElement('img', props), __esModule: true };
    if (name === 'lucide-react') return new Proxy({}, { get: () => () => null });
    if (name.includes('guides/catalog')) return { guideBySlug: {} };
    if (name.startsWith('.')) return load(path.resolve(path.dirname(filename), name));
    return require(name);
  };
  vm.runInNewContext(code, { exports: module.exports, module, require: localRequire, URLSearchParams, document: { getElementById: () => null }, window: browserWindow, navigator: browserNavigator, localStorage: { getItem: k => { if (storageFailure) throw new Error('Storage blocked'); return storage.get(k) ?? null; }, setItem: (k, v) => { if (storageFailure) throw new Error('Storage blocked'); storage.set(k, v); }, removeItem: k => storage.delete(k) } }, { filename });
  return module.exports;
}
function load(file) {
  if (file.endsWith('.json')) return JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!path.extname(file)) file += fs.existsSync(file + '.tsx') ? '.tsx' : '.ts';
  if (!cache.has(file)) cache.set(file, evaluate(fs.readFileSync(file, 'utf8'), file));
  return cache.get(file);
}
const componentStores = new WeakMap();
function expand(node, identity = 'root', rootSlots = slots) {
  if (Array.isArray(node)) return node.flatMap((child, index) => expand(child, `${identity}/${child?.key ?? index}`, rootSlots));
  if (!node || typeof node !== 'object') return node;
  if (typeof node.type === 'function') {
    if (!componentStores.has(rootSlots)) componentStores.set(rootSlots, new Map());
    const stores = componentStores.get(rootSlots), key = `${identity}/${node.type.name}/${node.key ?? ''}`;
    if (!stores.has(key)) stores.set(key, []);
    const parentSlots = slots, parentCursor = cursor;
    slots = stores.get(key); cursor = 0;
    const result = node.type(node.props);
    slots = parentSlots; cursor = parentCursor;
    return expand(result, key, rootSlots);
  }
  return { type: node.type, props: node.props, children: expand(node.props?.children, `${identity}/${String(node.type)}`, rootSlots) };
}
function all(node, predicate) {
  if (Array.isArray(node)) return node.flatMap(n => all(n, predicate));
  if (!node || typeof node !== 'object') return [];
  return [...(predicate(node) ? [node] : []), ...all(node.children, predicate)];
}
const text = node => typeof node === 'number' ? String(node) : typeof node === 'string' ? node : Array.isArray(node) ? node.map(text).join('') : node && typeof node === 'object' ? text(node.children) : '';
const Configurator = load(path.join(root, 'components/Configurator')).default;
const data = load(path.join(root, 'data/bathroom-options'));
const builderSteps = load(path.join(root, 'data/bathroom-builder-options')).builderBathroomSteps;
const groups = builderSteps.flatMap(step => step.groups);
function render() {
  let tree, rounds = 0;
  do { dirty = false; cursor = 0; effects = []; tree = expand(Configurator()); effects.forEach(fn => fn()); assert.ok(++rounds < 20); } while (dirty);
  return tree;
}

const consultation = load(path.join(root, 'data/bathroom-consultation'));
const Result = load(path.join(root, 'app/result/page')).default;
const timestamp = '2026-10-07T15:32:00.000Z';
const changedTimestamp = '2026-10-08T01:23:00.000Z';
const values = {
  demolition: 'partial-demolition-overlay', jendai: ['remove', 'new'],
  waterproofing: 'coating-waterproofing', wallTileSize: '600x600', tile: 'white', tileSurface: 'matte',
  sink: 'undermount-basin', toilet: 'two-piece', mirror: 'mirror', faucet: 'concealed',
  showerFaucet: ['concealed-shower', 'rain', 'other'], showerFaucetOther: '온도조절 수전',
  bathtub: 'bath-standard', grout: 'grout-epoxy', accessoryFinish: 'chrome',
  threshold: 'threshold-artificial-stone', ventilationOther: '힘펠 휴젠뜨',
};
const original = consultation.normalizeProject({ version: 3, current: 8, values,
  projectInfo: { projectName: '홍길동 고객님 욕실 리모델링', customerName: '홍길동' },
  memo: '수납공간을 넉넉하게 하고 싶어요.\n공사 일정도 상담해주세요.', specialNotes: '누수 이력 확인', lastModifiedAt: timestamp });
const saved = () => JSON.parse(storage.get(consultation.STORAGE));
function fresh(project, query = '') {
  slots = []; timers.clear();
  [...params.keys()].forEach(key => params.delete(key));
  new URLSearchParams(query).forEach((value, key) => params.set(key, value));
  storage.clear(); storage.set(consultation.STORAGE, JSON.stringify(project));
}
function resultRender() {
  let tree, rounds = 0;
  do { dirty = false; cursor = 0; effects = []; tree = expand(Result()); effects.forEach(fn => fn()); assert.ok(++rounds < 20); } while (dirty);
  return tree;
}
const byClass = (tree, cls) => all(tree, node => node.props.className?.split(' ').includes(cls));
const button = (tree, label) => all(tree, node => node.type === 'button' && text(node) === label)[0];
const summary = consultation.generateConsultationSummary(original.values);
assert.equal(summary.length, 5);
const summaryText = summary.map(group => group.text).join('\n');
for (const value of ['부분 철거 + 덧방', '600×600', '화이트', '무광', '언더볼 세면대', '투피스 변기', '매립 세면 수전', '매립 샤워&욕조 수전', '해바라기 샤워 수전', '온도조절 수전', '에폭시 줄눈', '힘펠 휴젠뜨']) assert.ok(summaryText.includes(value), value);
assert.ok(!summaryText.includes('미정')); assert.ok(!summaryText.includes('기타'));
assert.deepEqual(Array.from(consultation.generateConsultationSummary({})), []);
assert.deepEqual(Array.from(consultation.generateConsultationSummary({ ventilationOther: '미정', showerFaucet: ['other'], showerFaucetOther: '  ' })), []);
const partial = consultation.generateConsultationSummary({ showerFaucet: ['rain', 'other'], showerFaucetOther: '' });
assert.equal(partial.length, 1); assert.equal(partial[0].text, '해바라기 샤워 수전');
assert.equal(consultation.generateConsultationSummary({ wallTileSize: 'other', wallTileSizeOther: '모자이크 타일' })[0].text, '모자이크 타일');
assert.equal(consultation.generateConsultationSummary({ toilet: 'other', toiletOther: '비데 일체형 변기' })[0].text, '비데 일체형 변기');
const conditionValues={...original.values,bathroomCondition:['damaged-tile','leak','remove-bath','other'],bathroomConditionOther:'천장 누수 흔적이 있다'};
const conditionSummary=consultation.generateConsultationSummary(conditionValues);
assert.equal(conditionSummary.length,6);assert.equal(conditionSummary[0].id,'condition');assert.equal(conditionSummary[0].title,'현재 욕실 상태');
assert.equal(conditionSummary[0].text,'기존타일이 깨졌거나 들떠 있다 · 누수 이력이 있다 · 욕조를 철거하고 싶다 · 천장 누수 흔적이 있다');
assert.equal(conditionSummary[1].text,summary[0].text);
assert.equal(conditionSummary.slice(1).map(group=>group.text).join('\n'),summaryText);
assert.ok(consultation.consultationSummaryText({...original,values:conditionValues}).includes('현재 욕실 상태: '+conditionSummary[0].text));
for(const absent of [undefined,null,[],'','   ','미정',['unknown-condition'],['invalid'],['other']]){
 assert.ok(!consultation.generateConsultationSummary({...original.values,bathroomCondition:absent}).some(group=>group.id==='condition'));
 assert.ok(!consultation.consultationSummaryText({...original,values:{...original.values,bathroomCondition:absent}}).includes('현재 욕실 상태:'));
}
assert.equal(consultation.generateConsultationSummary({bathroomCondition:['leak']})[0].text,'누수 이력이 있다');
assert.equal(consultation.generateConsultationSummary({bathroomCondition:['other'],bathroomConditionOther:'바닥 일부 파손'})[0].text,'바닥 일부 파손');
assert.equal(consultation.formatLastModified(timestamp), '2026.10.08 00:32');
assert.equal(consultation.formatLastModified(null), '');
assert.equal(consultation.formatLastModified('invalid'), '');
const touch = patch => consultation.updateProjectContent(original, patch, () => changedTimestamp);
for (const patch of [{current: 3}, {imageHistoryOrder: ['faucet:concealed']}, {checks: {faucet: 'checked'}}, {values: {...original.values}}, {memo: original.memo}, {projectInfo: {...original.projectInfo}}]) assert.equal(touch(patch).lastModifiedAt, timestamp);
for (const patch of [{values: {...original.values, grout: 'grout-cement'}}, {values: {...original.values, showerFaucetOther: '다른 수전'}}, {projectInfo: {...original.projectInfo, customerName: '새 고객'}}, {memo: '새 메모'}, {specialNotes: '새 특이사항'}]) assert.equal(touch(patch).lastModifiedAt, changedTimestamp);
const legacy = consultation.normalizeProject({version: 3, values: original.values});
assert.equal(legacy.lastModifiedAt, null);
assert.equal(consultation.updateProjectContent(legacy, {current: 3}).lastModifiedAt, null);
assert.equal(consultation.normalizeProject({lastModifiedAt:'invalid'}).lastModifiedAt, null);
console.log('PASS summary: 5 groups, empty/pending/other/multiple/text inputs; timestamps: semantic content changes only, legacy, Seoul format');

for (const info of [{customerName:'홍길동',projectName:''}, {customerName:'',projectName:'안방 욕실'}, original.projectInfo, {customerName:'',projectName:''}]) {
  fresh({...original, projectInfo:info}); const tree = resultRender();
  const projectLine = byClass(tree,'sheetProjectInfo');
  assert.equal(projectLine.length,1);
  const title=byClass(tree,'sheetProjectTitle');
  assert.equal(title.length, info.customerName || info.projectName ? 1 : 0);
  if(title.length)assert.equal(text(title[0]),info.projectName || info.customerName+' 고객님 욕실 리모델링');
  assert.equal(byClass(tree,'sheetCompleted').length,0);
  assert.equal(saved().projectInfo.projectName,info.projectName);
  assert.equal(projectLine.length ? text(projectLine[0]).includes('고객명 ·') : false, !!info.customerName);
  assert.equal(byClass(tree,'sheetStep').length,15);
  assert.equal(byClass(tree,'sheetStep--highlighted').length,0);
  assert.equal(byClass(tree,'sheetLastModified').length,1);
  assert.equal(byClass(tree,'sheetCoreSummary').length,1);
  assert.equal(saved().lastModifiedAt,timestamp);
}
fresh(legacy); let tree = resultRender();
assert.equal(byClass(tree,'sheetLastModified').length,0);
assert.equal(saved().lastModifiedAt,null);
fresh(consultation.normalizeProject({version:3,values:{}}));tree=resultRender();
for(const card of byClass(tree,'sheetStep')){
 for(const row of byClass(card,'sheetRow')){
  const undecided=byClass(row,'sheetUndecidedValue');assert.equal(undecided.length,1);
  assert.equal(text(undecided[0]),'미정');assert.equal(text(row).split('미정').length-1,1);
 }
}
fresh({...original,values:{...original.values,ventilationOther:'',showerFaucet:['other'],showerFaucetOther:''}});tree=resultRender();
assert.ok(byClass(tree,'sheetUndecidedValue').some(node=>text(node)==='미정'));
const tileCard=all(tree,n=>n.props.id==='consultation-tile')[0];
const white=all(tileCard,n=>n.type==='strong'&&text(n)==='화이트')[0];assert.equal(white.props.className,undefined);
console.log('PASS condition summary: first group, no duplication, absent/legacy/custom/multiple, clipboard source; undecided badge all 15 cards, duplicate status removed, normal values unchanged');
for (const step of builderSteps.slice(0,-1)) {
  fresh(original, `editedCategory=${step.key}`); tree = resultRender();
  const highlight = byClass(tree,'sheetStep--highlighted');
  assert.equal(highlight.length,1); assert.equal(highlight[0].props.id,`consultation-${step.key}`);
  assert.ok(!navigatedTo.includes('editedCategory'));
  assert.equal(timers.size,1); const timer = [...timers.values()][0]; assert.equal(timer.ms,1500);
  assert.ok(!JSON.stringify(saved()).includes('highlight'));
  timer.fn(); tree=resultRender(); assert.equal(byClass(tree,'sheetStep--highlighted').length,0);
}
fresh(original,'editedCategory=not-a-category'); tree=resultRender(); assert.equal(byClass(tree,'sheetStep--highlighted').length,0);
fresh(original); tree=render();
const returnLink = all(tree,n=>n.type==='a'&&text(n)==='상담서로 돌아가기'); assert.equal(returnLink.length,0);
fresh(original,'step=9&returnTo=consultation'); tree=render();
const returning=all(tree,n=>n.type==='a'&&text(n)==='상담서로 돌아가기')[0]; assert.equal(returning.props.href.query.editedCategory,'faucet');
assert.equal(saved().lastModifiedAt,timestamp);
const next = button(tree,'다음'); next.props.onClick(); tree=render(); assert.equal(saved().lastModifiedAt,timestamp);
fresh(original,'step=9&returnTo=consultation');tree=render();
const preview=byClass(tree,'historyPreviewButton')[0];assert.ok(preview);preview.props.onClick();tree=render();assert.equal(saved().lastModifiedAt,timestamp);
const faucetGroup=all(tree,n=>n.props.id==='builder-faucet-content')[0];
all(faucetGroup,n=>n.type==='button'&&n.props.role==='radio'&&text(n)==='일반 세면 수전')[0].props.onClick();tree=render();assert.notEqual(saved().lastModifiedAt,timestamp);
button(tree,'다음').props.onClick();tree=render();
assert.equal(all(tree,n=>n.type==='a'&&text(n)==='상담서로 돌아가기')[0].props.href.query.editedCategory,'faucet');
const optionTime=saved().lastModifiedAt;fresh(saved(),'step=9');tree=render();assert.equal(saved().lastModifiedAt,optionTime);
fresh(original);tree=render();
all(tree,n=>n.type==='button'&&n.props['aria-label']==='프로젝트 정보 수정')[0].props.onClick();tree=render();assert.equal(saved().lastModifiedAt,timestamp);
all(tree,n=>n.type==='form')[0].props.onSubmit({preventDefault(){}});tree=render();assert.equal(saved().lastModifiedAt,timestamp);
all(tree,n=>n.type==='button'&&n.props['aria-label']==='프로젝트 정보 수정')[0].props.onClick();tree=render();
all(tree,n=>n.type==='input'&&n.props.id==='project-name')[0].props.onChange({target:{value:'수정된 프로젝트'}});tree=render();
all(tree,n=>n.type==='form')[0].props.onSubmit({preventDefault(){}});tree=render();assert.notEqual(saved().lastModifiedAt,timestamp);
assert.equal(saved().current,original.current);assert.equal(JSON.stringify(saved().values),JSON.stringify(original.values));
fresh(original); tree=resultRender();
const memo=all(tree,n=>n.type==='textarea'&&n.props.id==='consultation-memo')[0];
assert.equal(memo.props.placeholder,'예: 청소가 쉬웠으면 좋겠어요. 아이와 함께 사용하는 욕실입니다. 수납공간을 넉넉하게 하고 싶어요.');
assert.equal(memo.props.value,original.memo);
memo.props.onChange({target:{value:'새 메모\n줄바꿈 보존'}});tree=resultRender();assert.equal(saved().memo,'새 메모\n줄바꿈 보존');assert.notEqual(saved().lastModifiedAt,timestamp);
const memoTime=saved().lastModifiedAt;fresh(saved());tree=resultRender();assert.equal(saved().lastModifiedAt,memoTime);
assert.equal(text(byClass(tree,'memoPrint')[0]),'새 메모\n줄바꿈 보존');
assert.ok(!byClass(tree,'sheetProjectInfo')[0].props.className.includes('printHide'));
assert.ok(!byClass(tree,'sheetLastModified')[0].props.className.includes('printHide'));
assert.ok(!byClass(tree,'sheetCoreSummary')[0].props.className.includes('printHide'));
assert.ok(byClass(tree,'resultActions')[0].props.className.includes('printHide'));
console.log('PASS render: identity variants, 15 detail cards, all 15 return highlights + timeout, navigation does not touch timestamp, memo persistence/print structure');

(async()=>{
  const before=JSON.stringify(saved());
  await button(tree,'선택 내용 복사').props.onClick();
  assert.ok(clipboardText.includes('프로젝트명: 홍길동 고객님 욕실 리모델링'));assert.ok(clipboardText.includes('마지막 수정:'));assert.ok(clipboardText.includes('15 욕실 문틀 하부 / 문턱'));assert.ok(clipboardText.endsWith('새 메모\n줄바꿈 보존'));
  await button(tree,'요약만 복사').props.onClick();
  for(const group of summary)assert.ok(clipboardText.includes(group.text));
  assert.ok(clipboardText.includes('고객명: 홍길동'));assert.ok(clipboardText.includes('새 메모\n줄바꿈 보존'));assert.ok(!clipboardText.includes('15 욕실 문틀 하부 / 문턱'));
  button(tree,'인쇄 / PDF 저장').props.onClick();assert.equal(printCalls,1);assert.equal(JSON.stringify(saved()),before);
  clipboardFailure=true;await button(tree,'요약만 복사').props.onClick();tree=resultRender();assert.ok(byClass(tree,'copyFallback').length);
  const noMemo={...original,memo:'  '};assert.ok(!consultation.consultationSummaryText(noMemo).includes('[업체에 전달할 메모]'));assert.ok(!consultation.consultationText(consultation.consultationRows(noMemo.values),'',noMemo.memo,noMemo.projectInfo).includes('[업체에 전달할 메모]'));
  console.log('PASS clipboard: full details/time/metadata/memo, same-source summary, fallback, empty memo omitted; copy/print do not change storage');
})().catch(error=>{console.error(error);process.exitCode=1;});
