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
const browserWindow = { scrollTo: () => {}, confirm: () => confirmReset, print: () => printCalls++, location: { assign: url => { navigatedTo = url; } } };
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
function click(tree, title) {
  const matches = all(tree, n => n.type === 'button' && text(n).includes(title));
  const button = matches.find(n => ['radio', 'checkbox'].includes(n.props.role)) ?? matches[0];
  assert.ok(button, `Missing button: ${title}`); button.props.onClick(); return render();
}
function sources(tree, source) { return all(tree, n => n.type === 'img' && n.props.src === source); }
function four(tree, source) {
  for (const cls of ['selectedHeroImage', 'selectionHistoryStrip']) {
    const area = all(tree, n => n.props.className === cls)[0];
    // There are multiple option groups; search every choice grid.
    const areas = cls === 'choiceGrid' ? all(tree, n => n.props.className === cls) : [area];
    assert.equal(areas.flatMap(a => sources(a, source)).length, 1, cls);
  }
  assert.equal(all(tree, n => n.props.className === 'summary').flatMap(a => all(a, n => n.type === 'img')).length, 0, 'Summary stays text only');
}
const selection = load(path.join(root, 'data/bathroom-selection'));
const consultation = load(path.join(root, 'data/bathroom-consultation'));
const stateKey = consultation.STORAGE;
const state = () => JSON.parse(storage.get(stateKey)).values;
const plain = value => JSON.parse(JSON.stringify(value));
const groupSection = (tree, key) => all(tree,n => n.props.className === 'choiceGroup' && all(n,c=>c.props.id === `builder-${key}-content`).length)[0];
function mount(current=0,values={},version=3) {
  storage.set(stateKey, JSON.stringify({current, values, version})); slots=[]; params.delete('step'); return render();
}
function choose(tree,key,label) {
  const option=all(groupSection(tree,key),n=>n.type==='button' && ['radio','checkbox'].includes(n.props.role) && text(n)===label)[0];
  assert.ok(option,`${key}: ${label}`);option.props.onClick();return render();
}
assert.equal(builderSteps.length,16);
assert.equal(data.bathroomSteps.length,17);
assert.deepEqual(plain(builderSteps[1].groups.map(g=>g.key)),['jendai','partitionShower','niche']);
assert.deepEqual(plain(groups.find(g=>g.key==='jendai').choices.map(c=>c.id)),['none','keep','remove','new']);
assert.deepEqual(plain(groups.find(g=>g.key==='partitionShower').choices.map(c=>c.name)),['없음','하프 파티션','풀 파티션','고정 유리형 샤워부스','도어형 샤워부스']);
assert.ok(!groups.some(g=>['window','concealed','partition','showerBooth'].includes(g.key)));
assert.deepEqual(plain(builderSteps[4].groups.map(g=>g.key)),['sink','toilet']);
assert.equal(builderSteps[12].key,'accessories');
assert.deepEqual(plain(groups.find(g=>g.key==='accessory').choices.map(c=>c.id)),[]);
let tree=mount(1);
tree=choose(tree,'partitionShower','하프 파티션');tree=choose(tree,'partitionShower','도어형 샤워부스');assert.equal(state().partitionShower,'door-booth');
assert.equal(all(groupSection(tree,'partitionShower'),n=>n.props['aria-checked']===true).length,1);
tree=choose(tree,'jendai','기존 젠다이 유지');tree=choose(tree,'jendai','기존 젠다이 철거');assert.deepEqual(state().jendai,['remove']);
tree=choose(tree,'jendai','젠다이 신설');assert.deepEqual(state().jendai,['remove','new']);
tree=choose(tree,'jendai','없음');assert.deepEqual(state().jendai,['none']);
tree=choose(tree,'jendai','없음');assert.deepEqual(state().jendai,[]);
for(const [key,value,want] of [['partition','half','half-partition'],['partition','full','full-partition'],['showerBooth','fixed','fixed-glass'],['showerBooth','door','door-booth'],['partition','none','none'],['showerBooth','undecided',undefined]]) assert.equal(selection.normalizeBathroomValues({[key]:value}).partitionShower,want);
const legacy={jendai:['sink-ledger','toilet-ledger','shower-ledger','new'],partition:'half-partition',showerBooth:'door-booth',concealed:['concealed-basin'],window:'yes',accessory:['paper-holder','other'],accessoryOther:'기존 직접 입력',sink:'other',sinkOther:'낮은 세면대',toilet:'other',toiletOther:'기존 변기'};
const restored=selection.normalizeBathroomValues(legacy);assert.equal(restored.partitionShower,'half-partition');assert.deepEqual(plain(restored.jendai),['new']);
for(const key of ['concealed','window','partition','showerBooth','accessory']) assert.equal(restored[key],undefined);
assert.equal(restored.accessoryOther,'기존 직접 입력');
for(let current=0;current<17;current++) {
 const migrated=consultation.normalizeProject({current,values:legacy});assert.equal(migrated.current,current<5?current:current-1);assert.equal(consultation.normalizeProject(migrated).current,migrated.current);
}
for(const current of [-100,100,NaN]) {const p=consultation.normalizeProject({current});assert.ok(p.current>=0&&p.current<16);}
tree=mount(4,restored);assert.equal(all(tree,n=>n.props.id==='builder-sink-other')[0].props.value,'낮은 세면대');assert.equal(all(tree,n=>n.props.id==='builder-toilet-other')[0].props.value,'기존 변기');
tree=choose(tree,'sink','탑볼 세면대');tree=choose(tree,'toilet','원피스');assert.equal(state().sink,'top-bowl');assert.equal(state().toilet,'one-piece');
tree=choose(tree,'sink','일반 세면대');assert.equal(state().toilet,'one-piece');
tree=mount(12);const input=()=>all(tree,n=>n.props.id==='builder-accessory-other')[0];assert.equal(input().type,'input');assert.equal(input().props.type,'text');assert.equal(input().props.placeholder,'(ex : 휴지걸이, 수건걸이, 코너 선반· ·)');
const draft='휴지걸이, 수건걸이, 코너 선반';input().props.onChange({target:{value:draft}});tree=render();assert.equal(state().accessoryOther,draft);
slots=[];tree=render();assert.equal(input().props.value,draft);
const row=()=>consultation.consultationRows(state()).find(r=>r.key==='accessory');assert.equal(row().pending,false);assert.equal(row().label,draft);assert.equal(row().choices.length,0);
assert.equal(all(groupSection(tree,'accessory'),n=>['radio','checkbox'].includes(n.props.role)).length,0);
input().props.onChange({target:{value:draft}});tree=render();assert.equal(state().accessory,undefined);assert.equal(row().label,draft);
input().props.onChange({target:{value:'   '}});tree=render();assert.equal(row().pending,true);assert.equal(row().label,'미정');
const complete={};for(const g of groups){const c=g.choices.find(c=>!['other','undecided','consult'].includes(c.id)&&!/unknown|모르겠/.test(c.id+c.name));if(c)complete[g.key]=g.multiple?[c.id]:c.id;}complete.accessoryOther=draft;
const rows=consultation.consultationRows(complete);assert.equal(rows.filter(r=>r.pending).length,0);assert.equal(rows.filter(r=>r.key==='partitionShower').length,1);
const copied=consultation.consultationText(rows,'','');assert.ok(copied.includes('05 세면대 & 변기'));assert.ok(copied.includes('15 욕실 문틀'));assert.ok(copied.includes(draft));assert.ok(!/욕실 창문|매립 설비|세면대 젠다이|변기 젠다이|샤워공간 젠다이/.test(copied));assert.ok(!copied.includes('16 최종 검토'));
tree=mount(15,complete);assert.equal(all(tree,n=>n.props.className==='reviewCategory').length,15);assert.ok(text(tree).includes(draft));assert.ok(text(tree).includes('STEP 16 / 16'));
const Result=load(path.join(root,'app/result/page')).default;slots=[];let resultTree;do {dirty=false;cursor=0;effects=[];resultTree=expand(Result());effects.forEach(f=>f());}while(dirty);
assert.equal(all(resultTree,n=>n.props.className==='sheetStep').length,15);assert.ok(text(resultTree).includes(draft));assert.ok(!/욕실 창문|매립 설비/.test(text(resultTree)));
all(resultTree,n=>n.type==='button'&&text(n)==='인쇄 / PDF 저장')[0].props.onClick();assert.equal(printCalls,1);
all(resultTree,n=>n.type==='button'&&text(n)==='선택 수정')[0].props.onClick();assert.equal(navigatedTo,'/design?step=16');
for(let i=0;i<16;i++){tree=mount(i);const progress=all(tree,n=>n.type==='progress')[0];assert.equal(progress.props.max,16);assert.equal(progress.props.value,i+1);assert.ok(consultation.phases.some(p=>i>=p.start&&i<=p.end));}
params.set('showerBooth','door-booth');tree=mount();assert.equal(state().partitionShower,'door-booth');params.delete('showerBooth');
console.log('PASS: 16 steps, removed fields, radios, independent basin/toilet, legacy migrations, custom text/refresh/exclusivity, counts, summary, report/copy/print, progress and guide links');


