import { getVisibleSteps, builderModeLabel, type BuilderMode } from './bathroom-builder-mode';
import { normalizeImageHistoryOrder } from './bathroom-image-history';
import { builderBathroomSteps as steps } from './bathroom-builder-options';
import { customTextKey, enforceBathtubCompatibility, normalizeBathroomValues, selectedIds, selectionLabel, type BathroomValues } from './bathroom-selection';

export const STORAGE = 'bath-designer-selections-v2';
export const consultationEditUrl = (stepIndex: number) => `/design?step=${stepIndex + 1}&returnTo=consultation`;
export const phases = [
  { title: '기존 욕실과 기본 공사', start: 0, end: 2 },
  { title: '마감과 주요 욕실 기구', start: 3, end: 7 },
  { title: '설비와 디테일', start: 8, end: 14 },
];
export const stepReasons = [
  '기존 타일과 누수 상태에 따라 공사 범위가 달라집니다. 원하는 방향을 고르고 실제 방식은 현장에서 확인하세요.',
  '선반과 공간 구분은 수납과 물튐에 영향을 줍니다. 원하는 공간 구성을 골라보세요.',
  '방수는 물이 새지 않도록 욕실의 바탕을 보호합니다. 기존 상태를 확인한 뒤 업체와 방식을 정해도 괜찮아요.',
  '타일 크기와 색, 표면은 욕실 분위기와 청소 방식에 영향을 줍니다. 마음에 드는 느낌부터 골라보세요.',
  '세면대와 변기 형태는 청소 편의와 공간 사용에 영향을 줍니다. 설치 조건은 업체와 확인하세요.',
  '욕실장과 거울은 필요한 수납량과 아침 준비 습관에 맞춰 고르면 좋아요.',
  '목욕과 샤워 중 자주 쓰는 방식을 떠올려보세요. 욕조 없이 공간을 넓게 쓸 수도 있어요.',
  '천장 형태는 공간의 높이감과 설비 점검 편의에 영향을 줍니다.',
  '수전은 매일 손이 닿는 설비입니다. 사용 편의와 관리 방식을 함께 생각해보세요.',
  '배수구 형태는 청소 방식과 바닥 마감에 영향을 줍니다. 배수 위치와 물이 흐르는 기울기는 현장 확인이 필요해요.',
  '원하는 환풍기 제품명이 있다면 입력해주세요. 설치 조건은 업체와 함께 확인하세요.',
  '조명 위치에 따라 거울을 볼 때의 밝기와 욕실 분위기가 달라집니다.',
  '자주 쓰는 물건의 위치와 금속 색상을 정리하면 사용하기 편한 욕실을 만들 수 있어요.',
  '줄눈은 타일 사이를 마감하는 부분입니다. 청소와 관리 방식을 함께 고려하세요.',
  '문턱 마감은 출입 편의와 물이 바깥으로 흐르는 것을 막는 데 영향을 줍니다.',
  '선택한 내용과 상담할 내용을 나누어 확인하세요. 미결정 항목이 있어도 상담서를 만들 수 있습니다.',
];

export function siteCheck(key: string, values: BathroomValues): string | undefined {
  const group = steps.flatMap(step => step.groups).find(group => group.key === key);
  const ids = selectedIds(values[key]).filter(id => group?.choices.some(choice => choice.id === id));
  const always: Record<string, string> = {
    demolition: '기존 타일 상태와 철거·덧방 범위',
    bathroomCondition: '기존 욕실 손상과 누수 이력',
    waterproofing: '기존 방수 상태와 필요한 방수 범위',
    drain: '배수구 연결과 바닥 구배',
    drainPosition: '배수 위치와 이동 가능 범위',
    threshold: '문턱 높이와 바깥 바닥의 단차',
  };
  if (always[key]) return always[key];
  const structural: Record<string, string> = { jendai: '젠다이와 배관 위치', partitionShower: '파티션·샤워부스 설치 공간과 고정 조건', niche: '샴푸박스 설치 벽체와 방수' };
  if (structural[key] && ids.some(id => !['none', 'consult'].includes(id))) return structural[key];
  if (['faucet', 'showerFaucet'].includes(key) && ids.some(id => id.includes('concealed'))) return '매립 수전 배관과 점검 공간';
  if (key === 'toilet' && ids.includes('wall-hung')) return '벽걸이 변기 지지 구조와 배관';
}

