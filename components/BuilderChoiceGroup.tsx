'use client';

import { Fragment } from 'react';
import { ChevronDown } from 'lucide-react';
import type { ChoiceGroup } from '../data/bathroom-options';
import { customTextKey, selectedIds, selectionLabel, type BathroomValues } from '../data/bathroom-selection';
import BuilderChoiceCard from './BuilderChoiceCard';
import { resolveBuilderImage } from '../data/bathroom-builder-image-resolver';

export default function BuilderChoiceGroup({ group, number, values, onSelect, onCustomText, accordion }: {
  group: ChoiceGroup;
  number?: number;
  values: BathroomValues;
  onSelect: (key: string, id: string, multiple?: boolean) => void;
  onCustomText: (key: string, text: string) => void;
  accordion?: { open: boolean; toggle: () => void; advance: () => void };
}) {
  const ids = selectedIds(values[group.key]);

  const customChoice = group.choices.find(choice => choice.requiresCustomText && ids.includes(choice.id));
  const draft = values[customTextKey(group.key)];
  return <section className="choiceGroup" data-accordion={!!accordion} data-open={accordion?.open ?? true}>
    {accordion && <button type="button" id={`builder-${group.key}-toggle`} className="builderSectionToggle"
      aria-expanded={accordion.open} aria-controls={`builder-${group.key}-content`} onClick={accordion.toggle}>
      <span className="builderSectionTitleRow"><span>{number !== undefined && <em>{String(number).padStart(2, '0')}</em>}{group.title}</span>{group.multiple && <small>복수 선택</small>}<ChevronDown size={18} aria-hidden="true" /></span>
      <span className="builderSectionSelection">{selectionLabel(values, group)}</span>
    </button>}
    <header className="builderSectionHeader">
      {number !== undefined && <span className="builderSectionNumber" aria-hidden="true">{String(number).padStart(2, '0')}</span>}
      <div className="builderSectionTitleRow">
        <h2 id={`builder-${group.key}-title`}>{group.title}</h2>
        {group.multiple && <small>복수 선택</small>}
      </div>
    </header>
    <div className="builderSectionContent" id={`builder-${group.key}-content`}>
    {group.key === 'ventilation' && <label className="builderCustomText" htmlFor="builder-ventilation-other">
      환풍기
      <input id="builder-ventilation-other" type="text" value={typeof draft === 'string' ? draft : ''}
        placeholder="환풍기 제품명 입력" onChange={event => onCustomText(group.key, event.target.value)} />
    </label>}
    {group.key === 'accessory' && <label className="builderCustomText" htmlFor="builder-accessory-other">
      직접 입력
      <input id="builder-accessory-other" type="text" value={typeof draft === 'string' ? draft : ''}
        placeholder="(ex : 휴지걸이, 수건걸이, 코너 선반· ·)"
        onChange={event => onCustomText(group.key, event.target.value)} />
    </label>}
    {group.choices.length > 0 && <div className="builderChoiceGrid" role={group.multiple ? 'group' : 'radiogroup'} aria-label={group.title}>
      {group.choices.map((choice, index) => {
        const selected = ids.includes(choice.id);
        return <Fragment key={choice.id}><BuilderChoiceCard label={choice.name} selected={selected} multiple={group.multiple}
          imageOption={group.key === 'tileSurface' ? resolveBuilderImage(group.key, choice, values) : undefined}
          tabIndex={group.multiple || selected || (!ids.length && index === 0) ? 0 : -1}
          onSelect={(event) => {
            onSelect(group.key, choice.id, group.multiple);
            if (accordion && !group.multiple && !selected && !choice.requiresCustomText && event?.detail && window.matchMedia('(max-width: 767px)').matches) accordion.advance();
          }} />
    {customChoice?.id === choice.id && <label className="builderCustomText" htmlFor={`builder-${group.key}-other`}>
      {group.title} · 기타 내용
      <input id={`builder-${group.key}-other`} type="text" value={typeof draft === 'string' ? draft : ''}
        placeholder={group.key === 'wallTileSize' ? '대형 타일, 모자이크 타일, 박판 타일, 포인트 타일···' : '원하는 기타 사항을 입력해주세요.'}
        onChange={event => onCustomText(group.key, event.target.value)} />
    </label>}</Fragment>;
      })}
    </div>}
    </div>
    <style>{`
      .design .builderChoiceCard:disabled{opacity:.55;cursor:not-allowed;background:#f0ede7;border-color:#ded7cc}
      .design .builderRestriction{margin:10px 0 0;font-size:12px;line-height:1.5;color:#716b63}
      .design .options .choiceGroup{padding:0;min-width:0;border-top:0}
      .design .options .choiceGroup + .choiceGroup{margin-top:32px}
      .design .options .builderSectionHeader{margin-bottom:14px;padding:14px 16px;border-radius:10px;background:#f1ece3}
      .design .options .builderSectionNumber{display:block;margin-bottom:5px;color:#96664f;font-size:11px;font-weight:600;line-height:1.4;letter-spacing:.1em;font-variant-numeric:tabular-nums}
      .design .options .builderSectionHeader h2{display:block;margin:0;color:#303631;font-size:18px;font-weight:600;line-height:1.35;overflow-wrap:anywhere}
      .design .options .builderSectionTitleRow{display:flex;align-items:center;justify-content:space-between;gap:12px;min-width:0}
      .design .options .builderSectionTitleRow h2{flex:1;min-width:0}
      .design .options .builderSectionTitleRow small{flex-shrink:0;margin:0;color:#716b63;font-size:11px;font-weight:500;line-height:1.4;white-space:nowrap}
      .design .builderChoiceGrid{display:grid;grid-template-columns:minmax(0,1fr);gap:8px;min-width:0}
      .design .builderChoiceCard{box-sizing:border-box;display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;min-width:0;min-height:48px;padding:10px 16px;border:1px solid #ded7cc;border-radius:10px;background:#fcfbf8;color:#303631;font:500 14px/1.4 'Noto Sans KR',sans-serif;text-align:left;cursor:pointer;transition:border-color 160ms,background-color 160ms;box-shadow:none;transform:none}
      .design .builderChoiceCard:hover{border-color:#b6aa9a;background:#faf6ef}
      .design .builderChoiceCard.selected{border-color:#a87359;background:#fff5ef}
      .design .builderChoiceCard:focus-visible{outline:2px solid #a87359;outline-offset:3px}
      .design .builderChoiceLabel{min-width:0;white-space:normal;overflow-wrap:anywhere;text-align:left}
      .design .builderSurfaceThumbnail{display:block;width:56px;height:42px;flex:0 0 56px;border-radius:4px;overflow:hidden;background:#fffdf9}
      .design .builderSurfaceThumbnail img{display:block;width:100%;height:100%;object-fit:contain;object-position:center}
      .design .builderSurfaceThumbnail + .builderChoiceLabel{flex:1}
      .design .builderChoiceIndicator{display:flex;align-items:center;justify-content:center;width:19px;height:19px;flex:0 0 19px;border:1px solid #c5beb3;border-radius:50%;color:#96664f}
      .design .builderChoiceIndicator--multiple{border-radius:5px}
      .design .builderChoiceCard.selected .builderChoiceIndicator{border-color:#a87359;background:#fffaf5}
      @media(prefers-reduced-motion:reduce){.design .builderChoiceCard{transition:none}}
      .design .builderCustomText{display:block;margin-top:12px;font-size:12px;color:var(--muted)}
      .design .builderCustomText input{display:block;box-sizing:border-box;width:100%;margin-top:6px;padding:12px;border:1px solid var(--line);border-radius:7px;font:inherit;color:var(--ink);background:#fffdf9}
      .design #builder-wallTileSize-other::placeholder{font-size:12px;letter-spacing:-.02em}
      @media(min-width:768px) and (max-width:1199px){.design #builder-wallTileSize-other::placeholder{font-size:11.5px}}
      @media(min-width:1200px){.design #builder-wallTileSize-other::placeholder{font-size:11px;letter-spacing:-.025em}}
      .design #builder-accessory-other,.design #builder-ventilation-other{min-height:48px;font-size:14px}
      .design .builderCustomText input:focus{outline:2px solid var(--accent);outline-offset:2px}
    `}</style>
  </section>;
}
