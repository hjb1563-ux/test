'use client';

import { type WheelEvent } from 'react';
import BuilderOptionImage from './BuilderOptionImage';
import type { Choice } from '../data/bathroom-options';
import BuilderDisclosure from './BuilderDisclosure';

type Item = { title: string; choice: Choice };

const HistoryCard = ({ item }: { item: Item }) => (
  <article>
    <BuilderOptionImage option={item.choice} />
    <div>
      <small>{item.title}</small>
      <strong>{item.choice.name}</strong>
    </div>
  </article>
);

export default function SelectedOptionGallery({
  items,
  empty = '선택한 항목이 여기에 사진과 함께 정리됩니다.',
  variant = 'current',
}: {
  items: Item[];
  empty?: string;
  variant?: 'current' | 'history';
}) {
  const selectedItems = Array.from(
    new Map(items.filter(item => item.choice.showBuilderImage && item.choice.builderImage).map((item) => [`${item.title}:${item.choice.id}`, item])).values(),
  );

  const wheel = (event: WheelEvent<HTMLElement>) => {
    const target = event.currentTarget;
    if (target.scrollWidth > target.clientWidth && Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
      event.preventDefault();
      target.scrollLeft += event.deltaY;
    }
  };

  const representative = selectedItems.at(-1);
  const resultView = variant === 'history' && selectedItems.length > 8;

  return (
    <section className={`selectedGallery selectedGallery--${variant}`}>
      {!!selectedItems.length && <p className="imageDisclaimer">이해를 돕기 위한 시공 예시 이미지입니다.</p>}
      {resultView ? (
        <>
          <div className="galleryHead"><span>SELECTED OPTIONS</span><h2>선택한 욕실 요소</h2></div>
          <div className="selectedGalleryGrid">
            {selectedItems.map((item) => <HistoryCard key={`${item.title}-${item.choice.id}`} item={item} />)}
          </div>
        </>
      ) : (
        <>
          <div className="galleryHead"><span>CURRENT STEP</span><h2>선택한 욕실 요소</h2></div>
          {representative ? (
            <div className="selectedHeroImage">
              <BuilderOptionImage option={representative.choice} alt={representative.choice.name} />
            </div>
          ) : <p>{items.length ? items.map(item => item.choice.name).join(' · ') : empty}</p>}
          {representative && <p className="selectedHeroLabel">{representative.choice.name}</p>}
          {variant === 'current' && selectedItems.length > 0 && (
            <BuilderDisclosure id="builder-history" title="지금까지 선택한 항목" count={selectedItems.length} className="selectionHistory">
              <div className="galleryHead"><span>SELECTION HISTORY</span><h2>지금까지 선택한 항목</h2></div>
              <div className="selectionHistoryStrip" onWheel={wheel}>
                {selectedItems.map((item) => <HistoryCard key={`history-${item.title}-${item.choice.id}`} item={item} />)}
              </div>
            </BuilderDisclosure>
          )}
        </>
      )}
    </section>
  );
}
