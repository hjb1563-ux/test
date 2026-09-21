'use client';

import type { Choice } from '../data/bathroom-options';
import Image from 'next/image';

const FALLBACK = '/images/bathroom-builder/fallback/placeholder.svg';

/** Keep the existing img sizing rules and read every surface from the option. */
export default function BuilderOptionImage({
  option,
  alt = '',
}: {
  option: Pick<Choice, 'builderImage' | 'showBuilderImage'>;
  alt?: string;
}) {
  if (!option.showBuilderImage) return null;
  const source = option.builderImage || FALLBACK;
  return (
    <Image
      key={source}
      src={source}
      alt={alt}
      width={960}
      height={720}
      sizes="(max-width: 680px) 90vw, (max-width: 1000px) 60vw, 36vw"
      loading="lazy"
      unoptimized
      onError={(event) => {
        const image = event.currentTarget;
        if (image.getAttribute('src') !== FALLBACK) image.src = FALLBACK;
      }}
    />
  );
}
