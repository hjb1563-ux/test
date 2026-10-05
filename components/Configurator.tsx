'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowLeft, ArrowRight, BookOpen, RotateCcw, X } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import BuilderSelectionSections from './BuilderSelectionSections';
import BuilderDisclosure from './BuilderDisclosure';
import BuilderSiteNotice from './BuilderSiteNotice';
import { updateCustomText, normalizeBathroomValues, selectionLabel, toggleSelection, type BathroomValues } from '../data/bathroom-selection';
import SelectedOptionGallery from './SelectedOptionGallery';
import { normalizeImageHistoryOrder, selectedImageItems } from '../data/bathroom-image-history';
import { defaultBathroomValues, bathroomSteps as legacySteps } from '../data/bathroom-options';
import { builderBathroomSteps as bathroomSteps } from '../data/bathroom-builder-options';
import { guideBySlug } from '../data/guides/catalog';
import { STORAGE, readProject, consultationEditUrl, phases, consultationRows } from '../data/bathroom-consultation';
import ConsultationSummary, { ConsultationCounts } from './ConsultationSummary';

type Values = BathroomValues;

function querySelections(params: URLSearchParams): Values {
  const selected: Values = {};
  bathroomSteps.forEach((step) => step.groups.forEach((group) => {
    const query = params.get(group.key);
    if (!query) return;
    const choice = group.choices.find((item) => item.id === query || item.name === query);
    if (choice) selected[group.key] = group.multiple ? [choice.id] : choice.id;
  }));
  for (const key of ['partition', 'showerBooth', 'showerFaucet']) {
    const query = params.get(key);
    const group = legacySteps.flatMap(step => step.groups).find(group => group.key === key);
    const choice = group?.choices.find(choice => choice.id === query || choice.name === query);
    if (query) selected[key] = choice?.id ?? query;
  }
  const normalized = normalizeBathroomValues(selected);
  // An absent query must not override the saved multi-select with an empty array.
  if (!('showerFaucet' in selected)) delete normalized.showerFaucet;
  return normalized;
}

