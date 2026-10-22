const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript'),{createRequire}=require('node:module');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f);
const {builderBathroomSteps:steps}=require('../data/bathroom-builder-options.ts'),{getVisibleSteps}=require('../data/bathroom-builder-mode.ts');
const c=require('../data/bathroom-consultation.ts'),s=require('../data/bathroom-selection.ts');
const source=require('../data/bathroom-options.ts').bathroomSteps;
const group=key=>steps.flatMap(s=>s.groups).find(g=>g.key===key);
const jendai=group('jendai'),threshold=group('threshold');
assert.deepEqual(jendai.choices.map(c=>c.id),['none','keep','remove','new']);
assert.equal(jendai.choices.find(c=>c.id==='keep').name,'기존 젠다이 유지');
assert.equal(jendai.choices.find(c=>c.id==='keep').sub,'덧방·부분철거 시');
for(const id of ['none','remove','new'])assert.equal(jendai.choices.find(c=>c.id===id).name,source.flatMap(s=>s.groups).find(g=>g.key==='jendai').choices.find(c=>c.id===id).name);
assert.deepEqual(threshold.choices.map(c=>c.id),['threshold-keep','threshold-tile','threshold-artificial-stone']);
assert.equal(threshold.choices[0].name,'기존 문턱 유지');
assert.equal(threshold.choices.filter(c=>/유지|철거.*(?:안|않|X)/.test(c.name)).length,1);
assert.equal(threshold.multiple,false);
assert.equal(threshold.choices[0].builderImage,null);assert.equal(threshold.choices[0].showBuilderImage,false);
for(const mode of ['consumer','professional']){
 const visible=getVisibleSteps(mode);assert.equal(visible.length,mode==='consumer'?10:15);
 assert.equal(visible.findIndex(step=>step.key==='layout'),1);assert.equal(visible.findIndex(step=>step.key==='threshold'),mode==='consumer'?9:14);
 const values={jendai:['keep'],threshold:'threshold-keep',tile:'white',bathtub:'none'},raw=JSON.stringify(values);
 const project=c.normalizeProject({version:3,values,projectInfo:{builderMode:mode},memo:'기존 메모',specialNotes:'기존 특이사항',imageHistoryOrder:['tile:white']});
 assert.deepEqual(project.values.jendai,['keep']);assert.equal(project.values.threshold,'threshold-keep');
 const rows=c.consultationOutputRows(project.values,mode);
 assert.equal(rows.find(r=>r.key==='jendai').label,'기존 젠다이 유지');assert.equal(rows.find(r=>r.key==='threshold').label,'기존 문턱 유지');
 for(const text of [c.consultationSummaryText(project),c.consultationText(rows,project.specialNotes,project.memo,project.projectInfo)]){
  for(const label of ['기존 젠다이 유지','기존 문턱 유지'])assert.ok(text.includes(label));
  assert.ok(!text.includes('기존 젠다이 유지(덧방용)'));assert.ok(!text.includes('덧방 또는 부분철거 시'));
 }
 assert.equal(JSON.stringify(values),raw);
 assert.equal(s.toggleSelection(values,'threshold','threshold-keep').threshold,'');
 assert.equal(s.toggleSelection(values,'threshold','threshold-tile').threshold,'threshold-tile');
 assert.equal(c.normalizeProject({...project,projectInfo:{...project.projectInfo,builderMode:mode==='consumer'?'professional':'consumer'}}).values.threshold,'threshold-keep');
 for(const id of ['threshold-tile','threshold-artificial-stone']){
  const old=c.normalizeProject({version:3,values:{threshold:id,thresholdOther:'기존 직접 입력'},projectInfo:{builderMode:mode}});
  assert.equal(old.values.threshold,id);
 }
 assert.ok(!c.consultationSummaryText(c.normalizeProject({values:{},projectInfo:{builderMode:mode}})).includes('문턱 마감:'));
}
// When running inside the active workspace, compare every shared group with the
// pre-task snapshot to prove that no unrelated professional options changed.
const before=path.join(__dirname,'artifacts/jendai-threshold/before/data/bathroom-builder-options.ts.txt');
if(fs.existsSync(before)){
 const module={exports:{}};const filename=path.resolve(__dirname,'../data/bathroom-builder-options.ts');
 const code=ts.transpileModule(fs.readFileSync(before,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 new Function('require','module','exports',code)(createRequire(filename),module,module.exports);
 const baseline=module.exports.builderBathroomSteps;
 for(const [i,step]of steps.entries()){
  assert.equal(step.key,baseline[i].key);assert.equal(step.title,baseline[i].title);
  for(const [j,current]of step.groups.entries()){
   const previous=baseline[i].groups[j];
   if(current.key==='threshold')assert.deepEqual(current.choices.slice(1),previous.choices);
   else if(current.key==='jendai')assert.deepEqual(current.choices.map(c=>c.id==='keep'?{...c,name:'기존 젠다이 유지',sub:previous.choices.find(p=>p.id==='keep').sub}:c),previous.choices);
   else assert.deepEqual(current,previous);
  }
 }
}
console.log('PASS jendai-threshold: stable keep ID, first unique threshold-keep, old selections/options/images preserved, both modes and exports, no storage migration');
