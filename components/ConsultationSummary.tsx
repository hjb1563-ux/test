import type { ConsultationRow } from '../data/bathroom-consultation';

export function ConsultationCounts({ rows }: { rows: ConsultationRow[] }) {
  const pending = rows.filter(row => row.pending).length;
  return <div className="consultationCounts" aria-label="카테고리별 선택 현황"><span>선택 완료 <b>{rows.length - pending}</b></span><span>미결정 <b>{pending}</b></span><span>현장 확인 <b>{rows.filter(row => row.site).length}</b></span></div>;
}

export default function ConsultationSummary({ rows, onEdit }: { rows: ConsultationRow[]; onEdit?: (step: number) => void }) {
  return <div className="reviewSections">{[
    { title: '선택 완료', rows: rows.filter(row => !row.pending), empty: '원하는 항목부터 천천히 골라보세요.' },
    { title: '아직 결정하지 않은 항목', rows: rows.filter(row => row.pending), empty: '모든 카테고리의 선택을 정리했어요.' },
    { title: '현장 확인이 필요한 항목', rows: rows.filter(row => row.site), empty: '추가로 표시된 현장 확인 항목이 없습니다.', site: true },
  ].map(section => <section key={section.title}><h2>{section.title} <small>{section.rows.length}</small></h2>{section.site && <p>현장 상태에 따라 달라질 수 있어요. 업체 실측 후 최종 확인이 필요합니다.</p>}{!section.rows.length && <p>{section.empty}</p>}{section.rows.map(row => <div className="reviewRow" key={row.key}><div><span>{row.title}</span><strong>{section.site ? row.site : row.label}</strong>{row.pending && !section.site && <small>{row.reason}</small>}</div>{onEdit && <button className="secondary" aria-label={`${row.title} 수정`} onClick={() => onEdit(row.stepIndex)}>수정</button>}</div>)}</section>)}</div>;
}