export function consultationRows(values: BathroomValues, mode: BuilderMode = 'professional') {
  values = enforceBathtubCompatibility(values);
  return getVisibleSteps(mode).flatMap((step, displayIndex) => step.groups.map(group => {
    const stepIndex = step.stepIndex;
    const choices = group.choices.filter(choice => selectedIds(values[group.key]).includes(choice.id));
    const reasons = choices.flatMap(choice => {
      const custom = values[customTextKey(group.key)];
      if (choice.requiresCustomText && !(typeof custom === 'string' && custom.trim())) return ['기타 내용 미입력'];
      return [];
    });
    const custom = values[customTextKey(group.key)];
    const hasText = ['accessory', 'ventilation'].includes(group.key) && typeof custom === 'string' && !!custom.trim();
    if (!choices.length && !hasText) reasons.push('미정');
    return { key: group.key, title: group.title, stepTitle: step.title, stepIndex, displayIndex, label: selectionLabel(values, group), choices, pending: reasons.length > 0, reason: Array.from(new Set(reasons)).join(' · '), site: siteCheck(group.key, values) };
  }));
}
export type ConsultationRow = ReturnType<typeof consultationRows>[number];
// Output omits unanswered consumer categories; Builder counts keep all visible questions.
export function consultationOutputRows(values: BathroomValues, mode: BuilderMode) {
  return consultationRows(values, mode).filter(row => mode === 'professional' || !row.pending);
}

export type ProjectInfo = { builderMode: BuilderMode; customerName: string; projectName: string; propertyType: '아파트' | '빌라' | '상가' | null; occupancyStatus: '살고 있다' | '이사갈 곳이다' | null; areaPyeong: string; constructionDate: string | null; budget: number | null };
export const numericDigits = (value: string, max: number) => value.replace(/[^0-9]/g, '').slice(0, max);
export function calendarDate(year: string, month: string, day: string): string | null {
  if (!/^\d{4}$/.test(year) || !/^\d{1,2}$/.test(month) || !/^\d{1,2}$/.test(day)) return null;
  const y = Number(year), m = Number(month), d = Number(day);
  const leap = y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return y > 0 && m >= 1 && m <= 12 && d >= 1 && d <= days[m - 1] ? year + '-' + month.padStart(2, '0') + '-' + day.padStart(2, '0') : null;
}
export const formatAreaPyeong = (value: string) => value ? value + '평' : '';
export const formatBudgetNumber = (value: number | null) => value === null ? '' : new Intl.NumberFormat('ko-KR').format(value);
export const formatBudget = (value: number | null) => value === null ? '' : formatBudgetNumber(value) + '원 이내';
export const formatConstructionDate = (value: string | null) => value ? value.replace(/-/g, '.') : '';
export function projectMetadata(info: ProjectInfo) {
  const site = [info.propertyType, info.propertyType !== '상가' ? info.occupancyStatus : null, formatAreaPyeong(info.areaPyeong)].filter(Boolean).join(' · ');
  return [site, info.constructionDate ? '시공 예정 · ' + formatConstructionDate(info.constructionDate) : '', info.budget !== null ? '예산 · ' + formatBudget(info.budget) : ''].filter(Boolean);
}
export function normalizeProjectInfo(input: unknown): ProjectInfo {
  const raw = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  const propertyType = raw.propertyType === '아파트' || raw.propertyType === '빌라' || raw.propertyType === '상가' ? raw.propertyType : null;
  const date = typeof raw.constructionDate === 'string' ? raw.constructionDate.split('-') : [];
  return { propertyType, builderMode: raw.builderMode === 'professional' ? 'professional' : 'consumer',
    occupancyStatus: propertyType !== '상가' && (raw.occupancyStatus === '살고 있다' || raw.occupancyStatus === '이사갈 곳이다') ? raw.occupancyStatus : null,
    areaPyeong: typeof raw.areaPyeong === 'string' ? numericDigits(raw.areaPyeong, 4) : '',
    constructionDate: date.length === 3 ? calendarDate(date[0], date[1], date[2]) : null,
    budget: typeof raw.budget === 'number' && Number.isSafeInteger(raw.budget) && raw.budget >= 0 && raw.budget <= 9999999999999 ? raw.budget : null,
    customerName: typeof raw.customerName === 'string' ? raw.customerName.trim().slice(0, 40) : '', projectName: typeof raw.projectName === 'string' ? raw.projectName.trim().slice(0, 80) : '' };
}
export const hasProjectInfo = (info: ProjectInfo) => !!(info.customerName.trim() || info.projectName.trim());
export const projectLabel = (info: ProjectInfo) => info.projectName || (info.customerName ? `${info.customerName}님의 욕실` : '');
export type LocalProject = { version: 3; projectInfo: ProjectInfo; lastModifiedAt: string | null; values: BathroomValues; specialNotes: string; current: number; memo: string; checks: Record<string, string>; imageHistoryOrder: string[] };
export function normalizeProject(input: unknown): LocalProject {
  const raw = input && typeof input === 'object' && !Array.isArray(input) ? input as Record<string, unknown> : {};
  const current = typeof raw.current === 'number' && Number.isInteger(raw.current) ? raw.current : 0;
  const values = normalizeBathroomValues(raw.values, steps);
  const info = raw.projectInfo && typeof raw.projectInfo === 'object' && !Array.isArray(raw.projectInfo) ? raw.projectInfo as Record<string, unknown> : {};
  const hasSelections = Object.values(values).some(value => Array.isArray(value) ? value.length > 0 : !!value.trim());
  const builderMode = info.builderMode === 'consumer' || info.builderMode === 'professional'
    ? info.builderMode : hasSelections ? 'professional' : 'consumer';
  return {
    version: 3,
    projectInfo: normalizeProjectInfo({ ...info, builderMode }),
    lastModifiedAt: typeof raw.lastModifiedAt === 'string' && Number.isFinite(Date.parse(raw.lastModifiedAt)) ? raw.lastModifiedAt : null,
    values,
    imageHistoryOrder: normalizeImageHistoryOrder(raw.imageHistoryOrder, values),
    specialNotes: typeof raw.specialNotes === 'string' ? raw.specialNotes.slice(0, 500) : '',
    current: Math.max(0, Math.min(steps.length - 1, raw.version === 3 || current < 5 ? current : current - 1)),
    memo: typeof raw.memo === 'string' ? raw.memo : '',
    checks: raw.checks && typeof raw.checks === 'object' && !Array.isArray(raw.checks) ? Object.fromEntries(Object.entries(raw.checks).filter((entry): entry is [string, string] => typeof entry[1] === 'string' && steps.some(step => step.groups.some(group => group.key === entry[0])))) : {},
  };
}
export function readProject(): LocalProject {
  return normalizeProject(JSON.parse(localStorage.getItem(STORAGE) ?? '{}'));
}

