'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowLeft, ArrowRight, BookOpen, RotateCcw, X } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import BuilderChoiceGroup from './BuilderChoiceGroup';
import { customTextKey, normalizeBathroomValues, selectionLabel, toggleSelection, type BathroomValues } from '../data/bathroom-selection';
import BuilderOptionImage from './BuilderOptionImage';
import SelectedOptionGallery from './SelectedOptionGallery';
import DesignVisualStyles from './DesignVisualStyles';
import { defaultBathroomValues } from '../data/bathroom-options';
import { builderBathroomSteps as bathroomSteps } from '../data/bathroom-builder-options';
import { guideBySlug } from '../data/guides/catalog';
import { STORAGE, readProject, phases, stepReasons, consultationRows } from '../data/bathroom-consultation';
import ConsultationSummary, { ConsultationCounts } from './ConsultationSummary';

type Values = BathroomValues;
const prioritiesList = ['디자인', '청소 편의', '수납', '공간감', '관리 편의', '물튐 방지', '반신욕', '샤워 편의', '아이와 사용', '오래 사용하기', '호텔 같은 분위기', '밝은 분위기'];

function querySelections(params: URLSearchParams): Values {
  const selected: Values = {};
  bathroomSteps.forEach((step) => step.groups.forEach((group) => {
    const query = params.get(group.key);
    if (!query) return;
    const choice = group.choices.find((item) => item.id === query || item.name === query);
    if (choice) selected[group.key] = group.multiple ? [choice.id] : choice.id;
  }));
  return selected;
}

