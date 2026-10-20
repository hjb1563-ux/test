const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f);
const m=require('../data/bathroom-builder-mode.ts'),c=require('../data/bathroom-consultation.ts'),s=require('../data/bathroom-selection.ts');
const {builderBathroomSteps}=require('../data/bathroom-builder-options.ts');
const cases=[['overlay','덧방','덧방'],['full-demolition','올철거','전체 철거'],['partial-demolition-overlay','부분철거','부분 철거 + 덧방']];
test('STEP01 shares existing options and IDs without modifying professional catalog',()=>{
 const original=JSON.stringify(builderBathroomSteps);const customer=m.getVisibleSteps('consumer'),pro=m.getVisibleSteps('professional');
 assert.equal(customer.length,10);assert.equal(pro.length,15);assert.deepEqual(customer[0].groups.map(g=>g.key),['demolition','bathroomCondition']);
 assert.deepEqual(customer[0].groups[0].choices.map(c=>c.id),cases.map(c=>c[0]));assert.ok(!customer[0].groups[0].multiple);
 for(const [id,label,expert] of cases){const choice=customer[0].groups[0].choices.find(c=>c.id===id),source=pro[0].groups[0].choices.find(c=>c.id===id);assert.equal(choice.name,label);assert.equal(source.name,expert);assert.deepEqual({...choice,name:expert},source)}
 assert.equal(JSON.stringify(builderBathroomSteps),original);
});
for(const [id,label,expert] of cases)test('shared selection, deselection and report mapping: '+id,()=>{
 let values=s.toggleSelection({},'demolition',id);assert.equal(values.demolition,id);assert.ok(!s.toggleSelection(values,'demolition',id).demolition);
 const project=c.normalizeProject({version:3,values,projectInfo:{builderMode:'consumer'},imageHistoryOrder:['demolition:'+id]});
 for(const mode of ['consumer','professional','consumer']){const p=c.normalizeProject({...project,projectInfo:{...project.projectInfo,builderMode:mode}});assert.deepEqual(p.values,project.values);assert.deepEqual(p.imageHistoryOrder,project.imageHistoryOrder);const name=mode==='consumer'?label:expert;assert.equal(c.consultationRows(p.values,mode).find(r=>r.key==='demolition').label,name);assert.ok(c.consultationSummaryText(p).includes(name));assert.ok(c.consultationText(c.consultationRows(p.values),'','',p.projectInfo).includes('시공 방식: '+name))}
});
test('visible pending/completed count and output skip only unanswered customer rows',()=>{const empty=c.consultationRows({},'consumer');assert.ok(empty.find(r=>r.key==='demolition').pending);assert.equal(c.consultationOutputRows({},'consumer').length,0);const values={demolition:'full-demolition',bathroomCondition:['leak']};const filled=c.consultationRows(values,'consumer');assert.equal(filled.filter(r=>!r.pending).length,2);assert.equal(c.consultationOutputRows(values,'consumer').length,2);assert.equal(s.toggleSelection(values,'demolition','overlay').demolition,'overlay')});