// Navigation and image feedback are not consultation content changes.
export function updateProjectContent(before: LocalProject, patch: Partial<LocalProject>, now = () => new Date().toISOString()): LocalProject {
  const merged = { ...before, ...patch };
  const values = enforceBathtubCompatibility(merged.values);
  const next = { ...merged, values, imageHistoryOrder: normalizeImageHistoryOrder(merged.imageHistoryOrder, values) };
  const content = (project: LocalProject) => [
    Object.entries(normalizeBathroomValues(project.values, steps)).sort(([a], [b]) => a.localeCompare(b)),
    normalizeProjectInfo(project.projectInfo), project.specialNotes, project.memo,
  ];
  return { ...next, lastModifiedAt: JSON.stringify(content(before)) === JSON.stringify(content(next)) ? before.lastModifiedAt : now() };
}

export function formatLastModified(value: string | null): string {
  if (!value || !Number.isFinite(Date.parse(value))) return '';
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(value));
  const part = (name: Intl.DateTimeFormatPartTypes) => parts.find(item => item.type === name)?.value;
  return `${part('year')}.${part('month')}.${part('day')} ${part('hour')}:${part('minute')}`;
}

const summaryGroups = [
  { id: 'construction', title: '시공 방식', keys: ['demolition'] },
  { id: 'space', title: '공간 구성', keys: ['partitionShower', 'bathtub', 'jendai'] },
  { id: 'tile', title: '타일', keys: ['wallTileSize', 'tile', 'tileSurface'] },
  { id: 'fixtures', title: '주요 설비', keys: ['sink', 'toilet', 'bathtub', 'faucet', 'showerFaucet'] },
];

