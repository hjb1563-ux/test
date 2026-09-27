'use client';

import { useState } from 'react';
import type { ChoiceGroup } from '../data/bathroom-options';
import type { BathroomValues } from '../data/bathroom-selection';
import BuilderChoiceGroup from './BuilderChoiceGroup';

export default function BuilderSelectionSections({ groups, values, onSelect, onCustomText }: {
  groups: ChoiceGroup[]; values: BathroomValues;
  onSelect: (key: string, id: string, multiple?: boolean) => void;
  onCustomText: (key: string, text: string) => void;
}) {
  const [active, setActive] = useState<string | null>(groups[0]?.key ?? null);
  return <div className="builderSections">{groups.map((group, index) => <BuilderChoiceGroup key={group.key}
    group={group} number={groups.length > 1 ? index + 1 : undefined} values={values} onSelect={onSelect} onCustomText={onCustomText}
    accordion={groups.length > 1 ? { open: active === group.key, toggle: () => setActive(active === group.key ? null : group.key),
      advance: () => {
        const next = groups[index + 1];
        if (!next) return;
        setActive(next.key);
        requestAnimationFrame(() => {
          const heading = document.getElementById(`builder-${next.key}-toggle`);
          heading?.focus({ preventScroll: true });
          heading?.scrollIntoView({ block: 'nearest', behavior: 'auto' });
        });
      } } : undefined} />)}</div>;
}
