'use client';

import type { Choice } from '../data/bathroom-options';

const FALLBACK = '/images/bathroom-builder/fallback/placeholder.svg';

/** Keep the existing img sizing rules and read every surface from the option. */
export default function BuilderOptionImage({
  option,
  alt = '',
}: {
  option: Pick<Choice, 'builderImage'>;
  alt?: string;
}) {
  const source = option.builderImage || FALLBACK;
  return (
    <img
      key={source}
      src={source}
      alt={alt}
      onError={(event) => {
        const image = event.currentTarget;
        if (image.getAttribute('src') !== FALLBACK) image.src = FALLBACK;
      }}
    />
  );
}
