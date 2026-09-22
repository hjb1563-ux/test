import type { BathroomStep, ChoiceGroup } from './bathroom-options';
import { builderBathroomSteps as bathroomSteps } from './bathroom-builder-options';

// Keep selection IDs separate from project metadata and image paths.
export type BathroomValues = Record<string, string | string[]>;
export const customTextKey = (groupKey: string): `${string}Other` => `${groupKey}Other`;
export const selectedIds = (value: string | string[] | undefined): string[] =>
  Array.isArray(value) ? value : value ? [value] : [];

export const isActualStructure = (value: string | string[] | undefined): boolean =>
  selectedIds(value).some(id => ['half-partition', 'full-partition', 'fixed-glass', 'door-booth'].includes(id));

export function structureBlocked(key: string, values: BathroomValues): boolean {
  return key === 'partition' ? isActualStructure(values.showerBooth)
    : key === 'showerBooth' ? isActualStructure(values.partition) : false;
}

export function selectionLabel(values: BathroomValues, group: ChoiceGroup): string {
  const labels = selectedIds(values[group.key]).flatMap(id => {
    const choice = group.choices.find(item => item.id === id);
    if (!choice) return [];
    if (!choice.requiresCustomText) return [choice.name];
    const draft = values[customTextKey(group.key)];
    return [`${choice.name} · ${typeof draft === 'string' && draft.trim() ? draft.trim() : '내용 미입력'}`];
  });
  return labels.join(', ') || '미정';
}

/** Validate stored IDs against current options, including removed legacy IDs. */
export function normalizeBathroomValues(input: unknown, steps: BathroomStep[] = bathroomSteps): BathroomValues {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  const raw = input as Record<string, unknown>;
  const result: BathroomValues = {};
  for (const group of steps.flatMap(step => step.groups)) {
    const value = raw[group.key];
    const incoming = Array.isArray(value) ? value : typeof value === 'string' ? [value] : [];
    const ids = Array.from(new Set(incoming.filter((id): id is string =>
      typeof id === 'string' && group.choices.some(choice => choice.id === id))));
    if (ids.length) {
      const exclusive = ids.find(id => id === 'none' || id === 'undecided');
      const compatible = group.key === 'jendai' && ids.includes('keep') && ids.includes('remove')
        ? ids.filter(id => id !== 'remove') : ids;
      result[group.key] = group.multiple ? exclusive ? [exclusive] : compatible : ids[0];
    }
    const key = customTextKey(group.key);
    if (group.choices.some(choice => choice.requiresCustomText) && typeof raw[key] === 'string') {
      result[key] = raw[key];
    }
  }
  // Old saves have no timestamp per choice: consistently retain the partition.
  if (isActualStructure(result.partition) && isActualStructure(result.showerBooth)) delete result.showerBooth;
  return result;
}

export function toggleSelection(values: BathroomValues, key: string, id: string, multiple = false): BathroomValues {
  if (!multiple) {
    const result = { ...values, [key]: values[key] === id ? '' : id };
    if (isActualStructure(result[key])) {
      const other = key === 'partition' ? 'showerBooth' : key === 'showerBooth' ? 'partition' : undefined;
      if (other && isActualStructure(result[other])) delete result[other];
    }
    return result;
  }
  const before = selectedIds(values[key]);
  const next = before.includes(id) ? before.filter(item => item !== id)
    : id === 'none' || id === 'undecided' ? [id]
    : [...before.filter(item => item !== 'none' && item !== 'undecided'
      && !(key === 'jendai' && ((id === 'keep' && item === 'remove') || (id === 'remove' && item === 'keep')))), id];
  return { ...values, [key]: next };
}
