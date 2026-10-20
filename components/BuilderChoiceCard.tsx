'use client';

import { Check } from 'lucide-react';
import type { MouseEvent } from 'react';
import BuilderOptionImage from './BuilderOptionImage';
import type { Choice } from '../data/bathroom-options';

export default function BuilderChoiceCard({ label, description, selected, multiple = false, disabled = false, describedBy, tabIndex, onSelect, imageOption }: {
  label: string;
  description?: string;
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
    <span className="builderChoiceLabel">{label}{description && <small className="builderChoiceDescription">{description}</small>}</span>
    <span aria-hidden="true" className={`builderChoiceIndicator${multiple ? ' builderChoiceIndicator--multiple' : ''}${disabled ? ' builderChoiceIndicator--disabled' : ''}`}>
      {disabled ? <svg className="builderChoiceProhibitedIcon" width="19" height="19" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" focusable="false">
        <circle cx="10" cy="10" r="8" />
        <line x1="4.87" y1="15.13" x2="15.13" y2="4.87" />
      </svg> : selected && <Check size={13} strokeWidth={2.5} />}
    </span>
  </button>;
}