export default function Configurator() {
  const params = useSearchParams();
  const guideValues = useMemo(() => querySelections(params), [params]);
  const [current, setCurrent] = useState(0);
  const [consultationEditMode, setConsultationEditMode] = useState(false);
  const [values, setValues] = useState<Values>(defaultBathroomValues);
  const [specialNotes, setSpecialNotes] = useState('');
  const [guideOpen, setGuideOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');
  const [resumeStep, setResumeStep] = useState<number | null>(null);
  const [activePreview, setActivePreview] = useState<{ step: number; id: string } | null>(null);
  const [imageHistoryOrder, setImageHistoryOrder] = useState<string[]>([]);
  const rows = consultationRows(values);
  const phase = phases.find(item => current >= item.start && current <= item.end)!;
  const step = bathroomSteps[current];
  const guide = guideBySlug[step.guide];
  const selectedItems = step.groups.flatMap((group) => { const value = values[group.key]; const ids = Array.isArray(value) ? value : value ? [value] : []; return ids.map((id) => ({ title: group.title, choice: group.choices.find((choice) => choice.id === id)! })).filter((item) => item.choice); });
  const historyItems = useMemo(() => {
    const items = new Map(selectedImageItems(values).map(item => [item.id, item]));
    return normalizeImageHistoryOrder(imageHistoryOrder, values).flatMap(id => {
      const item = items.get(id);
      return item ? [item] : [];
    });
  }, [values, imageHistoryOrder]);
  const imageCount = historyItems.length;
  const selectionCount = selectedItems.length + rows.filter(row => row.stepIndex === current && !row.choices.length && !row.pending).length;
  const pendingCount = rows.filter(row => row.pending).length;

  useEffect(() => { setActivePreview(null); }, [current]);

  useEffect(() => {
    document.getElementById('builder-image-history-strip')?.scrollTo({ left: 0, behavior: 'instant' });
  }, [imageHistoryOrder]);

  useEffect(() => {
    if (!hydrated) return;
    document.getElementById('builder-question')?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [current, hydrated]);

  useEffect(() => {
    try {
      const saved = readProject();
      setConsultationEditMode(params.get('returnTo') === 'consultation');
      const restoredValues = normalizeBathroomValues({ ...saved.values, ...guideValues }, bathroomSteps);
      setValues(restoredValues);
      setImageHistoryOrder(normalizeImageHistoryOrder(saved.imageHistoryOrder, restoredValues));
      setActivePreview(null);
      setSpecialNotes(saved.specialNotes);
      const requested = Number(params.get('step'));
      const guideStep = bathroomSteps.findIndex(item => item.groups.some(group => {
        const value = guideValues[group.key];
        return Array.isArray(value) ? value.length > 0 : !!value;
      }));
      if (params.has('step') && Number.isInteger(requested) && requested >= 1 && requested <= bathroomSteps.length) setCurrent(requested - 1);
      else if (guideStep >= 0) setCurrent(guideStep);
      else { setCurrent(saved.current); if (Object.keys(saved.values).length) setResumeStep(saved.current); }
    } catch { setValues(guideValues); setSaveStatus('저장된 내용을 불러오지 못했어요.'); }
    setHydrated(true);
  }, [guideValues]);

  useEffect(() => {
    if (!hydrated) return;
    try { const saved = readProject(); localStorage.setItem(STORAGE, JSON.stringify({ ...saved, values, specialNotes, current, imageHistoryOrder })); setSaveStatus('자동 저장됨'); } catch { setSaveStatus('자동 저장할 수 없어요. 상담 내용을 복사해 보관해주세요.'); }
  }, [values, specialNotes, current, imageHistoryOrder, hydrated]);


  function update(key: string, id: string, multiple?: boolean) {
    const group = step.groups.find(group => group.key === key);
    const choice = group?.choices.find(choice => choice.id === id);
    const before = values[key];
    const selected = Array.isArray(before) ? before.includes(id) : before === id;
    const nextValues = toggleSelection(values, key, id, multiple);
    const hasImage = !selected && choice?.showBuilderImage && choice.builderImage;
    const moodGroup = key === 'wallTileSize' && hasImage ? step.groups.find(group => group.key === 'tile') : undefined;
    const mood = moodGroup?.choices.find(choice => choice.id === nextValues.tile && choice.showBuilderImage);
    setActivePreview(hasImage ? { step: current, id: mood ? `${moodGroup!.title}:${mood.id}` : `${group!.title}:${id}` } : null);
    setImageHistoryOrder(old => {
      const remaining = normalizeImageHistoryOrder(old, nextValues);
      const imageId = `${key}:${id}`;
      return hasImage ? [imageId, ...remaining.filter(item => item !== imageId)] : remaining;
    });
    setValues(nextValues);
  }

  function goToStep(index: number, fromConsultation = consultationEditMode) {
    const next = Math.max(0, Math.min(bathroomSteps.length - 1, index));
    setCurrent(next);
    if (fromConsultation) {
      setConsultationEditMode(true);
      window.history.replaceState(null, '', consultationEditUrl(next));
    }
  }

  const consultationReturn = consultationEditMode && <div className="builderConsultationEdit">
    <span>상담서 수정 중</span>
    <Link className="secondary" href={{ pathname: '/result', query: { plan: encodeURIComponent(JSON.stringify(values)), specialNotes } }}>상담서로 돌아가기</Link>
  </div>;

  const warning = values.sink === 'top-bowl' && values.faucet === 'one-hole'
    ? '볼 세면대와 낮은 수전의 높이 조합을 확인하세요.'
    : '';

  function reset() {
    if (!window.confirm('현재 선택 내용이 삭제됩니다. 처음부터 다시 시작할까요?')) return;
    try { localStorage.removeItem(STORAGE); } catch { setSaveStatus('저장소를 초기화할 수 없어요.'); return; }
    setValues({}); setSpecialNotes(''); setCurrent(0); setResumeStep(null); setActivePreview(null); setImageHistoryOrder([]); setConsultationEditMode(false);
    if (consultationEditMode) window.history.replaceState(null, '', '/design');
  }

  const progress = <section className="builderProgress" aria-label="욕실 구성 진행도">
    <div className="progressHeading"><span>STEP {String(current + 1).padStart(2, '0')} / {bathroomSteps.length}</span><small role="status">{saveStatus}</small></div>
    <progress max={bathroomSteps.length} value={current + 1} aria-label={`${bathroomSteps.length}단계 중 ${current + 1}단계`} />
    <ol>{phases.map(item => <li key={item.title} aria-current={phase === item ? 'step' : undefined}>{item.title}</li>)}</ol>
    <p className="builderPhase">{phase.title}</p>
    <p className="builderProgressHelp">약 5~10분이면 업체에 전달할 욕실 상담서를 만들 수 있습니다.</p>
    {resumeStep !== null && <button className="resumeLink" onClick={() => { goToStep(resumeStep); setResumeStep(null); }}>이어서 만들기 · 저장된 STEP {resumeStep + 1}</button>}
  </section>;

  if (step.key === 'checklist') return <main className="design">
    <header className="designHeader"><Link href="/" className="brand">BATH <i>DESIGNER</i></Link><span>나의 욕실 정리</span><button onClick={reset} aria-label="처음부터 다시 만들기"><RotateCcw size={15} /><span className="resetFull">처음부터 다시 만들기</span><span className="resetShort">초기화</span></button></header>
    {progress}
    <div className="designGrid finalGrid">
      <section className="options finalCheck">
        <div className="stepMeta">STEP {bathroomSteps.length} / {bathroomSteps.length} <span>상담 전 최종 검토</span></div>
        {consultationReturn}
        <h1 id="builder-question" tabIndex={-1}>최종 검토</h1>
        <p className="stepIntro">지금까지 선택한 내용을 확인해주세요.</p>
        <ConsultationCounts rows={rows} />
        <p className="consultationNote">카테고리 기준 집계 · 현장 확인은 선택 완료·미결정 항목과 겹칠 수 있습니다.</p>
        <ConsultationSummary rows={rows} onEdit={index => goToStep(index, true)} />
        <section className="builderSpecialNotes">
          <h2><label htmlFor="builder-special-notes">특이사항</label></h2>
          <p id="builder-special-notes-help">업체에 미리 전달하고 싶은 내용이 있다면 적어주세요.</p>
          <textarea id="builder-special-notes" aria-describedby="builder-special-notes-help" maxLength={500} value={specialNotes}
            placeholder="업체에 전달하고 싶은 요청이나 특이사항을 적어주세요."
            onChange={event => setSpecialNotes(event.target.value.slice(0, 500))} />
          <small>{specialNotes.length} / 500</small>
          <style>{`
            .design .builderSpecialNotes p{font-size:12px;color:var(--muted);line-height:1.5}
            .design .builderSpecialNotes textarea{box-sizing:border-box;display:block;width:100%;min-height:130px;padding:12px;border:1px solid var(--line);border-radius:8px;background:#fcfbf8;color:var(--ink);font:14px/1.6 'Noto Sans KR',sans-serif;resize:vertical}
            .design .builderSpecialNotes textarea:focus-visible{outline:2px solid var(--accent);outline-offset:3px}
            .design .builderSpecialNotes small{display:block;margin-top:6px;text-align:right;font-size:11px;color:var(--muted)}
          `}</style>
        </section>
        <div className="navButtons"><button className="secondary" onClick={() => goToStep(bathroomSteps.length - 2)}>이전</button><Link className="button" href={{ pathname: '/result', query: { plan: encodeURIComponent(JSON.stringify(values)), specialNotes } }}>욕실 리모델링 상담서 보기 <ArrowRight size={17} /></Link></div>
      </section>
    </div>
    <nav className="mobileBuilderNav" aria-label="최종 검토 이동"><button className="secondary" onClick={() => goToStep(bathroomSteps.length - 2)}>이전</button><span>{bathroomSteps.length} / {bathroomSteps.length}</span><Link className="button" href={{ pathname: '/result', query: { plan: encodeURIComponent(JSON.stringify(values)), specialNotes } }}>상담서 보기</Link></nav>
  </main>;

  return <main className="design">
    <header className="designHeader"><Link href="/" className="brand">BATH <i>DESIGNER</i></Link><span>내 욕실 만들기</span><button onClick={reset} aria-label="처음부터 다시 만들기"><RotateCcw size={15} /><span className="resetFull">처음부터 다시 만들기</span><span className="resetShort">초기화</span></button></header>
    {progress}
    <div className="designGrid">
      <section className="options">
        <div className="stepMeta">STEP {String(current + 1).padStart(2, '0')} / {bathroomSteps.length} <span>{step.title}</span></div>
        {consultationReturn}
        <div className="stepHeading"><h1 id="builder-question" tabIndex={-1}>{step.question}</h1><button className="guideButton" onClick={() => setGuideOpen(true)}><BookOpen size={15} /> 가이드 보기</button></div>
        {current === 0 && <p className="stepIntro builderFirstHint">모르는 항목은 선택하지 않고 넘어가도 괜찮아요. 선택하지 않은 항목은 자동으로 미정으로 정리됩니다.</p>}
        <BuilderSiteNotice placement="mobile" />
        <BuilderSelectionSections key={step.key} groups={step.groups} values={values} onSelect={update} onCustomText={(key, text) => { setActivePreview(null); setValues(old => updateCustomText(old, key, text)); }} />
        {warning && <div className="selectionWarning"><AlertTriangle size={16} /><div>{warning}<small>확인이 필요한 조합입니다. 실제 시공 가능 여부는 현장에서 확인하세요.</small></div></div>}
        <div className="navButtons"><button className="secondary" disabled={current === 0} onClick={() => goToStep(current - 1)}><ArrowLeft size={17} /> 이전</button><button className="secondary" onClick={() => goToStep(current + 1)}>건너뛰기</button><button className="button" onClick={() => goToStep(current + 1)}>다음 <ArrowRight size={17} /></button></div>
      </section>
      <BuilderDisclosure key={`preview-${step.key}`} id="builder-preview" title="선택한 욕실 미리보기" count={imageCount} className={`builderPreviewPanel${imageCount ? '' : ' builderPreviewPanel--empty'}`}>
        <SelectedOptionGallery items={historyItems} activePreview={activePreview?.step === current ? activePreview.id : null} onPreview={id => setActivePreview({ step: current, id })} empty="옵션을 선택하면 시공 예시 이미지가 여기에 표시됩니다." />
      </BuilderDisclosure>
      <BuilderDisclosure key={`summary-${step.key}`} id="builder-summary" title="현재 선택" count={selectionCount} className="builderSummaryPanel">
        <section className="summary"><h2>현재 욕실 선택 요약</h2><p className="builderSummaryCounts">선택 {rows.length - pendingCount} · 미정 {pendingCount}<small>전체 카테고리 기준</small></p><h3>{step.title}</h3>{step.groups.map(group => <div className="summaryRow" key={group.key}><div><span>{group.title}</span><b style={selectionLabel(values, group) === '미정' ? { color: 'var(--muted)', fontWeight: 400 } : undefined}>{selectionLabel(values, group)}</b></div></div>)}</section>
      </BuilderDisclosure>
    </div>
    <nav className="mobileBuilderNav" aria-label="단계 이동"><button className="secondary" disabled={current === 0} onClick={() => goToStep(current - 1)}>이전</button><span>{current + 1} / {bathroomSteps.length}</span><button className="button" onClick={() => goToStep(current + 1)}>다음</button></nav>
    {guideOpen && <div className="guideDrawer" role="dialog" aria-modal="true"><div><button className="drawerClose" onClick={() => setGuideOpen(false)} aria-label="가이드 닫기"><X size={18} /></button><span>GUIDE</span><h2>{guide?.title}</h2><p>{guide?.oneLine}</p>{guide?.options.slice(0, 3).map((option) => <article key={option.id}><b>{option.title}</b><p>{option.shortDescription}</p></article>)}<Link className="button" href={`/guide/${step.guide}`}>전체 가이드 보기</Link></div></div>}
  </main>;
}
