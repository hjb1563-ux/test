'use client';

import { type WheelEvent } from 'react';
import BuilderOptionImage from './BuilderOptionImage';
import type { Choice } from '../data/bathroom-options';
import BuilderDisclosure from './BuilderDisclosure';

type Item = { title: string; choice: Choice };

const itemKey = (item: Item) => `${item.title}:${item.choice.id}`;
const HistoryCard = ({ item, active, onPreview }: { item: Item; active?: boolean; onPreview?: (key: string) => void }) => (
  <article>
    {onPreview ? <button type="button" className="historyPreviewButton" aria-label={`${item.choice.name} 이미지 크게 보기`} aria-pressed={!!active} onClick={() => onPreview(itemKey(item))}>
      <BuilderOptionImage option={item.choice} />
    </button> :
    <BuilderOptionImage option={item.choice} />
    }
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
  activePreview,
  onPreview,
}: {
  items: Item[];
  empty?: string;
  variant?: 'current' | 'history';
  activePreview?: string | null;
  onPreview?: (key: string) => void;
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

  // Explicit preview IDs never fall back to an unrelated selected image.
  const representative = activePreview === undefined ? selectedItems.at(-1)
    : selectedItems.find(item => itemKey(item) === activePreview);
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
          <div className="galleryHead"><span>SELECTED OPTIONS</span><h2>선택한 욕실 요소</h2></div>
          {representative ? (
            <div className="selectedHeroImage">
              <BuilderOptionImage option={representative.choice} alt={representative.choice.name} />
            </div>
          ) : <p className="selectedHeroEmpty">{empty}</p>}
          {representative && <p className="selectedHeroLabel">{representative.choice.name}</p>}
          {variant === 'current' && selectedItems.length > 0 && (
            <BuilderDisclosure id="builder-history" title="지금까지 선택한 항목" count={selectedItems.length} className="selectionHistory">
              <div className="galleryHead"><span>SELECTION HISTORY</span><h2>지금까지 선택한 항목</h2></div>
              <div id="builder-image-history-strip" className="selectionHistoryStrip" onWheel={wheel}>
                {selectedItems.map((item) => <HistoryCard key={`history-${item.title}-${item.choice.id}`} item={item} active={representative && itemKey(item) === itemKey(representative)} onPreview={onPreview} />)}
              </div>
            </BuilderDisclosure>
          )}
        </>
      )}
    </section>
  );
}
