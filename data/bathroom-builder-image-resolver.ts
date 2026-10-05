import combinations from './bathroom-builder-tile-images.generated.json';
import type { Choice } from './bathroom-options';
import type { BathroomValues } from './bathroom-selection';

export const tileCombinationImages: Record<string, Record<string, string>> = combinations;

// Paths are derived from separate selections, never stored in the project.
export function resolveTileMoodImage(size: unknown, mood: string, fallback: string | null): string | null {
  return typeof size === 'string' && size !== 'other'
    ? tileCombinationImages[size]?.[mood] ?? fallback : fallback;
}

export function resolveBuilderImage(groupKey: string, choice: Choice, values: BathroomValues): Choice {
  if (groupKey !== 'tile' || !choice.showBuilderImage) return choice;
  const builderImage = resolveTileMoodImage(values.wallTileSize, choice.id, choice.builderImage);
  return builderImage === choice.builderImage ? choice : { ...choice, builderImage };
}
