'use client';

import { Check } from 'lucide-react';
import type { MouseEvent } from 'react';
import BuilderOptionImage from './BuilderOptionImage';
import type { Choice } from '../data/bathroom-options';

export default function BuilderChoiceCard({ label, selected, multiple = false, disabled = false, describedBy, tabIndex, onSelect, imageOption }: {
  label: string;
  selected: boolean;
  multiple?: boolean;
  disabled?: boolean;
  describedBy?: string;
  tabIndex?: number;
  imageOption?: Choice;
  onSelect: (event?: MouseEvent<HTMLButtonElement>) => void;
}) {
  return <button type="button" role={multiple ? 'checkbox' : 'radio'} aria-checked={selected}
    disabled={disabled} aria-describedby={describedBy} tabIndex={tabIndex} onClick={onSelect}
    className={`builderChoiceCard${selected ? ' selected' : ''}`}
    onKeyDown={event => {
      if (multiple || !['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
      const cards = Array.from(event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="radio"]:not(:disabled)') ?? []);
      const index = cards.indexOf(event.currentTarget);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? cards.length - 1
        : (index + (event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 1 : -1) + cards.length) % cards.length;
      event.preventDefault();
      cards[next]?.focus();
      if (cards[next]?.getAttribute('aria-checked') !== 'true') cards[next]?.click();
    }}>
    {imageOption?.showBuilderImage && <span className="builderSurfaceThumbnail" aria-hidden="true"><BuilderOptionImage option={imageOption} /></span>}
    <span className="builderChoiceLabel">{label}</span>
    <span aria-hidden="true" className={`builderChoiceIndicator${multiple ? ' builderChoiceIndicator--multiple' : ''}`}>
      {selected && <Check size={13} strokeWidth={2.5} />}
    </span>
  </button>;
}
