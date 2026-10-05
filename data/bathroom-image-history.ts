import { resolveBuilderImage } from './bathroom-builder-image-resolver';
import { builderBathroomSteps } from './bathroom-builder-options';
import { selectedIds, type BathroomValues } from './bathroom-selection';

export function selectedImageItems(values: BathroomValues) {
  return builderBathroomSteps.flatMap(step => step.groups.flatMap(group =>
    group.choices.filter(choice => selectedIds(values[group.key]).includes(choice.id)
      && choice.showBuilderImage && choice.builderImage)
      .map(choice => ({ id: `${group.key}:${choice.id}`, title: group.title, choice: resolveBuilderImage(group.key, choice, values) })),
  ));
}

// Old projects have no interaction order; keep their selected images as a safe baseline.
export function normalizeImageHistoryOrder(input: unknown, values: BathroomValues): string[] {
  const ids = selectedImageItems(values).map(item => item.id);
  const valid = new Set(ids);
  const stored = Array.isArray(input) ? input.filter((id): id is string => typeof id === 'string' && valid.has(id)) : [];
  return Array.from(new Set([...stored, ...ids]));
}
