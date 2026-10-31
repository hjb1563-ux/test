'use client';

import { useEffect, useRef, useState, type ReactNode, type RefObject, type MutableRefObject } from 'react';
import { ArrowLeft, ArrowRight, Check, ImageIcon, Maximize2, X } from 'lucide-react';
import { bathroomStyles, type BathroomStyle, type BathroomStyleExample } from '../data/bathroom-style-examples';
import { bathroomStyleContent, bathroomStyleContentGroups, bathroomStyleNotice } from '../data/bathroom-style-content';
import styles from './BathroomStylePreview.module.css';

function ExampleImage({ example }: { example: BathroomStyleExample }) {
  const [failed, setFailed] = useState(false);
  return example.image && !failed ? <img className={styles.image} src={example.image.src} alt={example.image.alt} width={example.image.width} height={example.image.height} onError={() => setFailed(true)} /> :
    <div className={styles.placeholder} role="status"><ImageIcon size={32} aria-hidden="true" /><span>{failed ? '사진을 불러오지 못했습니다' : '완성형 예시 이미지 준비 중'}</span><small>{failed ? '다른 예시를 확인하거나 잠시 후 다시 열어주세요' : '구성 정보는 이미지 확정 후 안내합니다'}</small></div>;
}

const fineHover = () => window.matchMedia('(hover: hover) and (pointer: fine)').matches;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

