import { bathroomSteps, type BathroomStep, type Choice } from './bathroom-options';
import generatedImages from './bathroom-builder-image-settings.generated.json';

const imageSettings: Record<string, { builderImage: string | null; showBuilderImage: boolean }> = generatedImages;

// Apply these choices only to /design; shared guide/result options stay intact.
const textOnlyGroups = new Set(['window', 'drainPosition', 'ventilation', 'accessory', 'grout']);
const noBathtub: Choice = {
  id: 'none', name: '욕조 없음', sub: '', image: '',
  builderImage: null, showBuilderImage: false,
};

const builderSteps: BathroomStep[] = bathroomSteps.map(step => ({
  ...step,
  groups: step.groups.filter(group => group.key !== 'floorTileSize').map(group => {
    if (group.key === 'wallTileSize') return { ...group, title: '벽 & 바닥 타일 크기' };
    if (group.key === 'bathtub') return { ...group, choices: [noBathtub, ...group.choices] };
    if (textOnlyGroups.has(group.key)) return {
      ...group,
      choices: group.choices.map(choice => ({ ...choice, showBuilderImage: false })),
    };
    return group;
  }),
}));

export const builderBathroomSteps: BathroomStep[] = builderSteps.map(step => ({
  ...step,
  groups: step.groups.map(group => ({
    ...group,
    choices: group.choices.map(choice => ({ ...choice, ...imageSettings[`${group.key}:${choice.id}`] })),
  })),
}));
