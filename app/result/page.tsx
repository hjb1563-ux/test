'use client';

import { getVisibleSteps, builderModeLabel } from '../../data/bathroom-builder-mode';
import { Suspense, useEffect, useRef, useState } from 'react';
import { copyConsultationImage } from '../../data/consultation-image';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import SiteHeader from '../../components/SiteHeader';
import { builderBathroomSteps as steps } from '../../data/bathroom-builder-options';
import { normalizeBathroomValues } from '../../data/bathroom-selection';
import { projectMetadata, STORAGE, consultationEditUrl, readProject, normalizeProject, consultationOutputRows, consultationSummaryText, generateConsultationSummary, formatLastModified, updateProjectContent, type LocalProject } from '../../data/bathroom-consultation';

function Content() {
  const params = useSearchParams();
  const [project, setProject] = useState<LocalProject>(() => normalizeProject(null));
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState('');
  const [saveStatus, setSaveStatus] = useState('');
  const [copyFallback, setCopyFallback] = useState('');
  const [metadataKey, setMetadataKey] = useState(STORAGE);
  const [highlightedCategory, setHighlightedCategory] = useState<string | null>(null);
  const consultationCaptureRef = useRef<HTMLElement>(null);
  const imageCopyBusyRef = useRef(false);
  const [imageCopyBusy, setImageCopyBusy] = useState(false);

  useEffect(() => {
    const category = params.get('editedCategory');
    if (!category) return;
    if (steps.slice(0, -1).some(step => step.key === category)) setHighlightedCategory(category);
    const query = new URLSearchParams(params.toString());
    query.delete('editedCategory');
    window.history.replaceState(window.history.state, '', `/result${query.size ? `?${query}` : ''}`);
  }, []);

  useEffect(() => {
    if (!highlightedCategory) return;
    const timer = window.setTimeout(() => setHighlightedCategory(null), 1500);
    return () => window.clearTimeout(timer);
  }, [highlightedCategory]);

  useEffect(() => {
    let saved = normalizeProject(null);
    try { saved = readProject(); } catch { setSaveStatus('저장된 내용을 불러오지 못했어요.'); }
    let next = saved;
    if (params.has('plan')) {
      try {
        const source = params.get('plan')!;
        let parsed: unknown;
        try { parsed = JSON.parse(source); } catch { parsed = JSON.parse(decodeURIComponent(source)); }
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Invalid plan');
        const values = normalizeBathroomValues(parsed, steps);
        const same = JSON.stringify(values) === JSON.stringify(saved.values);
        const key = same ? STORAGE : `bath-designer-report-v1:${JSON.stringify(values)}`;
        setMetadataKey(key);
        let metadata = same ? saved : normalizeProject(null);
        if (!same) { try { metadata = normalizeProject(JSON.parse(localStorage.getItem(key) ?? '{}')); } catch {} }
        next = { ...metadata, projectInfo: { ...metadata.projectInfo, builderMode: params.get('builderMode') === 'consumer' ? 'consumer' : params.get('builderMode') === 'professional' ? 'professional' : same ? saved.projectInfo.builderMode : 'professional' }, values, specialNotes: params.has('specialNotes') ? (params.get('specialNotes') ?? '').slice(0, 500) : metadata.specialNotes };
      } catch { setStatus('링크의 선택 내용을 읽지 못해 이 기기에 저장된 상담서를 표시합니다.'); }
    }
    setProject(next); setReady(true);
  }, [params]);

  const mode = project.projectInfo.builderMode;
  const rows = consultationOutputRows(project.values, mode);
  const allVisibleSteps = getVisibleSteps(mode);
  const visibleSteps = allVisibleSteps.filter(step => mode === 'professional' || rows.some(row => row.stepIndex === step.stepIndex));
  const columnSize = Math.max(1, Math.ceil(visibleSteps.length / 2));
  const summary = generateConsultationSummary(project.values, mode);
  const modified = formatLastModified(project.lastModifiedAt);
  const metadata = projectMetadata(project.projectInfo);
  const siteMetadata = metadata.filter(line => !line.startsWith('시공 예정 ·') && !line.startsWith('예산 ·'));
  const scheduleMetadata = metadata.filter(line => line.startsWith('시공 예정 ·') || line.startsWith('예산 ·'));
  const displayProjectTitle = project.projectInfo.projectName || (project.projectInfo.customerName ? `${project.projectInfo.customerName} 고객님 욕실 리모델링` : '');

  function updateMetadata(patch: Partial<Pick<LocalProject, 'memo' | 'checks' | 'specialNotes'>>) {
    let next = updateProjectContent(project, patch);
    try {
      const base = metadataKey === STORAGE ? readProject() : project;
      next = updateProjectContent(base, patch);
      localStorage.setItem(metadataKey, JSON.stringify(next));
      setSaveStatus('자동 저장됨');
    } catch { setSaveStatus('자동 저장할 수 없어요. 복사 또는 인쇄로 보관해주세요.'); }
    setProject(next);
    if (patch.specialNotes !== undefined && params.has('specialNotes')) {
      const query = new URLSearchParams(params.toString());
      query.set('specialNotes', next.specialNotes);
      window.history.replaceState(window.history.state, '', `/result?${query}`);
    }
  }

  async function copy() {
    const text = consultationSummaryText(project);
    try { await navigator.clipboard.writeText(text); setCopyFallback(''); setStatus('요약을 복사했어요. 업체에 붙여넣어 전달하세요.'); }
    catch { setCopyFallback(text); setStatus('클립보드에 접근할 수 없어요. 아래 내용을 선택해 직접 복사해주세요.'); }
  }

  async function copyImage() {
    if (imageCopyBusyRef.current || !consultationCaptureRef.current) return;
    imageCopyBusyRef.current = true;
    setImageCopyBusy(true);
    try {
      await copyConsultationImage(consultationCaptureRef.current);
      setStatus('상담서 이미지가 복사되었습니다.');
    } catch { setStatus('상담서 이미지 복사에 실패했습니다.'); }
    finally { imageCopyBusyRef.current = false; setImageCopyBusy(false); }
  }

  function edit(step = allVisibleSteps[0].stepIndex + 1) {
    try {
      localStorage.setItem(STORAGE, JSON.stringify({ ...project, current: step - 1 }));
      window.location.assign(consultationEditUrl(step - 1));
    } catch { setStatus('수정할 내용을 저장하지 못했어요. 요약을 복사하거나 인쇄해 보관해주세요.'); }
  }

  if (!ready) return <main className="result">상담서를 불러오는 중입니다.</main>;
  return <main className="consultationPage">
    <div className="printHide"><SiteHeader /></div>
    <div className="consultationActionsWrap printHide" data-capture-ignore="true">
      <div className="resultActions" role="group" aria-label="상담서 작업"><button className="secondary" onClick={copy}>요약만 복사</button><button className="secondary" disabled={imageCopyBusy} aria-busy={imageCopyBusy} onClick={copyImage}>{imageCopyBusy ? '복사 중...' : '상담서 이미지 복사'}</button><button className="secondary" onClick={() => window.print()}>인쇄 / PDF 저장</button><button className="secondary" onClick={() => edit()}>선택 수정</button></div>
      <p className="consultationNote" role="status">{status}</p>
      {copyFallback && <label className="copyFallback">복사할 상담 내용<textarea readOnly value={copyFallback} onFocus={event => event.currentTarget.select()} /></label>}
    </div>
    <article ref={consultationCaptureRef} className="result consultationSheet unifiedSheet consultationDocument">
      <header className="sheetHeading"><div className="eyebrow">BATHROOM / CONSULTATION</div><h1>욕실 리모델링 상담서</h1>
        <p>내가 선택한 욕실 구성과 업체에 전달할 내용을 한곳에 정리했어요.</p>
        {(displayProjectTitle || modified || mode) && <div className="sheetProjectIdentity">
          {displayProjectTitle && <p className="sheetProjectTitle">{displayProjectTitle}</p>}
          {project.projectInfo.customerName && <p className="sheetProjectInfo"><span><span className="sheetInfoLabel">고객명 ·</span> <span className="sheetCustomerName">{project.projectInfo.customerName}</span></span></p>}
          <p className="sheetProjectInfo">작성 모드 · {builderModeLabel(mode)}</p>
          {siteMetadata.map(line => <p className="sheetProjectInfo" key={line}>{line}</p>)}
          {!!scheduleMetadata.length && <p className="sheetProjectInfo">{scheduleMetadata.map(line => <span key={line}>{line}</span>)}</p>}
          {modified && <p className="sheetProjectInfo"><span className="sheetLastModified">마지막 수정 · <time dateTime={project.lastModifiedAt!}>{modified}</time></span></p>}
        </div>}
      </header>
      <section className="sheetCoreSummary" aria-labelledby="consultation-core-summary"><h2 id="consultation-core-summary">핵심 선택 요약</h2>
        {summary.length ? <dl>{summary.map(group => <div key={group.id}><dt>{group.title}</dt><dd>{group.text}</dd></div>)}</dl> : <p>아직 선택된 주요 항목이 없습니다.</p>}
      </section>
      <section className="sheetSelections"><h2>STEP별 선택 내용</h2>
        <div className="sheetColumns">{[0, columnSize].map(start => <div className="sheetColumn" key={start}>{visibleSteps.slice(start, start + columnSize).map((step, offset) => { const index = allVisibleSteps.findIndex(item => item.key === step.key); return <section id={`consultation-${step.key}`} className={`sheetStep${highlightedCategory === step.key ? ' sheetStep--highlighted' : ''}`} key={step.key}><header><h3><span>{String(index + 1).padStart(2, '0')}</span> {step.title}</h3><button data-capture-ignore="true" className="printHide resumeLink" aria-label={`${step.title} 수정`} onClick={() => edit(step.stepIndex + 1)}>수정</button></header>
          <dl>{rows.filter(row => row.stepIndex === step.stepIndex).map(row => <div className={`sheetRow${row.pending ? ' sheetRow--pending' : ''}`} key={row.key}><dt>{row.title}</dt><dd><strong className={row.label === '미정' ? 'sheetUndecidedValue' : undefined}>{row.choices.length && !row.choices.some(choice => choice.requiresCustomText) ? row.choices.map(choice => choice.name).join(' · ') : row.label}</strong><div className="rowStatus">{row.pending && row.reason !== row.label && <span>{row.reason}</span>}</div>
          </dd></div>)}</dl></section>; })}</div>)}</div>
      </section>
      <section className="sheetMemo"><h2><label htmlFor="consultation-memo">업체에 전달할 메모</label> <small>선택 입력</small></h2><textarea data-capture-ignore="true" id="consultation-memo" className="printHide" value={project.memo} placeholder="예: 청소가 쉬웠으면 좋겠어요. 아이와 함께 사용하는 욕실입니다. 수납공간을 넉넉하게 하고 싶어요." onChange={event => updateMetadata({ memo: event.target.value })} /><p data-capture-text="true" className="printOnly memoPrint">{project.memo.trim() || '별도 메모 없음'}</p><small data-capture-ignore="true" className="printHide" role="status">{saveStatus}</small></section>
      <section className={`sheetMemo${project.specialNotes.trim() ? '' : ' printHide'}`} data-capture-ignore={project.specialNotes.trim() ? undefined : 'true'}><h2><label htmlFor="consultation-special-notes">특이사항</label> <small className="printHide" data-capture-ignore="true">선택 입력</small></h2><textarea data-capture-ignore="true" id="consultation-special-notes" className="printHide" maxLength={500} value={project.specialNotes} placeholder="예: 기존 누수 이력이 있어요. 매립 선반을 추가하고 싶어요." onChange={event => updateMetadata({ specialNotes: event.target.value.slice(0, 500) })} /><p data-capture-text="true" className="printOnly memoPrint">{project.specialNotes}</p></section>
      <p className="sheetFootnote">이 상담서는 고객의 희망 사항을 정리한 자료입니다. 실제 시공 가능 여부와 세부 사양은 업체 실측 후 확인해주세요.</p>
      <Link data-capture-ignore="true" href="/design" className="printHide resumeLink">내 욕실 만들기로 돌아가기</Link>
    </article>
  </main>;
}

export default function Result() { return <Suspense fallback={<main className="result">상담서를 불러오는 중입니다.</main>}><Content /></Suspense>; }
