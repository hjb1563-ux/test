'use client';

import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { calendarDate, numericDigits, formatBudgetNumber, hasProjectInfo, normalizeProjectInfo, type ProjectInfo } from '../data/bathroom-consultation';

export default function ProjectInfoForm({ initial, editing, onSave, onCancel }: { initial: ProjectInfo; editing?: boolean; onSave: (info: ProjectInfo) => void; onCancel?: () => void }) {
  const [draft, setDraft] = useState(initial);
  const [dateParts, setDateParts] = useState(() => (initial.constructionDate ?? '--').split('-'));
  const dateValue = calendarDate(dateParts[0], dateParts[1], dateParts[2]);
  const dateMessage = dateParts.some(Boolean) && !dateValue ? (dateParts.every(Boolean) ? '실제 달력에 있는 날짜를 입력해주세요.' : '날짜를 모두 입력해주세요.') : '';
  const [invalid, setInvalid] = useState(false);
  function saveProjectInfo() {
    const info = normalizeProjectInfo({ ...draft, constructionDate: dateValue });
    if (!hasProjectInfo(info)) { setInvalid(true); return; }
    onSave(info);
  }

  return <section className="projectInfoForm">
    <div className="eyebrow">BATHROOM / PROJECT</div>
    <h1>프로젝트 정보</h1>
    <p>이 욕실 상담서를 구분할 정보를 입력해주세요.</p>
    <form onSubmit={event => event.preventDefault()}>
      <section className="projectInfoSection" aria-labelledby="project-basic-heading">
      <header className="projectSectionHeader">
        <h2 id="project-basic-heading"><span>01</span>기본 정보</h2>
        <p>프로젝트를 구분하기 위한 정보를 입력해주세요.</p>
      </header>
      <label htmlFor="project-customer-name">고객명 / 이름</label>
      <input id="project-customer-name" type="text" autoComplete="name" maxLength={40} placeholder="예: 홍길동" value={draft.customerName} aria-describedby={invalid ? 'project-info-validation' : undefined} onChange={event => { setDraft({ ...draft, customerName: event.target.value }); setInvalid(false); }} />
      <label htmlFor="project-name">프로젝트명</label>
      <input id="project-name" type="text" maxLength={80} placeholder="예: 홍길동 고객님 욕실 리모델링" value={draft.projectName} aria-describedby={invalid ? 'project-info-validation' : undefined} onChange={event => { setDraft({ ...draft, projectName: event.target.value }); setInvalid(false); }} />
      {invalid && <p id="project-info-validation" role="status">고객명 또는 프로젝트명 중 하나를 입력해주세요.</p>}
      </section>
      <section className="projectInfoSection" aria-labelledby="project-site-heading">
      <header className="projectSectionHeader">
        <h2 id="project-site-heading"><span>02</span>현장 정보</h2>
        <span className="projectSectionOptional">선택 입력</span>
        <p>시공 장소의 기본 정보를 입력해주세요.</p>
      </header>
      <div className="projectFieldGrid">
        <fieldset className="projectOptions"><legend>건물 유형</legend><div role="radiogroup" aria-label="건물 유형">{(['아파트', '빌라', '상가'] as const).map(option => <button type="button" role="radio" aria-checked={draft.propertyType === option} className={draft.propertyType === option ? 'selected' : ''} key={option} onClick={() => setDraft({ ...draft, propertyType: option, occupancyStatus: option === '상가' ? null : draft.occupancyStatus })}>{option}</button>)}</div></fieldset>
        {draft.propertyType !== '상가' && <fieldset className="projectOptions"><legend>거주 여부</legend><div role="radiogroup" aria-label="거주 여부">{(['살고 있다', '이사갈 곳이다'] as const).map(option => <button type="button" role="radio" aria-checked={draft.occupancyStatus === option} className={draft.occupancyStatus === option ? 'selected' : ''} key={option} onClick={() => setDraft({ ...draft, occupancyStatus: option })}>{option}</button>)}</div></fieldset>}
      </div>
      <label htmlFor="project-area">평수</label><div className="projectSuffixInput"><input id="project-area" inputMode="numeric" pattern="[0-9]*" maxLength={4} placeholder="예: 34" value={draft.areaPyeong} onChange={event => setDraft({ ...draft, areaPyeong: numericDigits(event.target.value, 4) })} /><span>평</span></div>
      </section>
      <section className="projectInfoSection" aria-labelledby="project-schedule-heading">
      <header className="projectSectionHeader">
        <h2 id="project-schedule-heading"><span>03</span>일정 / 예산</h2>
        <span className="projectSectionOptional">선택 입력</span>
        <p>정해진 정보가 있다면 입력해주세요.</p>
      </header>
      <fieldset className="projectDate"><legend>시공 예정일</legend><div className="projectDateInputs">{['년', '월', '일'].map((suffix, index) => <div className="projectSuffixInput" key={suffix}><label className="sr-only" htmlFor={'project-date-' + index}>{['시공 예정 연도', '시공 예정 월', '시공 예정 일'][index]}</label><input id={'project-date-' + index} inputMode="numeric" pattern="[0-9]*" maxLength={index === 0 ? 4 : 2} placeholder={['2026', '12', '31'][index]} value={dateParts[index]} aria-describedby={dateMessage ? 'project-date-message' : undefined} onChange={event => setDateParts(dateParts.map((value, i) => i === index ? numericDigits(event.target.value, index === 0 ? 4 : 2) : value))} /><span>{suffix}</span></div>)}</div>{dateMessage && <p id="project-date-message" role="status">{dateMessage} 예정일 없이 시작할 수 있어요.</p>}</fieldset>
      <label htmlFor="project-budget">예산</label><div className="projectSuffixInput"><input id="project-budget" inputMode="numeric" value={formatBudgetNumber(draft.budget)} placeholder="10,000,000" onKeyDown={event => {
        const input = event.currentTarget, position = input.selectionStart;
        if (position !== null && input.selectionEnd === position && ((event.key === 'Backspace' && input.value[position - 1] === ',') || (event.key === 'Delete' && input.value[position] === ','))) {
          const next = event.key === 'Backspace' ? position - 1 : position + 1;
          input.setSelectionRange(next, next);
        }
      }} onChange={event => {
        const input = event.currentTarget;
        const position = input.selectionStart ?? input.value.length;
        const digitsBefore = numericDigits(input.value.slice(0, position), 13).length;
        const digits = numericDigits(input.value, 13);
        const budget = digits ? Number(digits) : null;
        setDraft({ ...draft, budget });
        const formatted = formatBudgetNumber(budget);
        let caret = 0, seen = 0;
        while (caret < formatted.length && seen < digitsBefore) { if (/[0-9]/.test(formatted[caret])) seen++; caret++; }
        requestAnimationFrame(() => { if (document.activeElement === input) input.setSelectionRange(caret, caret); });
      }} /><span>원 이내</span></div>
      </section>
      <div className="navButtons">{onCancel && <button type="button" className="secondary" onClick={onCancel}>취소</button>}<button type="button" className="button" onClick={saveProjectInfo}>{editing ? '프로젝트 정보 저장' : '욕실 만들기 시작'}{!editing && <ArrowRight size={17} aria-hidden="true" />}</button></div>
    </form>
  </section>;
}
