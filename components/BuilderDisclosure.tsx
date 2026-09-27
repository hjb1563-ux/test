'use client';

import { useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

/** Only presentation state lives here; the same content stays mounted at every width. */
export default function BuilderDisclosure({ id, title, count, className = '', children }: {
  id: string; title: string; count?: number; className?: string; children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return <section className={`builderDisclosure ${className}`} data-open={open}>
    <button className="builderDisclosureToggle" type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>
      <span>{title}</span>{count !== undefined && <small>{count}개</small>}<ChevronDown size={18} aria-hidden="true" />
    </button>
    <div className="builderDisclosureBody" id={id}>{children}</div>
  </section>;
}