export default function Configurator() {
  const params = useSearchParams();
  const guideValues = useMemo(() => querySelections(params), [params]);
  const [current, setCurrent] = useState(0);
  const [values, setValues] = useState<Values>(defaultBathroomValues);
  const [priorities, setPriorities] = useState<string[]>([]);
  const [guideOpen, setGuideOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');
  const [resumeStep, setResumeStep] = useState<number | null>(null);
  const rows = consultationRows(values);
  const phase = phases.find(item => current >= item.start && current <= item.end)!;
  const step = bathroomSteps[current];
  const guide = guideBySlug[step.guide];
  const selectedItems = step.groups.flatMap((group) => { const value = values[group.key]; const ids = Array.isArray(value) ? value : value ? [value] : []; return ids.map((id) => ({ title: group.title, choice: group.choices.find((choice) => choice.id === id)! })).filter((item) => item.choice); });

  useEffect(() => {
    try {
      const saved = readProject();
      setValues(normalizeBathroomValues({ ...saved.values, ...guideValues }, bathroomSteps));
      setPriorities(saved.priorities);
      const requested = Number(params.get('step'));
      const guideStep = bathroomSteps.findIndex(item => item.groups.some(group => guideValues[group.key]));
      if (params.has('step') && Number.isInteger(requested) && requested >= 1 && requested <= 17) setCurrent(requested - 1);
      else if (guideStep >= 0) setCurrent(guideStep);
      else { setCurrent(saved.current); if (Object.keys(saved.values).length) setResumeStep(saved.current); }
    } catch { setValues(guideValues); setSaveStatus('저장된 내용을 불러오지 못했어요.'); }
    setHydrated(true);
  }, [guideValues]);

  useEffect(() => {
    if (!hydrated) return;
    try { const saved = readProject(); localStorage.setItem(STORAGE, JSON.stringify({ ...saved, values, priorities, current })); setSaveStatus('자동 저장됨'); } catch { setSaveStatus('자동 저장할 수 없어요. 상담 내용을 복사해 보관해주세요.'); }
  }, [values, priorities, current, hydrated]);

  useEffect(() => {
    setValues((old) => {
      const concealed = Array.isArray(old.concealed) ? old.concealed : [];
      const next = { ...old };
      if (concealed.includes('concealed-basin') && !next.faucet) next.faucet = 'concealed';
      if (concealed.includes('concealed-shower') && !next.showerFaucet) next.showerFaucet = ['concealed-shower'];
      return next;
    });
  }, [values.concealed]);

  function update(key: string, id: string, multiple?: boolean) {
    setValues(old => toggleSelection(old, key, id, multiple));
  }

  const warning = values.sink === 'top-bowl' && values.faucet === 'one-hole'
    ? '볼 세면대와 낮은 수전의 높이 조합을 확인하세요.'
    : values.partition === 'full-partition' && values.showerBooth && values.showerBooth !== 'none'
        ? '샤워부스와 전체 파티션을 함께 사용할 계획인지 확인해보세요.' : '';

  function reset() {
    if (!window.confirm('현재 선택 내용이 삭제됩니다. 처음부터 다시 시작할까요?')) return;
    try { localStorage.removeItem(STORAGE); } catch { setSaveStatus('저장소를 초기화할 수 없어요.'); return; }
    setValues({}); setPriorities([]); setCurrent(0); setResumeStep(null);
  }

  const progress = <section className="builderProgress" aria-label="욕실 구성 진행도">
    <div className="progressHeading"><span>욕실 구성하기 · {current + 1} / 17</span><small role="status">{saveStatus}</small></div>
    <progress max={17} value={current + 1} aria-label={`17단계 중 ${current + 1}단계`} />
    <ol>{phases.map(item => <li key={item.title} aria-current={phase === item ? 'step' : undefined}>{item.title}</li>)}</ol>
    <p>약 5~10분이면 업체에 전달할 욕실 상담서를 만들 수 있습니다.</p>
    <div className="mobileSelectionCounts"><ConsultationCounts rows={rows} /><p>카테고리 기준 · 미결정은 상담하며 정해도 괜찮아요.</p></div>
    {resumeStep !== null && <button className="resumeLink" onClick={() => { setCurrent(resumeStep); setResumeStep(null); }}>이어서 만들기 · 저장된 STEP {resumeStep + 1}</button>}
  </section>;

  if (step.key === 'checklist') return <main className="design">
    <DesignVisualStyles />
    <header className="designHeader"><Link href="/" className="brand">BATH <i>DESIGNER</i></Link><span>나의 욕실 정리</span><button onClick={reset}><RotateCcw size={15} /> 처음부터 다시 만들기</button></header>
    {progress}
    <div className="designGrid finalGrid">
      <section className="options finalCheck">
        <div className="stepMeta">STEP 17 / 17 <span>상담 전 최종 검토</span></div>
        <h1>원하는 욕실이 맞는지 마지막으로 확인해보세요.</h1>
        <p className="stepIntro">{stepReasons[16]}</p>
        <ConsultationCounts rows={rows} />
        <p className="consultationNote">카테고리 기준 집계 · 현장 확인은 선택 완료·미결정 항목과 겹칠 수 있습니다.</p>
        <ConsultationSummary rows={rows} onEdit={setCurrent} />
        <h2>내 우선순위 (최대 3개)</h2>
        <div className="priorityList">{prioritiesList.map((item) => <button key={item} aria-pressed={priorities.includes(item)} className={priorities.includes(item) ? 'on' : ''} onClick={() => setPriorities((old) => old.includes(item) ? old.filter((value) => value !== item) : old.length < 3 ? [...old, item] : old)}>{item}</button>)}</div>
        <div className="navButtons"><button className="secondary" onClick={() => setCurrent(15)}>이전</button><Link className="button" href={{ pathname: '/result', query: { plan: encodeURIComponent(JSON.stringify(values)), priorities: priorities.join('|') } }}>욕실 리모델링 상담서 보기 <ArrowRight size={17} /></Link></div>
      </section>
      <aside className="live"><SelectedOptionGallery items={bathroomSteps.slice(0,16).flatMap((item)=>item.groups.flatMap((group)=>{const value=values[group.key];const ids=Array.isArray(value)?value:value?[value]:[];return ids.map(id=>({title:item.title,choice:group.choices.find(choice=>choice.id===id)!})).filter(item=>item.choice)}))} /></aside>
    </div>
    <nav className="mobileBuilderNav" aria-label="최종 검토 이동"><button className="secondary" onClick={() => setCurrent(15)}>이전</button><span>17 / 17</span><Link className="button" href={{ pathname: '/result', query: { plan: encodeURIComponent(JSON.stringify(values)), priorities: priorities.join('|') } }}>상담서 보기</Link></nav>
  </main>;

  return <main className="design">
    <DesignVisualStyles />
    <header className="designHeader"><Link href="/" className="brand">BATH <i>DESIGNER</i></Link><span>내 욕실 만들기</span><button onClick={reset}><RotateCcw size={15} /> 처음부터 다시 만들기</button></header>
    {progress}
    <div className="designGrid">
      <section className="options">
        <div className="stepMeta">STEP {String(current + 1).padStart(2, '0')} / 17 <span>{step.title}</span></div>
        <div className="stepHeading"><h1>{step.question}</h1><button className="guideButton" onClick={() => setGuideOpen(true)}><BookOpen size={15} /> 가이드 보기</button></div>
        <p className="stepIntro"><strong>왜 선택하나요?</strong><br />{stepReasons[current]}</p>
        <p className="stepIntro">모르는 항목은 ‘아직 모르겠어요’로 남겨도 괜찮습니다.</p>
        {step.groups.map(group => <BuilderChoiceGroup key={group.key} group={group} values={values} onSelect={update} onCustomText={(key, text) => setValues(old => ({ ...old, [customTextKey(key)]: text }))} />)}
        {warning && <div className="selectionWarning"><AlertTriangle size={16} /><div>{warning}<small>확인이 필요한 조합입니다. 실제 시공 가능 여부는 현장에서 확인하세요.</small></div></div>}
        <div className="navButtons"><button className="secondary" disabled={current === 0} onClick={() => setCurrent((index) => index - 1)}><ArrowLeft size={17} /> 이전</button><button className="secondary" onClick={() => setCurrent((index) => Math.min(16, index + 1))}>건너뛰기</button><button className="button" onClick={() => setCurrent((index) => Math.min(16, index + 1))}>선택 완료 <ArrowRight size={17} /></button></div>
      </section>
      <aside className="live"><SelectedOptionGallery items={selectedItems} empty="이 단계에서 선택한 항목이 사진과 함께 표시됩니다." /><section className="summary"><h2>현재 욕실 선택 요약</h2><ConsultationCounts rows={rows} /><p className="consultationNote">카테고리 기준 · 미결정은 상담하며 정해도 괜찮아요.</p>{bathroomSteps.slice(0, current + 1).flatMap((item) => item.groups.map((group) => { const value=values[group.key]; const first=group.choices.find(choice=>choice.id===(Array.isArray(value)?value[0]:value)); return <div className="summaryRow" key={group.key}>{first?.showBuilderImage&&<BuilderOptionImage option={first} />}<div><span>{group.title}</span><b style={{ whiteSpace: 'normal', overflowWrap: 'anywhere' }}>{selectionLabel(values, group)}</b></div></div> }))}</section></aside>
    </div>
    <nav className="mobileBuilderNav" aria-label="단계 이동"><button className="secondary" disabled={current === 0} onClick={() => setCurrent(current - 1)}>이전</button><span>{current + 1} / 17</span><button className="button" onClick={() => setCurrent(Math.min(16, current + 1))}>다음</button></nav>
    {guideOpen && <div className="guideDrawer" role="dialog" aria-modal="true"><div><button className="drawerClose" onClick={() => setGuideOpen(false)} aria-label="가이드 닫기"><X size={18} /></button><span>GUIDE</span><h2>{guide?.title}</h2><p>{guide?.oneLine}</p>{guide?.options.slice(0, 3).map((option) => <article key={option.id}><b>{option.title}</b><p>{option.shortDescription}</p></article>)}<Link className="button" href={`/guide/${step.guide}`}>전체 가이드 보기</Link></div></div>}
  </main>;
}