export function generateConsultationSummary(values: BathroomValues, mode: BuilderMode = 'professional') {
  const normalized = normalizeBathroomValues(values, steps);
  const groups = getVisibleSteps(mode).flatMap(step => step.groups);
  const seen = new Set<string>();
  const pending = new Set<string>();
  const labels = (key: string) => {
      const group = groups.find(item => item.key === key);
      if (!group) return [];
      const draft = normalized[customTextKey(key)];
      const custom = typeof draft === 'string' ? draft.trim() : '';
      return selectedIds(normalized[key]).flatMap(id => {
        const choice = group.choices.find(item => item.id === id);
        if (!choice) return [];
        // Only a current, explicitly selected decision-later value is pending.
        // Unanswered and removed legacy IDs remain absent, as in detailed output.
        const name = choice.requiresCustomText ? custom : choice.name;
        if (choice.id === 'consult' || /^(undecided|notSure|unknown(?:-condition)?)$/i.test(id)
          || /^(?:미정|아직 모르겠어요|모르겠어요|상담 후 결정|업체와 상담 후 결정)$/.test(name)) {
          pending.add(group.title);
          return [];
        }
        if (choice.requiresCustomText) return custom ? [custom] : [];
        if (key === 'sink' && choice.id === 'undermount-basin') return ['언더볼 세면대'];
        if (key === 'toilet') return [`${choice.name} 변기`];
        if (choice.name === '없음') return [`${group.title} 없음`];
        return [choice.name];
      });
  };
  // Keep scope decisions visible without reproducing every technical detail.
  for (const key of ['demolition', 'partitionShower', 'bathtub', 'wallTileSize', 'tile', 'tileSurface', 'sink', 'toilet', 'faucet', 'showerFaucet', 'waterproofing', 'drainPosition']) labels(key);
  const summary = summaryGroups.flatMap(section => {
    const candidates = section.keys.flatMap(key => {
      if (key === 'bathtub') {
        const absent = selectedIds(normalized.bathtub).includes('none');
        if (section.id === 'space' ? !absent : absent) return [];
      }
      return labels(key);
    });
    // Stable priority: partition / no-bath / structure; basin / toilet / bath,
    // then representative faucets only when there is room (three values per row).
    const items = Array.from(new Set(candidates)).filter(item => !seen.has(item)).slice(0, 3);
    items.forEach(item => seen.add(item));
    return items.length ? [{ id: section.id, title: section.title, items, text: items.join(' · ') }] : [];
  });
  const undecided = Array.from(pending);
  return undecided.length ? [...summary, { id: 'pending', title: '미정 사항', items: undecided, text: undecided.join(' · ') }] : summary;
}

export function consultationSummaryText(project: LocalProject): string {
  const info = project.projectInfo;
  const identity = [info.projectName ? `프로젝트명: ${info.projectName}` : '', info.customerName ? `고객명: ${info.customerName}` : ''].filter(Boolean).join(' · ');
  const summary = generateConsultationSummary(project.values, info.builderMode);
  const threshold = consultationOutputRows(project.values, info.builderMode).find(row => row.key === 'threshold' && !row.pending);
  return [identity, ...projectMetadata(info), '[공사 개요]', ...summary.map(group => `${group.title}: ${group.text}`), ...(threshold ? [`문턱 마감: ${threshold.label}`] : []), ...(project.memo.trim() ? [`\n[업체에 전달할 메모]\n${project.memo.trim()}`] : [])].filter(Boolean).join('\n');
}
// Store the selection fingerprint: changing a choice invalidates its old field check.
export const checkFingerprint = (row: ConsultationRow) => JSON.stringify([row.label, row.site]);
export function consultationText(rows: ConsultationRow[], specialNotes: string, memo: string, projectInfo: ProjectInfo = normalizeProjectInfo({ builderMode: 'professional' }), lastModifiedAt: string | null = null) {
  const visibleKeys = new Set(getVisibleSteps(projectInfo.builderMode).flatMap(step => step.groups.map(group => group.key)));
  rows = rows.filter(row => visibleKeys.has(row.key));
  if (projectInfo.builderMode === 'consumer') {
    const construction = getVisibleSteps('consumer')[0].groups.find(group => group.key === 'demolition')!;
    rows = rows.filter(row => !row.pending).map(row => row.key !== 'demolition' ? row : {
      ...row, label: row.choices.map(choice => construction.choices.find(item => item.id === choice.id)?.name ?? choice.name).join(', ') || row.label,
    });
  }
  const pending = rows.filter(row => row.pending);
  return ['[욕실 리모델링 상담서]', ...(projectInfo.projectName ? [`프로젝트명: ${projectInfo.projectName}`] : []), ...(projectInfo.customerName ? [`고객명: ${projectInfo.customerName}`] : []), `작성 모드 · ${builderModeLabel(projectInfo.builderMode)}`, ...projectMetadata(projectInfo), ...(formatLastModified(lastModifiedAt) ? [`마지막 수정: ${formatLastModified(lastModifiedAt)}`] : []), `선택 완료 ${rows.length - pending.length}`, '집계 기준: 선택 카테고리 수',
    ...getVisibleSteps(projectInfo.builderMode).filter(step => step.key !== 'checklist').flatMap((step, index) => projectInfo.builderMode === 'consumer' && !rows.some(row => row.stepIndex === step.stepIndex) ? [] : [`\n${String(index + 1).padStart(2, '0')} ${step.title}\n${rows.filter(row => row.stepIndex === step.stepIndex).map(row => `${row.title}: ${row.label}`).join('\n')}`]),
    '\n업체 실측 후 최종 확인이 필요합니다. 선택 내용은 상담을 위한 희망 사항입니다.',
    ...(specialNotes.trim() ? [`\n[특이사항]\n${specialNotes.trim()}`] : []),
    ...(memo.trim() ? [`\n[업체에 전달할 메모]\n${memo.trim()}`] : []),
  ].join('\n');
}
