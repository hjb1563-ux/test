import combinations from './bathroom-builder-tile-images.generated.json';
import surfaceCombinations from './bathroom-builder-tile-surface-images.generated.json';
import type { Choice } from './bathroom-options';
import type { BathroomValues } from './bathroom-selection';

export const tileCombinationImages: Record<string, Record<string, string>> = combinations;
export const tileSurfaceImages: Record<string, Record<string, Record<string, string>>> = surfaceCombinations;

export function normalizeTileSize(size: unknown): string | null {
  if (typeof size !== 'string') return null;
  const normalized = size.normalize('NFKC').trim().toLowerCase().replace(/×/g, 'x').replace(/\s+/g, '');
  return ['300x600','600x600','600x1200'].includes(normalized) ? normalized : null;
}

export function resolveTileSurfaceImage(size: unknown, mood: unknown, surface: string, fallback: string | null = null): string | null {
  const normalizedSize = normalizeTileSize(size);
  return normalizedSize && typeof mood === 'string'
    ? tileSurfaceImages[normalizedSize]?.[mood]?.[surface] ?? fallback : fallback;
}

// Paths are derived from separate selections, never stored in the project.
export function resolveTileMoodImage(size: unknown, mood: string, fallback: string | null): string | null {
  return typeof size === 'string' && size !== 'other'
    ? tileCombinationImages[size]?.[mood] ?? fallback : fallback;
}

export function resolveBuilderImage(groupKey: string, choice: Choice, values: BathroomValues): Choice {
  if (!choice.showBuilderImage || !['tile','tileSurface'].includes(groupKey)) return choice;
  const builderImage = groupKey === 'tileSurface'
    ? resolveTileSurfaceImage(values.wallTileSize, values.tile, choice.id, choice.builderImage)
    : resolveTileMoodImage(values.wallTileSize, choice.id, choice.builderImage);
  return builderImage === choice.builderImage ? choice : { ...choice, builderImage };
}
