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
const browserWindow = { history: { replaceState: (_state, _title, url) => { navigatedTo = url; } }, scrollTo: () => {}, confirm: () => confirmReset, print: () => printCalls++, location: { assign: url => { navigatedTo = url; } } };
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

const consultation=load(path.join(root,'data/bathroom-consultation'));
const saved=()=>JSON.parse(storage.get(consultation.STORAGE));
function fresh(project,query='') {slots=[];params.forEach((v,k)=>params.delete(k));new URLSearchParams(query).forEach((v,k)=>params.set(k,v));storage.clear();if(project)storage.set(consultation.STORAGE,JSON.stringify(project));return render();}
const form=t=>all(t,n=>n.type==='form')[0];
function enter(t,id,value){all(t,n=>n.type==='input'&&n.props.id===id)[0].props.onChange({target:{value}});return render();}
function submit(t){all(t,n=>n.type==='button'&&/욕실 만들기 시작|프로젝트 정보 저장/.test(text(n)))[0].props.onClick();return render();}
let tree=fresh();form(tree).props.onSubmit({preventDefault(){}});tree=render();assert.ok(form(tree),'implicit submit must not start the Builder');assert.equal(all(tree,n=>n.type==='progress').length,0);assert.ok(text(tree).includes('프로젝트 정보'));tree=submit(tree);assert.ok(text(tree).includes('고객명 또는 프로젝트명 중 하나를 입력해주세요.'));
for(const [name,project] of [['홍길동',''],['','서초동 욕실 리모델링'],['홍길동','홍길동 고객님 욕실 리모델링']]) {tree=fresh();tree=enter(tree,'project-customer-name','  '+name+'  ');tree=enter(tree,'project-name','  '+project+'  ');tree=submit(tree);assert.equal(all(tree,n=>n.type==='progress')[0].props.value,1);assert.deepEqual(saved().projectInfo,{customerName:name,projectName:project});}
const legacy={version:3,current:7,values:{sink:'top-bowl',showerFaucet:['rain']},specialNotes:'메모',memo:'상담 메모',checks:{},imageHistoryOrder:['showerFaucet:rain']};
tree=fresh(legacy);assert.ok(form(tree));assert.equal(all(tree,n=>n.type==='progress').length,0);tree=enter(tree,'project-name','고객 프로젝트');tree=submit(tree);assert.equal(all(tree,n=>n.type==='progress')[0].props.value,8);const before=JSON.stringify(saved().values);const history=JSON.stringify(saved().imageHistoryOrder);
all(tree,n=>n.type==='button'&&n.props['aria-label']==='프로젝트 정보 수정')[0].props.onClick();tree=render();tree=enter(tree,'project-name','수정 프로젝트');tree=submit(tree);assert.equal(all(tree,n=>n.type==='progress')[0].props.value,8);assert.equal(JSON.stringify(saved().values),before);assert.equal(JSON.stringify(saved().imageHistoryOrder),history);assert.equal(saved().memo,'상담 메모');
tree=fresh(saved());assert.equal(all(tree,n=>n.type==='progress')[0].props.value,8);assert.equal(form(tree),undefined);
const rows=consultation.consultationRows(saved().values);assert.equal(rows.length,consultation.consultationRows(legacy.values).length);assert.ok(consultation.consultationText(rows,'','',saved().projectInfo).includes('프로젝트명: 수정 프로젝트'));
confirmReset=true;all(tree,n=>n.type==='button'&&n.props['aria-label']==='처음부터 다시 만들기')[0].props.onClick();tree=render();assert.ok(form(tree));assert.equal(saved().projectInfo.projectName,'');assert.equal(Object.keys(saved().values).length,0);
for(const step of builderSteps)for(const group of step.groups){if(group.choices.some(c=>c.requiresCustomText)){const code=fs.readFileSync(path.join(root,'components/BuilderChoiceGroup.tsx'),'utf8');assert.ok(code.includes(group.key+':'),group.key+' placeholder');}}
assert.equal(builderSteps.length,16);console.log('PASS project info: empty/name/project/both/trim, legacy resume, refresh, edit preserves selections/history/memo/counts, copy, reset, custom placeholders, 16 steps');

let count=2;for(let i=0;i<builderSteps.length;i++){tree=fresh({version:3,current:i,values:{},projectInfo:{customerName:'검증 고객',projectName:''}});assert.equal(all(tree,n=>n.type==='progress')[0].props.value,i+1);for(const g of builderSteps[i].groups){for(const c of g.choices.filter(c=>c.requiresCustomText)){const b=all(tree,n=>n.type==='button'&&n.props.role===(g.multiple?'checkbox':'radio')&&text(n)===c.name);const button=b.find(n=>all(tree,n=>n.props.id==='builder-'+g.key+'-content')[0]&&all(all(tree,n=>n.props.id==='builder-'+g.key+'-content')[0],x=>x===n).length);assert.ok(button);button.props.onClick();tree=render();const field=all(tree,n=>n.type==='input'&&n.props.id==='builder-'+g.key+'-other')[0];assert.ok(field.props.placeholder);assert.equal(field.props.value,'');count++;}if(['accessory','ventilation'].includes(g.key))count++;}}
assert.equal(count,17);console.log('PASS all 16 steps and 17 editable text inputs (including 2 project fields); custom fields preserve empty values and have contextual placeholders');

const Result=load(path.join(root,'app/result/page')).default;
function resultRender(){let tree,rounds=0;do{dirty=false;cursor=0;effects=[];tree=expand(Result());effects.forEach(fn=>fn());assert.ok(++rounds<20);}while(dirty);return tree;}
fresh({...legacy,projectInfo:{customerName:'고객명',projectName:'최신 프로젝트'}});slots=[];tree=resultRender();assert.ok(text(tree).includes('최신 프로젝트'));assert.ok(text(tree).includes('고객명 · 고객명'));const identity=all(tree,n=>n.props.className==='sheetProjectInfo')[0];assert.ok(identity&&!identity.props.className.includes('printHide'));
all(tree,n=>n.type==='button'&&text(n)==='인쇄 / PDF 저장')[0].props.onClick();assert.equal(printCalls,1);
(async()=>{await all(tree,n=>n.type==='button'&&text(n)==='선택 내용 복사')[0].props.onClick();assert.ok(clipboardText.includes('프로젝트명: 최신 프로젝트'));assert.ok(clipboardText.includes('고객명: 고객명'));all(tree,n=>n.type==='button'&&n.props['aria-label']==='방수 수정')[0].props.onClick();assert.ok(navigatedTo.includes('step=3'));assert.equal(saved().projectInfo.projectName,'최신 프로젝트');console.log('PASS consultation identity, print visibility/action, copy metadata, consultation edit retains identity');})().catch(e=>{console.error(e);process.exitCode=1;});
