import type { BathroomStep, ChoiceGroup } from './bathroom-options';
import { builderBathroomSteps as bathroomSteps } from './bathroom-builder-options';

// Keep selection IDs separate from project metadata and image paths.
export type BathroomValues = Record<string, string | string[]>;
export const customTextKey = (groupKey: string): `${string}Other` => `${groupKey}Other`;
export const selectedIds = (value: string | string[] | undefined): string[] =>
  Array.isArray(value) ? value : value ? [value] : [];

export function updateCustomText(values: BathroomValues, key: string, text: string): BathroomValues {
  const result = { ...values, [customTextKey(key)]: text };
  if (key === 'accessory') delete result.accessory;
  return result;
}

export function selectionLabel(values: BathroomValues, group: ChoiceGroup): string {
  if (group.key === 'accessory') {
    const draft = values.accessoryOther;
    return typeof draft === 'string' && draft.trim() ? draft.trim() : '미정';
  }
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
  const raw = { ...input } as Record<string, unknown>;
  // Older links/saves may use the previous display labels rather than stable IDs.
  const showerLabels: Record<string, string> = {
    '일반 샤워 수전': 'shower', '일반 샤워수전': 'shower',
    '매립 샤워 수전': 'concealed-shower', '매립 샤워': 'concealed-shower',
  };
  if (typeof raw.showerFaucet === 'string') raw.showerFaucet = showerLabels[raw.showerFaucet] ?? raw.showerFaucet;
  if (!('partitionShower' in raw)) {
    const aliases: Record<string, string> = { half: 'half-partition', full: 'full-partition', fixed: 'fixed-glass', door: 'door-booth' };
    const legacy = [raw.partition, raw.showerBooth].flatMap(value => Array.isArray(value) ? value : typeof value === 'string' ? [value] : [])
      .filter((id): id is string => typeof id === 'string').map(id => aliases[id] ?? id);
    // Legacy saves contain no choice timestamps; prefer a real partition, then a booth.
    raw.partitionShower = legacy.find(id => ['half-partition', 'full-partition', 'fixed-glass', 'door-booth'].includes(id))
      ?? legacy.find(id => id === 'none');
  }
  const result: BathroomValues = {};
  for (const group of steps.flatMap(step => step.groups)) {
    const value = raw[group.key];
    const incoming = Array.isArray(value) ? value : typeof value === 'string' ? [value] : [];
    const ids = Array.from(new Set(incoming.filter((id): id is string =>
      typeof id === 'string' && group.choices.some(choice => choice.id === id))));
    if (ids.length) {
      const exclusive = ids.find(id => id === 'none');
      const compatible = group.key === 'jendai' && ids.includes('keep') && ids.includes('remove')
        ? ids.filter(id => id !== 'remove') : ids;
      result[group.key] = group.multiple ? exclusive ? [exclusive] : compatible : ids[0];
    }
    const key = customTextKey(group.key);
    if ((group.key === 'accessory' || group.choices.some(choice => choice.requiresCustomText)) && typeof raw[key] === 'string') {
      result[key] = raw[key];
    }
  }
  // Unknown used to exclude an accessory draft. Do not revive that hidden text.
  if (selectedIds(raw.accessory as string | string[] | undefined).some(id => /^(undecided|notSure|unknown)$/i.test(id) || /모르겠/.test(id))) delete result.accessoryOther;
  else if (typeof result.accessoryOther === 'string') result.accessoryOther = result.accessoryOther.trim();
  return result;
}

export function toggleSelection(values: BathroomValues, key: string, id: string, multiple = false): BathroomValues {
  if (!multiple) {
    const result = { ...values, [key]: values[key] === id ? '' : id };
    return result;
  }
  const before = selectedIds(values[key]);
  const next = before.includes(id) ? before.filter(item => item !== id)
    : id === 'none' ? [id]
    : [...before.filter(item => item !== 'none'
      && !(key === 'jendai' && ((id === 'keep' && item === 'remove') || (id === 'remove' && item === 'keep')))), id];
  return { ...values, [key]: next };
}
