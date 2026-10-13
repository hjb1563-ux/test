'use client';

import type { BuilderMode } from '../data/bathroom-builder-mode';
import type { ChoiceGroup } from '../data/bathroom-options';
import type { BathroomValues } from '../data/bathroom-selection';
import BuilderChoiceGroup from './BuilderChoiceGroup';

export default function BuilderSelectionSections({ mode = 'professional', groups, activeSectionIndex, values, onSelect, onCustomText }: {
  mode?: BuilderMode; groups: ChoiceGroup[]; activeSectionIndex: number; values: BathroomValues;
  onSelect: (key: string, id: string, multiple?: boolean) => void;
  onCustomText: (key: string, text: string) => void;
}) {
  return <div className="builderSections">{groups.map((group, index) => <BuilderChoiceGroup key={group.key}
    mode={mode} group={group} number={groups.length > 1 ? index + 1 : undefined} sectionIndex={index} sectionCount={groups.length}
    compactActive={index === activeSectionIndex} values={values} onSelect={onSelect} onCustomText={onCustomText} />)}</div>;
}
