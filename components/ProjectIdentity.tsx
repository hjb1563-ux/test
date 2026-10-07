import { projectLabel, type ProjectInfo } from '../data/bathroom-consultation';

export default function ProjectIdentity({ info, onEdit }: { info: ProjectInfo; onEdit?: () => void }) {
  const label = projectLabel(info);
  if (!label) return null;
  return <div className="projectIdentity"><div><strong>{label}</strong>{info.customerName && info.projectName && <small>고객명 · {info.customerName}</small>}</div>{onEdit && <button type="button" className="resumeLink printHide" onClick={onEdit} aria-label="프로젝트 정보 수정">수정</button>}</div>;
}
