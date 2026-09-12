'use client';

import { Check } from 'lucide-react';

export default function BuilderChoiceCard({ label, selected, multiple = false, tabIndex, onSelect }: {
  label: string;
  selected: boolean;
  multiple?: boolean;
  tabIndex?: number;
  onSelect: () => void;
}) {
  return <button type="button" role={multiple ? 'checkbox' : 'radio'} aria-checked={selected}
    tabIndex={tabIndex} onClick={onSelect}
    className={`builderChoiceCard${selected ? ' selected' : ''}${label.length > 8 ? ' builderChoiceCard--wide' : ''}`}
    onKeyDown={event => {
      if (multiple || !['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
      const cards = Array.from(event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="radio"]') ?? []);
      const index = cards.indexOf(event.currentTarget);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? cards.length - 1
        : (index + (event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 1 : -1) + cards.length) % cards.length;
      event.preventDefault();
      cards[next]?.focus();
      if (cards[next]?.getAttribute('aria-checked') !== 'true') cards[next]?.click();
    }}>
    <span className="builderChoiceLabel">{label}</span>
    <span aria-hidden="true" className={`builderChoiceIndicator${multiple ? ' builderChoiceIndicator--multiple' : ''}`}>
      {selected && <Check size={13} strokeWidth={2.5} />}
    </span>
  </button>;
}