function MagnifierPhoto({ example, buttonRef, dismissRef, onTouchExpand, children }: {
  example: BathroomStyleExample; buttonRef: RefObject<HTMLButtonElement>;
  dismissRef: MutableRefObject<(() => boolean) | null>; onTouchExpand: () => void; children: ReactNode;
}) {
  const lens = useRef<HTMLSpanElement>(null);
  const frame = useRef<number | null>(null);
  const pointer = useRef({ x: 0, y: 0 });
  const keyboard = useRef(false);
  const position = useRef({ x: .5, y: .5 });
  const suppressed = useRef(false);
  const lastPointer = useRef('');
  const [supportsHover, setSupportsHover] = useState(false);
  const [keyboardActive, setKeyboardActive] = useState(false);

  function hide() {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    if (lens.current) lens.current.hidden = true;
  }

  function paint() {
    const button = buttonRef.current, overlay = lens.current;
    const image = button?.querySelector('img');
    if (!button || !overlay || !image?.naturalWidth || !image.complete) { hide(); return; }
    const bounds = image.getBoundingClientRect(), host = button.getBoundingClientRect();
    const scale = Math.min(bounds.width / image.naturalWidth, bounds.height / image.naturalHeight);
    const width = image.naturalWidth * scale, height = image.naturalHeight * scale;
    const left = bounds.left + (bounds.width - width) / 2, top = bounds.top + (bounds.height - height) / 2;
    const x = keyboard.current ? position.current.x * width : pointer.current.x - left;
    const y = keyboard.current ? position.current.y * height : pointer.current.y - top;
    if (width < 180 || height < 180 || x < 0 || y < 0 || x > width || y > height || suppressed.current) { hide(); return; }
    const radius = 90, zoom = 1.4;
    const cx = clamp(x, radius, width - radius), cy = clamp(y, radius, height - radius);
    // At an edge, clamp the source window as well as the circle: no blank pixels.
    const bx = clamp(radius - x * zoom, 180 - width * zoom, 0);
    const by = clamp(radius - y * zoom, 180 - height * zoom, 0);
    Object.assign(overlay.style, {
      left: `${left - host.left - button.clientLeft + cx - radius}px`,
      top: `${top - host.top - button.clientTop + cy - radius}px`,
      backgroundImage: `url(${JSON.stringify(image.currentSrc || image.src)})`,
      backgroundSize: `${width * zoom}px ${height * zoom}px`, backgroundPosition: `${bx}px ${by}px`,
    });
    overlay.hidden = false;
  }

  function schedule() {
    if (frame.current !== null) return;
    frame.current = requestAnimationFrame(() => { frame.current = null; paint(); });
  }

  useEffect(() => {
    const media = window.matchMedia('(hover: hover) and (pointer: fine)');
    const update = () => { setSupportsHover(media.matches); hide(); keyboard.current = false; setKeyboardActive(false); };
    update(); media.addEventListener('change', update);
    const dismiss = () => {
      const active = keyboard.current || (lens.current ? !lens.current.hidden : false);
      if (active) { suppressed.current = true; keyboard.current = false; setKeyboardActive(false); hide(); }
      return active;
    };
    dismissRef.current = dismiss;
    // Re-read current geometry after scroll/resize instead of keeping stale offsets.
    const geometryChanged = () => { if (keyboard.current) schedule(); else hide(); };
    window.addEventListener('resize', geometryChanged);
    window.addEventListener('scroll', geometryChanged, true);
    return () => {
      hide(); media.removeEventListener('change', update);
      window.removeEventListener('resize', geometryChanged);
      window.removeEventListener('scroll', geometryChanged, true);
      if (dismissRef.current === dismiss) dismissRef.current = null;
    };
  }, [dismissRef]);

  return <button ref={buttonRef} data-gallery-main data-example-title={example.title} className={styles.mainPhoto} type="button"
    aria-label={`${example.title} ${supportsHover ? '돋보기 확대' : '사진 확대'}`} aria-describedby="style-magnifier-help"
    aria-pressed={supportsHover ? keyboardActive : undefined}
    onPointerDown={event => { lastPointer.current = event.pointerType; if (event.pointerType !== 'mouse') { hide(); keyboard.current = false; setKeyboardActive(false); } }}
    onPointerMove={event => {
      if (event.pointerType !== 'mouse' || !fineHover() || keyboard.current) return;
      pointer.current = { x: event.clientX, y: event.clientY }; schedule();
    }}
    onPointerLeave={() => { suppressed.current = false; if (!keyboard.current) hide(); }}
    onBlur={() => { keyboard.current = false; setKeyboardActive(false); hide(); }}
    onClick={event => {
      if (!fineHover() || (event.detail > 0 && lastPointer.current !== 'mouse')) { hide(); onTouchExpand(); return; }
      if (event.detail > 0) return;
      keyboard.current = !keyboard.current; setKeyboardActive(keyboard.current);
      suppressed.current = false; position.current = { x: .5, y: .5 };
      if (keyboard.current) schedule(); else hide();
    }}
    onKeyDown={event => {
      if (event.key === 'Escape' && dismissRef.current?.()) { event.preventDefault(); event.stopPropagation(); return; }
      if (!keyboard.current || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
      event.preventDefault();
      position.current = {
        x: clamp(position.current.x + (event.key === 'ArrowRight' ? .05 : event.key === 'ArrowLeft' ? -.05 : 0), 0, 1),
        y: clamp(position.current.y + (event.key === 'ArrowDown' ? .05 : event.key === 'ArrowUp' ? -.05 : 0), 0, 1),
      }; schedule();
    }}>
    {children}
    <span ref={lens} data-magnifier aria-hidden="true" hidden className={styles.magnifier} />
    <span className={styles.photoCaption}><strong aria-live="polite">{example.title}</strong><span><Maximize2 size={16} aria-hidden="true" />{supportsHover ? '마우스를 올려 확대' : '사진 확대'}</span></span>
    <span id="style-magnifier-help" className={styles.visuallyHidden}>{supportsHover ? 'Enter 또는 Space로 돋보기 켜기. 방향키로 이동하고 Escape로 종료합니다.' : '사진을 누르면 확대합니다.'}</span>
  </button>;
}

export default function BathroomStylePreview({ onContinue, onCreateDraft }: { onContinue: () => void; onCreateDraft?: (exampleId: string) => void }) {
  const [active, setActive] = useState<BathroomStyle | null>(null);
  const [exampleId, setExampleId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const zoomTrigger = useRef<HTMLButtonElement>(null);
  const zoomClose = useRef<HTMLButtonElement>(null);
  const restoreZoomFocus = useRef(false);
  const dismissMagnifier = useRef<(() => boolean) | null>(null);
  const selectedExample = active?.examples.find(example => example.id === exampleId) ?? active?.examples[0];
  const [position, setPosition] = useState(0);
  const strip = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (expanded) zoomClose.current?.focus({ preventScroll: true });
    else if (restoreZoomFocus.current) {
      zoomTrigger.current?.focus({ preventScroll: true });
      restoreZoomFocus.current = false;
    }
  }, [expanded]);

  function closeZoom() { restoreZoomFocus.current = true; setExpanded(false); }

  useEffect(() => {
    if (!active || !dialog.current) return;
    const element = dialog.current;
    const previousOverflow = document.body.style.overflow;
    element.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      element.close();
      document.body.style.overflow = previousOverflow;
      trigger.current?.focus({ preventScroll: true });
    };
  }, [active]);

  function move(index: number) {
    const card = strip.current?.children[index] as HTMLElement | undefined;
    if (card && strip.current) strip.current.scrollTo({ left: card.offsetLeft - (strip.current.children[0] as HTMLElement).offsetLeft, behavior: 'instant' });
  }

  return <section className={styles.preview} aria-labelledby="style-preview-title">
    <header className={styles.heading}><p>욕실 스타일 미리보기</p><h1 id="style-preview-title">어떤 욕실을 원하시나요?</h1><p>완성된 욕실 예시를 살펴보고 원하는 공사 방향을 알아보세요.</p></header>
    <div ref={strip} className={styles.cards} onScroll={() => {
      const element = strip.current;
      if (!element || !element.children.length) return;
      const first = element.children[0] as HTMLElement;
      const second = element.children[1] as HTMLElement;
      setPosition(Math.max(0, Math.min(2, Math.round(element.scrollLeft / (second.offsetLeft - first.offsetLeft)))));
    }}>
      {bathroomStyles.map((style, index) => <button key={style.id} type="button" className={styles.card} aria-haspopup="dialog" onFocus={() => { if (window.matchMedia('(max-width: 767px)').matches) move(index); }} onClick={event => { trigger.current = event.currentTarget; setExampleId(style.examples[0]?.id ?? null); setExpanded(false); setActive(style); }}>
        <ExampleImage example={style.examples[0]} />
        <span className={styles.copy}><strong>{style.title}</strong><span className={styles.subtitle}>{style.subtitle}</span><span>{style.description}</span><span className={styles.detail}>구성 보기 · {style.examples.length}가지 예시 <ArrowRight size={16} aria-hidden="true" /></span></span>
      </button>)}
    </div>
    <nav className={styles.carousel} aria-label="욕실 예시 이동"><button type="button" aria-label="이전 욕실 예시" disabled={position === 0} onClick={() => move(position - 1)}><ArrowLeft size={18} /></button><span aria-live="polite">{position + 1} / 3</span><button type="button" aria-label="다음 욕실 예시" disabled={position === 2} onClick={() => move(position + 1)}><ArrowRight size={18} /></button></nav>
    <footer className={styles.footer}><p>예시는 참고용이며 선택하지 않고 진행할 수 있습니다.</p><button type="button" className="button" onClick={onContinue}>프로젝트 정보 입력하기 <ArrowRight size={18} aria-hidden="true" /></button></footer>
    <dialog ref={dialog} className={`${styles.dialog} ${expanded ? styles.expanded : ''}`} aria-labelledby="style-detail-title" onCancel={event => { if (expanded) { event.preventDefault(); closeZoom(); } else setActive(null); }} onKeyDown={event => {
      if (event.key === 'Escape' && expanded) { event.preventDefault(); event.stopPropagation(); closeZoom(); return; }
      if (event.key === 'Escape' && dismissMagnifier.current?.()) { event.preventDefault(); event.stopPropagation(); return; }
      if (event.key !== 'Tab') return;
      const focusable = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea, [tabindex="0"]')).filter(element => element.getClientRects().length && !element.closest('[hidden]'));
      const first = focusable[0], last = focusable[focusable.length - 1];
      if ((event.shiftKey && document.activeElement === first) || (!event.shiftKey && document.activeElement === last)) {
        event.preventDefault();
        (event.shiftKey ? last : first)?.focus();
      }
    }}>
      <div className={styles.dialogHeader}><div><h2 id="style-detail-title">{expanded ? selectedExample?.title : active?.title ?? '욕실 구성 살펴보기'}</h2><p>{expanded ? '사진 확대 보기' : `${active?.description ?? ''} · ${active?.examples.length ?? 0}가지 예시`}</p></div>{expanded ? <button ref={zoomClose} type="button" aria-label="확대 보기 닫기" onClick={closeZoom}><X size={22} /></button> : <button type="button" autoFocus aria-label="상세 정보 닫기" onClick={() => setActive(null)}><X size={22} /></button>}</div>
      {active && selectedExample && <>
      {expanded && <div className={styles.zoomImage}><ExampleImage key={selectedExample.id} example={selectedExample} /></div>}
      <div className={styles.dialogBody} hidden={expanded} tabIndex={0} role="region" aria-label="욕실 구성 상세 내용">
        <div className={styles.selectedDetail} id="style-example-detail" aria-label={selectedExample.title}>
          <section className={styles.gallery} aria-label={`${active.title} 사진 갤러리`}>
            <MagnifierPhoto key={selectedExample.id} example={selectedExample} buttonRef={zoomTrigger} dismissRef={dismissMagnifier} onTouchExpand={() => setExpanded(true)}>
              {!expanded && <ExampleImage key={selectedExample.id} example={selectedExample} />}
            </MagnifierPhoto>
            <div className={styles.explorer}>
              <p className={styles.explorerLabel}>예시를 눌러 비교해 보세요 · 체크된 사진이 현재 보는 예시입니다</p>
              <div className={styles.exampleList}>
                {active.examples.map(example => <button key={example.id} data-gallery-thumbnail type="button" className={styles.exampleButton} aria-label={`${example.title} 보기`} aria-pressed={example.id === selectedExample.id} aria-controls="style-example-detail" onClick={() => { if (example.id !== selectedExample.id) setExampleId(example.id); }}>
                  {!expanded && <ExampleImage example={example} />}<span><span data-thumbnail-name className={styles.thumbnailName}>{example.title}</span><span className={styles.thumbnailCheck} aria-hidden="true">{example.id === selectedExample.id && <Check data-thumbnail-check size={14} />}</span></span>
                </button>)}
              </div>
            </div>
          </section>
          <ExampleInformation example={selectedExample} onCreateDraft={onCreateDraft} />
        </div>
      </div></>}
    </dialog>
  </section>;
}

function ExampleInformation({ example, onCreateDraft }: { example: BathroomStyleExample; onCreateDraft?: (exampleId: string) => void }) {
  const groups = bathroomStyleContentGroups(bathroomStyleContent[example.id]);
  return <div className={styles.information}>
    <header className={styles.informationHeader}><h3 className={styles.exampleTitle} aria-live="polite">{example.title}</h3></header>
    <div className={styles.categoryList}>
      {groups.map(({key, title, items}) => <section className={styles.categoryCard} key={key} aria-labelledby={`${example.id}-${key}-title`}>
        <h4 id={`${example.id}-${key}-title`}>{title}</h4>
        <ul className={styles.compositionList}>{items.map(item => <li key={item}>{item}</li>)}</ul>
      </section>)}
    </div>
    <p className={styles.constructionNotes} data-style-notice>{bathroomStyleNotice}</p>
    {onCreateDraft && <button type="button" className={`button ${styles.createDraft}`} onClick={() => onCreateDraft(example.id)}>이 구성으로 상담서 만들기 <ArrowRight size={18} aria-hidden="true" /></button>}
  </div>;
}