// Missing selections are state, never selectable options or image cards.
assert.ok(groups.every(g=>g.choices.every(c=>!/모르겠|undecided|notSure|unknown/.test(c.name+c.id))));
assert.equal(groups.length,25);
assert.equal(consultation.consultationRows({}).filter(r=>r.pending).length,25);
assert.equal(consultation.consultationRows({sink:'top-bowl'}).filter(r=>!r.pending).length,1);
assert.equal(consultation.consultationRows({sink:'top-bowl'}).filter(r=>r.pending).length,24);
for(const value of ['undecided','notSure','unknown','unknown-condition','아직 모르겠어요','아직 모르겠음']) {
 const legacyValues=Object.fromEntries(groups.map(g=>[g.key,g.multiple?[value]:value]));
 const normalized=selection.normalizeBathroomValues(legacyValues);
 assert.equal(Object.values(normalized).flat().length,0);
 assert.ok(consultation.consultationRows(normalized).every(r=>r.label==='미정'&&r.pending));
 tree=mount(15,legacyValues);assert.ok(!/아직 모르겠/.test(text(tree)));assert.equal(all(tree,n=>n.props.className==='reviewPending').length,25);
 assert.ok(!/undecided|notSure|unknown|모르겠/.test(JSON.stringify(state())));
}
for(const [before,after] of [['일반 샤워 수전','shower'],['일반 샤워수전','shower'],['매립 샤워 수전','concealed-shower'],['매립 샤워','concealed-shower']])assert.equal(selection.normalizeBathroomValues({showerFaucet:before}).showerFaucet,after);
assert.equal(selection.normalizeBathroomValues({accessory:'undecided',accessoryOther:'old hidden text'}).accessoryOther,undefined);
assert.deepEqual(plain(selection.normalizeBathroomValues({lighting:['undecided','indirect']})).lighting,['indirect']);
for(const [key,id] of [['bathtub','none'],['partitionShower','none'],['cabinet','none'],['waterproofing','consult'],['drainPosition','consult']]) {
 const r=consultation.consultationRows({[key]:id}).find(r=>r.key===key);assert.equal(r.pending,false);assert.notEqual(r.label,'미정');
}
assert.equal(consultation.consultationRows({sink:'other',sinkOther:''}).find(r=>r.key==='sink').pending,true);
tree=mount(11);tree=choose(tree,'lighting','천장 매립 조명');assert.equal(consultation.consultationRows(state()).find(r=>r.key==='lighting').pending,false);tree=choose(tree,'lighting','천장 매립 조명');assert.equal(consultation.consultationRows(state()).find(r=>r.key==='lighting').label,'미정');
tree=mount();for(let i=0;i<15;i++){assert.equal(all(tree,n=>n.props.className==='builderChoiceCard selected').length,0);assert.equal(all(tree,n=>n.type==='img').length,0);tree=click(tree,'다음');}assert.equal(all(tree,n=>n.type==='progress')[0].props.value,16);assert.equal(consultation.consultationRows(state()).filter(r=>r.pending).length,25);
all(tree,n=>n.props['aria-label']==='세면대 & 변기 수정')[0].props.onClick();tree=render();assert.equal(all(tree,n=>n.type==='progress')[0].props.value,5);assert.equal(all(tree,n=>n.props['aria-checked']===true).length,0);
for(const [id,label] of [['shower','일반 샤워&욕조 수전'],['concealed-shower','매립 샤워&욕조 수전']]) {
 const rows=consultation.consultationRows({showerFaucet:id});assert.equal(rows.find(r=>r.key==='showerFaucet').label,label);assert.ok(consultation.consultationText(rows,'','').includes(label));
}
console.log('PASS: zero unknown options, 25 section counts, legacy unknown migration, empty navigation and review editing, none/consult distinction, multi-select deselection, shower labels');
