import { bathroomSteps, type ChoiceGroup } from './bathroom-options';

// Preserve the existing { values, priorities } storage envelope and ID fields.
export type BathroomValues = Record<string, string | string[]>;
export const customTextKey = (groupKey: string): `${string}Other` => `${groupKey}Other`;
export const selectedIds = (value: string | string[] | undefined): string[] =>
  Array.isArray(value) ? value : value ? [value] : [];

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
export function normalizeBathroomValues(input: unknown): BathroomValues {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  const raw = input as Record<string, unknown>;
  const result: BathroomValues = {};
  for (const group of bathroomSteps.flatMap(step => step.groups)) {
    const value = raw[group.key];
    const incoming = Array.isArray(value) ? value : typeof value === 'string' ? [value] : [];
    const ids = Array.from(new Set(incoming.filter((id): id is string =>
      typeof id === 'string' && group.choices.some(choice => choice.id === id))));
    if (ids.length) {
      const exclusive = ids.find(id => id === 'none' || id === 'undecided');
      result[group.key] = group.multiple ? exclusive ? [exclusive] : ids : ids[0];
    }
    const key = customTextKey(group.key);
    if (group.choices.some(choice => choice.requiresCustomText) && typeof raw[key] === 'string') {
      result[key] = raw[key];
    }
  }
  return result;
}

export function toggleSelection(values: BathroomValues, key: string, id: string, multiple = false): BathroomValues {
  if (!multiple) return { ...values, [key]: values[key] === id ? '' : id };
  const before = selectedIds(values[key]);
  const next = before.includes(id) ? before.filter(item => item !== id)
    : id === 'none' || id === 'undecided' ? [id]
    : [...before.filter(item => item !== 'none' && item !== 'undecided'), id];
  return { ...values, [key]: next };
}
