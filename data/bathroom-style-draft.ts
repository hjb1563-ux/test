import { bathroomStyleContent, bathroomStyleProductIds } from './bathroom-style-content';
import { bathroomStyles } from './bathroom-style-examples';
import { getVisibleSteps, type BuilderMode } from './bathroom-builder-mode';
import { normalizeProject, type LocalProject, type ProjectInfo } from './bathroom-consultation';
import type { BathroomValues } from './bathroom-selection';

export const styleDraftNotice = '선택한 욕실 예시를 바탕으로 작성한 초안입니다. 미정 항목은 직접 확인해주세요.';
const prefix = 'bath-designer-style-draft-v1:';
const products: Record<string, [string, string]> = {
  'basin-wall': ['sink', 'vanity-basin'], 'basin-undermount': ['sink', 'undermount-basin'], 'basin-vessel': ['sink', 'top-bowl'],
  'toilet-two-piece': ['toilet', 'two-piece'], 'toilet-one-piece': ['toilet', 'one-piece'],
  'faucet-standard': ['faucet', 'one-hole'], 'faucet-concealed': ['faucet', 'concealed'],
  'shower-standard': ['showerFaucet', 'shower'], 'shower-concealed': ['showerFaucet', 'concealed-shower'], 'shower-overhead': ['showerFaucet', 'rain'],
};
// Explicitly reviewed feature mappings; no free-text or photo inference.
const structures: Record<string, [string, string]> = {
  'essential-02': ['bathtub', 'bath-standard'], 'balanced-03': ['bathtub', 'bath-standard'],
  'balanced-01': ['partitionShower', 'full-partition'], 'premium-01': ['partitionShower', 'full-partition'],
  'balanced-02': ['partitionShower', 'half-partition'], 'premium-02': ['partitionShower', 'half-partition'],
};
export function styleDraftValues(exampleId: string, mode: BuilderMode): BathroomValues {
  const content = bathroomStyleContent[exampleId];
  if (!content || !bathroomStyleProductIds[exampleId]) throw new Error('Unknown style');
  const values: BathroomValues = {};
  const groups = getVisibleSteps(mode).flatMap(step => step.groups);
  function add(key: string, id: string) {
    const group = groups.find(item => item.key === key);
    if (!group?.choices.some(choice => choice.id === id)) return;
    if (group.multiple) values[key] = Array.from(new Set([...(Array.isArray(values[key]) ? values[key] as string[] : []), id]));
    else values[key] = id;
  }
  add('wallTileSize', content.tiles![0]);
  const [color, surface] = content.tiles![1].split(' / ');
  const colors: Record<string, string> = { '아이보리': 'ivory', '그레이': 'gray', '다크': 'dark', '화이트': 'white' };
  add('tile', colors[color]); add('tileSurface', surface === '유광' ? 'glossy' : 'matte');
  for (const product of bathroomStyleProductIds[exampleId]) if (products[product]) add(...products[product]);
  if (structures[exampleId]) add(...structures[exampleId]);
  return values;
}
export function createStyleDraft(exampleId: string, projectInfo: ProjectInfo) {
  const id = crypto.randomUUID();
  const project = normalizeProject({ projectInfo, values: styleDraftValues(exampleId, projectInfo.builderMode) });
  sessionStorage.setItem(prefix + id, JSON.stringify({ exampleId, project }));
  return id;
}
export function readStyleDraft(id: string): { exampleId: string; project: LocalProject } {
  const raw = sessionStorage.getItem(prefix + id);
  if (!raw) throw new Error('Draft expired');
  const record = JSON.parse(raw);
  if (!bathroomStyleContent[record.exampleId]) throw new Error('Invalid draft');
  return { exampleId: record.exampleId, project: normalizeProject(record.project) };
}
export function writeStyleDraft(id: string, project: LocalProject) {
  const record = readStyleDraft(id);
  sessionStorage.setItem(prefix + id, JSON.stringify({ ...record, project }));
}
export const styleDraftTitle = (id: string) => bathroomStyles.flatMap(style => style.examples).find(example => example.id === id)?.title ?? '';
export const withStyleDraft = (url: string, id: string | null) => id ? `${url}${url.includes('?') ? '&' : '?'}styleDraft=${encodeURIComponent(id)}` : url;
