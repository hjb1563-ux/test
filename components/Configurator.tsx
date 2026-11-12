'use client';

import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import Link from 'next/link';
import { FEATURE_FLAGS } from '../config/features';
import { notifyCustomerLocalSave, notifyCustomerLocalReset } from '../data/customer-builder-cloud';
import { AlertTriangle, ArrowLeft, ArrowRight, RotateCcw, X } from 'lucide-react';
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
import { STORAGE, readProject, consultationEditUrl, phases, consultationRows, updateProjectContent } from '../data/bathroom-consultation';
import ProjectInfoForm from './ProjectInfoForm';
import { inspectProject, isActiveProject, activateProject } from '../data/bathroom-project-entry';

import BathroomStylePreview from './BathroomStylePreview';
import { createStyleDraft, readStyleDraft, writeStyleDraft, withStyleDraft, styleDraftNotice } from '../data/bathroom-style-draft';
import ProjectIdentity from './ProjectIdentity';
import { hasProjectInfo, normalizeProjectInfo, type ProjectInfo } from '../data/bathroom-consultation';


import { getVisibleSteps, getNavigableSteps, nearestVisibleStep } from '../data/bathroom-builder-mode';

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
  const draftId = params.get('styleDraft');
  const [entry, setEntry] = useState<'loading' | 'choice' | 'error' | 'ready'>('loading');
  const [entryStep, setEntryStep] = useState<number | null>(null);
  const [retryEntry, setRetryEntry] = useState(0);
  const [loadedQuery, setLoadedQuery] = useState<string | null>(null);
  const writeAllowed = useRef(false);
  const resetBusy = useRef(false);
  const entryExitAt = useRef(0);
  const entryTitle = useRef<HTMLHeadingElement>(null);
  const query = params.toString();
  const draftStarting = useRef(false);
  const [draftError, setDraftError] = useState(false);
  const mobileNavigation = useRef(false);
  const visitedSections = useRef(new Map<number, number>());
  const guideValues = useMemo(() => querySelections(params), [params]);
  const [projectInfo, setProjectInfo] = useState<ProjectInfo>(() => normalizeProjectInfo(null));
  const [projectFormOpen, setProjectFormOpen] = useState(true);
  const [stylePreviewOpen, setStylePreviewOpen] = useState(false);
  const [current, setCurrent] = useState(0);
  const [sectionPosition, setSectionPosition] = useState({ step: 0, index: 0 });
  const [consultationEditMode, setConsultationEditMode] = useState(false);
  const [lastEditedCategory, setLastEditedCategory] = useState<string | null>(null);
  const [values, setValues] = useState<Values>(defaultBathroomValues);
  const [specialNotes, setSpecialNotes] = useState('');
  const [guideOpen, setGuideOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');
  const [activePreview, setActivePreview] = useState<{ step: number; id: string; fromHistory?: boolean } | null>(null);
  const [imageHistoryOrder, setImageHistoryOrder] = useState<string[]>([]);
  const mode = projectInfo.builderMode;
  const numberedSteps = getVisibleSteps(mode);
  const visibleSteps = getNavigableSteps(mode, values);
  const stepNumber = (index: number) => numberedSteps.findIndex(item => item.stepIndex === index) + 1;
  const visibleCurrent = nearestVisibleStep(current, mode, values);
  const displayIndex = visibleSteps.findIndex(item => item.stepIndex === visibleCurrent);
  const totalSteps = visibleSteps.length;
  const isLastStep = displayIndex === totalSteps - 1;
  const consultationHref = { pathname: '/result', query: { plan: encodeURIComponent(JSON.stringify(values)), builderMode: mode, specialNotes, ...(draftId ? { styleDraft: draftId } : {}) } };
  const previousStep = visibleSteps[Math.max(0, displayIndex - 1)].stepIndex;
  const nextStep = visibleSteps[Math.min(totalSteps - 1, displayIndex + 1)].stepIndex;
  const rows = consultationRows(values, mode);
  const phase = phases.find(item => visibleCurrent >= item.start && visibleCurrent <= item.end)!;
  const step = visibleSteps[displayIndex];
  const activeSectionIndex = sectionPosition.step === current ? Math.min(sectionPosition.index, Math.max(0, step.groups.length - 1)) : 0;
  const guide = guideBySlug[step.guide];
  const selectedItems = step.groups.flatMap((group) => { const value = values[group.key]; const ids = Array.isArray(value) ? value : value ? [value] : []; return ids.map((id) => ({ title: group.title, choice: group.choices.find((choice) => choice.id === id)! })).filter((item) => item.choice); });
  const historyItems = useMemo(() => {
    const visibleGroups = new Map(getVisibleSteps(mode).flatMap(step => step.groups.map(group => [group.key, group] as const)));
    const items = new Map(selectedImageItems(values).filter(item => visibleGroups.has(item.id.split(':')[0])).map(item => [item.id, { ...item, title: visibleGroups.get(item.id.split(':')[0])!.title, choice: { ...item.choice, name: visibleGroups.get(item.id.split(':')[0])!.choices.find(choice => choice.id === item.choice.id)!.name } }]));
    return normalizeImageHistoryOrder(imageHistoryOrder, values).flatMap(id => {
      const item = items.get(id);
      return item ? [item] : [];
    });
  }, [values, imageHistoryOrder, mode]);
  const currentSection = step.groups[activeSectionIndex];
  const mobilePreviewId = historyItems.find(item => item.id.startsWith(`${currentSection.key}:`))?.id ?? null;
  const mobilePreviewContext = JSON.stringify([step.key, currentSection.key, values[currentSection.key] ?? null]);
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
    if (mobileNavigation.current && window.matchMedia('(max-width: 767px)').matches) {
      document.getElementById('builder-question')?.scrollIntoView({ block: 'start', behavior: 'instant' });
    } else window.scrollTo({ top: 0, behavior: 'instant' });
    mobileNavigation.current = false;
  }, [current, hydrated]);

  useEffect(() => {
    if (!hydrated || !mobileNavigation.current || !window.matchMedia('(max-width: 767px)').matches) return;
    document.getElementById('builder-question')?.focus({ preventScroll: true });
    document.getElementById('builder-question')?.scrollIntoView({ block: 'start', behavior: 'instant' });
    mobileNavigation.current = false;
  }, [activeSectionIndex, hydrated]);

  useEffect(() => {
    writeAllowed.current = false;
    try {
      const snapshot = draftId ? null : inspectProject();
      const requestedStep = Number(params.get('step'));
      // Old final-STEP links use the legacy catalog; restoration below migrates them.
      const explicitStep = params.has('step') && Number.isInteger(requestedStep) && requestedStep >= 1 && requestedStep <= (snapshot?.sourceStepCount ?? bathroomSteps.length);
      const explicitEntry = explicitStep || params.get('returnTo') === 'consultation' || params.get('projectInfo') === '1' || Object.keys(guideValues).length > 0;
      if (snapshot && snapshot.meaningful && !explicitEntry && !isActiveProject(snapshot.raw)) {
        setEntryStep(snapshot.stepNumber); setEntry('choice'); setHydrated(true); return;
      }
      restoreProject(snapshot?.project ?? readStyleDraft(draftId!).project, snapshot ? !snapshot.meaningful : false);
      if (snapshot && explicitEntry) activateProject(snapshot.raw);
    } catch { if (draftId) setDraftError(true); setEntry('error'); setHydrated(true); }
  }, [guideValues, retryEntry]);

  useEffect(() => {
    if (entry === 'ready') document.getElementById('builder-question')?.focus({ preventScroll: true });
    else if (entry !== 'loading') entryTitle.current?.focus();
  }, [entry]);
  useEffect(() => { if (entry === 'ready' && stylePreviewOpen) resetBusy.current = false; }, [entry, stylePreviewOpen]);

  function restoreProject(saved: ReturnType<typeof readProject>, fresh = false) {
    setConsultationEditMode(params.get('returnTo') === 'consultation');
    const restoredValues = normalizeBathroomValues({ ...saved.values, ...guideValues }, bathroomSteps);
    setValues(restoredValues);
    setImageHistoryOrder(normalizeImageHistoryOrder(saved.imageHistoryOrder, restoredValues));
    setActivePreview(null);
    setSpecialNotes(saved.specialNotes);
    setProjectInfo(saved.projectInfo);
    setProjectFormOpen(draftId ? params.get('projectInfo') === '1' : !hasProjectInfo(saved.projectInfo));
    // Old drafts, deep links and saved projects keep their existing entry point.
    setStylePreviewOpen(fresh && params.size === 0);
    const requested = Number(params.get('step'));
    const guideStep = bathroomSteps.findIndex(item => item.groups.some(group => {
      const value = guideValues[group.key];
      return Array.isArray(value) ? value.length > 0 : !!value;
    }));
    if (params.has('step') && Number.isInteger(requested) && requested >= 1 && requested <= bathroomSteps.length) setCurrent(nearestVisibleStep(requested - 1, saved.projectInfo.builderMode, restoredValues));
    else if (guideStep >= 0) setCurrent(nearestVisibleStep(guideStep, saved.projectInfo.builderMode, restoredValues));
    else setCurrent(nearestVisibleStep(saved.current, saved.projectInfo.builderMode, restoredValues));
    setLoadedQuery(query); setEntry('ready'); setHydrated(true); writeAllowed.current = true;
  }

  function continueProject() {
    if (entry !== 'choice') return;
    try { const snapshot = inspectProject(); entryExitAt.current = Date.now(); restoreProject(snapshot.project, !snapshot.meaningful); activateProject(snapshot.raw); }
    catch { writeAllowed.current = false; setEntry('error'); }
  }

  function guardEntryDoubleClick(event: MouseEvent<HTMLElement>) {
    if (event.detail > 1 && Date.now() - entryExitAt.current < 600) { event.preventDefault(); event.stopPropagation(); }
  }

  function backupProject() {
    try {
      const raw = localStorage.getItem(STORAGE);
      if (raw === null) throw new Error('No data');
      const url = URL.createObjectURL(new Blob([raw], { type: 'application/json' }));
      const link = document.createElement('a'); link.href = url; link.download = 'bath-designer-backup.json'; link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setSaveStatus('원본 파일을 다운로드했어요. 파일을 보관한 뒤 새로 시작할 수 있어요.');
    } catch { setSaveStatus('원본을 내보낼 수 없어요. 브라우저 저장소 설정을 확인해주세요.'); }
  }

  useEffect(() => {
    if (!writeAllowed.current || entry !== 'ready' || loadedQuery !== query || !hydrated || stylePreviewOpen || draftError) return;
    if (draftId) {
      try { const saved = readStyleDraft(draftId).project; writeStyleDraft(draftId, updateProjectContent(saved, { values, specialNotes, current, imageHistoryOrder, projectInfo })); setSaveStatus('임시 초안'); } catch { setDraftError(true); }
      return;
    }
    try { const saved = inspectProject().project; const next = updateProjectContent(saved, { values, specialNotes, current, imageHistoryOrder, projectInfo }); localStorage.setItem(STORAGE, JSON.stringify(next)); activateProject(JSON.stringify(next)); notifyCustomerLocalSave(next); setSaveStatus('자동 저장됨'); } catch { setSaveStatus('자동 저장할 수 없어요. 상담 내용을 복사해 보관해주세요.'); }
  }, [values, specialNotes, current, imageHistoryOrder, projectInfo, hydrated, stylePreviewOpen, draftId, draftError, entry, loadedQuery, query]);


  function update(key: string, id: string, multiple?: boolean) {
    const group = step.groups.find(group => group.key === key);
    const choice = group?.choices.find(choice => choice.id === id);
    const before = values[key];
    const selected = Array.isArray(before) ? before.includes(id) : before === id;
    const nextValues = toggleSelection(values, key, id, multiple);
    if (consultationEditMode) setLastEditedCategory(step.key);
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

  function goToStep(index: number, fromConsultation = consultationEditMode, sectionIndex = 0) {
    const next = nearestVisibleStep(Math.max(0, Math.min(bathroomSteps.length - 1, index)), mode, values);
    visitedSections.current.set(current, activeSectionIndex);
    mobileNavigation.current = true;
    setCurrent(next);
    setSectionPosition({ step: next, index: sectionIndex });
    setActivePreview(null);
    if (fromConsultation) {
      setConsultationEditMode(true);
      window.history.replaceState(null, '', withStyleDraft(consultationEditUrl(next), draftId));
    }
  }

  function goToSection(index: number) {
    mobileNavigation.current = true;
    setSectionPosition({ step: current, index: Math.max(0, Math.min(step.groups.length - 1, index)) });
    setActivePreview(null);
    document.querySelector('.builderSelectionScroll')?.scrollTo({ top: 0, behavior: 'instant' });
  }

  function compactPrevious() {
    if (activeSectionIndex > 0) goToSection(activeSectionIndex - 1);
    else goToStep(previousStep, consultationEditMode, window.matchMedia('(max-width: 767px)').matches ? visitedSections.current.get(previousStep) ?? 0 : 0);
  }

  function compactNext() {
    if (activeSectionIndex < step.groups.length - 1) goToSection(activeSectionIndex + 1);
    else goToStep(nextStep);
  }

  const consultationReturn = consultationEditMode && <div className="builderConsultationEdit">
    <span>상담서 수정 중</span>
    <Link className="secondary" href={{ ...consultationHref, query: { ...consultationHref.query, ...(lastEditedCategory || current < bathroomSteps.length - 1 ? { editedCategory: lastEditedCategory ?? step.key } : {}) } }}>상담서로 돌아가기</Link>
  </div>;

  const warning = step.key === 'faucet' && values.sink === 'top-bowl' && values.faucet === 'one-hole'
    ? '탑볼 세면대와 낮은 수전의 높이 조합을 확인하세요'
    : '';

  function reset(confirmed = false) {
    if (draftId) { window.location.assign('/design'); return; }
    if (confirmed !== true && !window.confirm('현재 선택 내용이 삭제됩니다. 처음부터 다시 시작할까요?')) return;
    if (resetBusy.current) return;
    resetBusy.current = true;
    try { localStorage.removeItem(STORAGE); } catch { resetBusy.current = false; setSaveStatus('저장소를 초기화할 수 없어요. 다시 시도해주세요.'); return; }
    entryExitAt.current = Date.now();
    activateProject(null); writeAllowed.current = true; setEntry('ready'); setLoadedQuery(query); setSaveStatus('');
    notifyCustomerLocalReset();
    setProjectInfo(normalizeProjectInfo(null)); setProjectFormOpen(true);
    setStylePreviewOpen(true);
    visitedSections.current.clear();
    setLastEditedCategory(null);
    setSectionPosition({ step: 0, index: 0 });
    setValues({}); setSpecialNotes(''); setCurrent(0); setActivePreview(null); setImageHistoryOrder([]); setConsultationEditMode(false);
    if (consultationEditMode) window.history.replaceState(null, '', '/design');
  }

  const progress = <section className="builderProgress" aria-label="욕실 구성 진행도">
    <div className="progressHeading"><span>STEP {String(stepNumber(visibleCurrent)).padStart(2, '0')} / {numberedSteps.length}</span><small className={saveStatus === '자동 저장됨' || !saveStatus ? 'builderSaveQuiet' : undefined} role="status">{saveStatus}</small></div>
    <progress max={totalSteps} value={displayIndex + 1} aria-label={`${totalSteps}단계 중 ${displayIndex + 1}단계`} />
    <ol>{phases.map(item => <li key={item.title} aria-current={phase === item ? 'step' : undefined}>{item.title}</li>)}</ol>
    <p className="builderPhase">{phase.title}</p>
  </section>;

  if (!hydrated) return <main className="design"><p role="status">저장된 욕실 구성을 불러오는 중입니다.</p></main>;
  if (draftError) return <main className="design"><p role="alert">임시 초안을 불러오지 못했습니다. 기존 프로젝트는 유지됩니다.</p><Link href="/design">내 욕실 만들기로 돌아가기</Link></main>;
  if (entry !== 'ready') return <main className="design">
    <header className="designHeader"><Link href="/" className="brand">BATH <i>DESIGNER</i></Link><span>내 욕실 만들기</span></header>
    <section className="projectEntry" aria-labelledby="project-entry-title">
      <h1 ref={entryTitle} id="project-entry-title" tabIndex={-1}>{entry === 'error' ? '저장된 내용을 불러오지 못했어요' : '이전에 만들던 욕실이 있어요'}</h1>
      {entry === 'error' && <p>저장된 원본은 그대로 보관돼요. 브라우저 저장소 설정을 확인하고 다시 시도해주세요.</p>}
      {entry === 'choice' && entryStep !== null && <p className="projectEntryStep">최근 작업 · STEP {String(entryStep).padStart(2, '0')}</p>}
      <div className="projectEntryActions">
        {entry === 'choice' ? <><button className="button" onClick={continueProject}>이어서 만들기</button><button className="secondary" aria-describedby="project-new-help" onClick={() => reset(true)}>새로 만들기</button></> : <><button className="button" onClick={() => { setEntry('loading'); setHydrated(false); setRetryEntry(x => x + 1); }}>다시 불러오기</button><button className="secondary" onClick={backupProject}>저장 원본 내보내기</button><button className="secondary" aria-describedby="project-new-help" onClick={() => reset(true)}>새로 만들기</button><Link className="secondary" href="/">홈으로 돌아가기</Link></>}
      </div>
      {saveStatus && <p role="alert">{saveStatus}</p>}
      <small id="project-new-help">새로 만들면 이 브라우저의 기존 기본 프로젝트가 삭제돼요.</small>
    </section>
  </main>;
  if (stylePreviewOpen) return <main className="design" onClickCapture={guardEntryDoubleClick}>
    <header className="designHeader"><Link href="/" className="brand">BATH <i>DESIGNER</i></Link><span>내 욕실 만들기</span></header>
    <BathroomStylePreview onContinue={() => { setStylePreviewOpen(false); setProjectFormOpen(true); }} onCreateDraft={exampleId => {
      if (draftStarting.current) return;
      draftStarting.current = true;
      try { const id = createStyleDraft(exampleId, projectInfo); window.location.assign(withStyleDraft('/result', id)); }
      catch { draftStarting.current = false; window.alert('초안을 만들지 못했습니다. 기존 프로젝트는 유지됩니다.'); }
    }} />
  </main>;
  if (projectFormOpen) return <main className="design" onClickCapture={guardEntryDoubleClick}>
    <header className="designHeader"><Link href="/" className="brand">BATH <i>DESIGNER</i></Link><span>내 욕실 만들기</span></header>
    {!hasProjectInfo(projectInfo) && <button type="button" className="secondary" style={{ margin: '16px 20px 0' }} onClick={() => setStylePreviewOpen(true)}><ArrowLeft size={16} aria-hidden="true" /> 욕실 스타일 미리보기로 이전</button>}
    <ProjectInfoForm key={JSON.stringify(projectInfo)} initial={projectInfo} editing={hasProjectInfo(projectInfo)} onSave={info => { const next = nearestVisibleStep(current, info.builderMode, values); setProjectInfo(info); setCurrent(next); setSectionPosition({ step: next, index: 0 }); setActivePreview(null); setProjectFormOpen(false); }} onCancel={draftId || hasProjectInfo(projectInfo) ? () => setProjectFormOpen(false) : undefined} />
  </main>;

  return <main className="design builderCompactFlow" onClickCapture={guardEntryDoubleClick}>
    <header className="designHeader"><Link href="/" className="brand">BATH <i>DESIGNER</i></Link><span>내 욕실 만들기</span><button onClick={() => reset()} aria-label="처음부터 다시 만들기"><RotateCcw size={15} /><span className="resetFull">처음부터 다시 만들기</span><span className="resetShort">초기화</span></button></header>
    <ProjectIdentity info={projectInfo} onEdit={() => setProjectFormOpen(true)} />
    {draftId && <p className="consultationNote">{styleDraftNotice} 기존 프로젝트와 분리된 임시 초안입니다.</p>}
    {progress}
    <div className="designGrid">
      <section className="options">
        <div className="stepMeta">STEP {String(stepNumber(visibleCurrent)).padStart(2, '0')} / {numberedSteps.length} <span>{step.title}</span></div>
        {consultationReturn}
        <div className="stepHeading"><h1 id="builder-question" tabIndex={-1}>{step.question}</h1></div>
        <div className="builderSelectionScroll" data-section-count={step.groups.length} key={step.key} tabIndex={0} role="region" aria-label="현재 단계 선택 옵션">
        <div className="builderSelectionHelp">
        {current === 0 && <p className="stepIntro builderFirstHint">
          <span className="builderFirstHintLine">모르는 항목은 선택하지 않고 넘어가도 괜찮아요.</span>{' '}
          <span className="builderFirstHintLine">선택하지 않은 항목은 자동으로 미정으로 정리됩니다.</span>
        </p>}
        <BuilderSiteNotice placement="mobile" />
        <p className="builderMobileHint">선택하지 않고 넘어가도 괜찮아요.</p>
        </div>
        <BuilderSelectionSections key={step.key} mode={mode} groups={step.groups} activeSectionIndex={activeSectionIndex} values={values} onSelect={update} onCustomText={(key, text) => { if (consultationEditMode && values[`${key}Other`] !== text) setLastEditedCategory(step.key); setActivePreview(null); setValues(old => updateCustomText(old, key, text)); }} />

        {warning && <div className="selectionWarning"><AlertTriangle size={16} /><div>{warning}<small>확인이 필요한 조합입니다. 실제 시공 가능 여부는 현장에서 확인하세요.</small></div></div>}
        </div>
        <div className="navButtons"><button className="secondary" disabled={current === 0} onClick={() => goToStep(previousStep)}><ArrowLeft size={17} /> 이전</button>{!isLastStep && <button className="secondary" onClick={() => goToStep(nextStep)}>건너뛰기</button>}{isLastStep ? <Link className="button" href={consultationHref}>상담서 보기 <ArrowRight size={17} /></Link> : <button className="button" onClick={() => goToStep(nextStep)}>다음 <ArrowRight size={17} /></button>}</div>
      </section>
      <BuilderDisclosure id="builder-preview" title="선택한 욕실 미리보기" count={imageCount} className={`builderPreviewPanel${imageCount ? '' : ' builderPreviewPanel--empty'}`}>
        <SelectedOptionGallery mobileGallery mobilePreviewId={mobilePreviewId} mobilePreviewContext={mobilePreviewContext} items={historyItems} activePreview={activePreview?.step === current ? activePreview.id : null} onPreview={id => setActivePreview({ step: current, id, fromHistory: true })} empty="옵션을 선택하면 시공 예시 이미지가 여기에 표시됩니다." />
      </BuilderDisclosure>
      <BuilderDisclosure key={`summary-${step.key}`} id="builder-summary" title="현재 선택" count={selectionCount} className={`builderSummaryPanel${selectionCount === 0 ? ' builderSummaryPanel--zero' : ''}`}>
        <section className="summary" data-empty={selectionCount === 0}>{selectionCount === 0 && <p className="builderSummaryEmpty">아직 선택한 항목이 없습니다.</p>}<h2>현재 욕실 선택 요약</h2><p className="builderSummaryCounts">선택 {rows.filter(row => row.status !== 'excluded').length - pendingCount} · 미정 {pendingCount}<small>전체 카테고리 기준</small></p><h3>{step.title}</h3>{step.groups.map(group => <div className="summaryRow" key={group.key}><div><span>{group.title}</span><b style={selectionLabel(values, group) === '미정' ? { color: 'var(--muted)', fontWeight: 400 } : undefined}>{selectionLabel(values, group)}</b></div></div>)}</section>
      </BuilderDisclosure>
    </div>
    <nav data-at-start={displayIndex === 0 && activeSectionIndex === 0} data-section-count={step.groups.length} className="mobileBuilderNav" aria-label="단계 및 항목 이동">
      <button className="secondary" disabled={current === 0 && activeSectionIndex === 0} onClick={compactPrevious}>{activeSectionIndex > 0 ? '이전 항목' : '이전'}</button>
      <span>{stepNumber(visibleCurrent)} / {numberedSteps.length}</span>
      {!isLastStep && <button className="secondary builderCompactSkip" aria-label="현재 STEP 전체 건너뛰기" title="이 STEP의 남은 항목을 모두 건너뜁니다" onClick={() => goToStep(nextStep)}>건너뛰기</button>}
      {isLastStep && activeSectionIndex === step.groups.length - 1 ? <Link className="button" href={consultationHref}>상담서 보기 →</Link> : <button className="button" onClick={compactNext}>{activeSectionIndex < step.groups.length - 1 ? '다음 항목 →' : 'STEP ' + String(stepNumber(nextStep)).padStart(2, '0') + '으로 →'}</button>}
    </nav>
    {guideOpen && <div className="guideDrawer" role="dialog" aria-modal="true"><div><button className="drawerClose" onClick={() => setGuideOpen(false)} aria-label="가이드 닫기"><X size={18} /></button><span>GUIDE</span><h2>{guide?.title}</h2><p>{guide?.oneLine}</p>{guide?.options.slice(0, 3).map((option) => <article key={option.id}><b>{option.title}</b><p>{option.shortDescription}</p></article>)}{FEATURE_FLAGS.remodelingGuide && (<Link className="button" href={`/guide/${step.guide}`}>전체 가이드 보기</Link>)}</div></div>}
  </main>;
}
