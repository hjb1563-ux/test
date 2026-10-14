'use client';

import { useEffect, useLayoutEffect, useRef, useState, type WheelEvent } from 'react';
import BuilderOptionImage from './BuilderOptionImage';
import type { Choice } from '../data/bathroom-options';
import BuilderDisclosure from './BuilderDisclosure';

type Item = { id?: string; title: string; choice: Choice };

const itemKey = (item: Item) => `${item.title}:${item.choice.id}`;
const historyKey = (item: Item) => item.id ?? itemKey(item);

/** Viewing position only; selections and history order remain owned by the Builder. */
function SwipeGallery({ items, previewId, context, empty }: { items: Item[]; previewId: string | null; context: string; empty: string }) {
  const track = useRef<HTMLDivElement>(null);
  const position = useRef(0);
  const [index, setIndex] = useState(0);
  const order = JSON.stringify(items.map(historyKey));
  const active = previewId !== null && items.some(item => historyKey(item) === previewId);
  const currentIndex = Math.min(index, Math.max(0, items.length - 1));

  useLayoutEffect(() => {
    const keys: string[] = JSON.parse(order);
    const nextIndex = previewId === null ? 0 : Math.max(0, keys.indexOf(previewId));
    position.current = nextIndex;
    setIndex(nextIndex);
    const element = track.current;
    element?.scrollTo({ left: nextIndex * element.clientWidth, behavior: 'instant' });
  }, [order, previewId, context]);

  useEffect(() => {
    const element = track.current;
    if (!element) return;
    const observer = new ResizeObserver(() => {
      element.scrollTo({ left: position.current * element.clientWidth, behavior: 'instant' });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [active]);

  return <section className="builderSwipeGallery" aria-label="선택한 욕실 이미지">
    <h2>선택한 욕실 요소</h2>
    {active ? <div className="builderSwipeFrame">
      <div className="builderSwipeTrack" ref={track} tabIndex={0} role="group" aria-label="선택 이미지 갤러리"
        onScroll={event => {
          const element = event.currentTarget;
          if (!element.clientWidth) return;
          const next = Math.max(0, Math.min(items.length - 1, Math.round(element.scrollLeft / element.clientWidth)));
          position.current = next;
          setIndex(next);
        }}
        onKeyDown={event => {
          if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
          event.preventDefault();
          const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1
            : Math.max(0, Math.min(items.length - 1, position.current + (event.key === 'ArrowRight' ? 1 : -1)));
          event.currentTarget.scrollTo({ left: next * event.currentTarget.clientWidth, behavior: 'instant' });
        }}>
        {items.map(item => <div className="builderSwipeSlide" key={historyKey(item)}>
          <BuilderOptionImage option={item.choice} alt={`${item.choice.name} 선택 이미지`} />
        </div>)}
      </div>
      {items.length > 1 && <small className="builderSwipeCounter" aria-live="polite" aria-atomic="true">{currentIndex + 1} / {items.length}</small>}
    </div> : <p className="builderSwipeEmpty" role="status">{empty}</p>}
    <p className="builderSwipeLabel">{active ? items[currentIndex].choice.name : '\u00a0'}</p>
  </section>;
}
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
  mobileGallery = false,
  mobilePreviewId = null,
  mobilePreviewContext = '',
}: {
  items: Item[];
  empty?: string;
  variant?: 'current' | 'history';
  activePreview?: string | null;
  onPreview?: (key: string) => void;
  mobileGallery?: boolean;
  mobilePreviewId?: string | null;
  mobilePreviewContext?: string;
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
    <section className={`selectedGallery selectedGallery--${variant}${mobileGallery ? ' selectedGallery--mobile-integrated' : ''}`}>
      {mobileGallery && <SwipeGallery items={selectedItems} previewId={mobilePreviewId} context={mobilePreviewContext} empty={empty} />}
      {variant !== 'current' && !!selectedItems.length && <p className="imageDisclaimer">이해를 돕기 위한 시공 예시 이미지입니다.</p>}
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
