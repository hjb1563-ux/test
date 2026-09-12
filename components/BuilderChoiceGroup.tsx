'use client';

import type { ChoiceGroup } from '../data/bathroom-options';
import { customTextKey, selectedIds, type BathroomValues } from '../data/bathroom-selection';
import BuilderChoiceCard from './BuilderChoiceCard';

export default function BuilderChoiceGroup({ group, values, onSelect, onCustomText }: {
  group: ChoiceGroup;
  values: BathroomValues;
  onSelect: (key: string, id: string, multiple?: boolean) => void;
  onCustomText: (key: string, text: string) => void;
}) {
  const ids = selectedIds(values[group.key]);
  const customChoice = group.choices.find(choice => choice.requiresCustomText && ids.includes(choice.id));
  const draft = values[customTextKey(group.key)];
  return <section className="choiceGroup">
    <h2 id={`builder-${group.key}-title`}>{group.title}{group.multiple && <small>복수 선택 가능</small>}</h2>
    <div className="builderChoiceGrid" role={group.multiple ? 'group' : 'radiogroup'} aria-labelledby={`builder-${group.key}-title`}>
      {group.choices.map((choice, index) => {
        const selected = ids.includes(choice.id);
        return <BuilderChoiceCard key={choice.id} label={choice.name} selected={selected} multiple={group.multiple}
          tabIndex={group.multiple || selected || (!ids.length && index === 0) ? 0 : -1}
          onSelect={() => onSelect(group.key, choice.id, group.multiple)} />;
      })}
    </div>
    {customChoice && <label className="builderCustomText" htmlFor={`builder-${group.key}-other`}>
      {group.title} · 기타 내용
      <input id={`builder-${group.key}-other`} type="text" value={typeof draft === 'string' ? draft : ''}
        placeholder="원하는 기타 사항을 입력해주세요."
        onChange={event => onCustomText(group.key, event.target.value)} />
    </label>}
    <style>{`
      .design .options .choiceGroup{container-type:inline-size;padding:20px 0;min-width:0}
      .design .builderChoiceGrid{display:grid;grid-template-columns:minmax(0,1fr);gap:9px;min-width:0}
      .design .builderChoiceCard{display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;min-width:0;min-height:52px;padding:12px 15px;border:1px solid var(--line);border-radius:11px;background:#fffdf9;color:var(--ink);font:500 14px/1.5 'Noto Sans KR',sans-serif;text-align:left;cursor:pointer;transition:border-color 160ms,background-color 160ms;box-shadow:none;transform:none}
      .design .builderChoiceCard:hover{border-color:#b6aa9a;background:#faf6ef}
      .design .builderChoiceCard.selected{border-color:var(--accent);background:#fff2e8;font-weight:600}
      .design .builderChoiceCard:focus-visible{outline:2px solid var(--accent);outline-offset:3px}
      .design .builderChoiceLabel{min-width:0;overflow-wrap:anywhere}
      .design .builderChoiceIndicator{display:flex;align-items:center;justify-content:center;width:19px;height:19px;flex:0 0 19px;border:1px solid #c5beb3;border-radius:50%;color:var(--accent)}
      .design .builderChoiceIndicator--multiple{border-radius:5px}
      .design .builderChoiceCard.selected .builderChoiceIndicator{border-color:var(--accent);background:#fffaf5}
      @container(min-width:380px){.design .builderChoiceGrid{grid-template-columns:repeat(2,minmax(0,1fr))}.design .builderChoiceCard--wide{grid-column:1/-1}}
      @media(max-width:680px){.design .builderChoiceGrid{grid-template-columns:minmax(0,1fr)}}
      @media(prefers-reduced-motion:reduce){.design .builderChoiceCard{transition:none}}
      .design .builderCustomText{display:block;margin-top:12px;font-size:12px;color:var(--muted)}
      .design .builderCustomText input{display:block;box-sizing:border-box;width:100%;margin-top:6px;padding:12px;border:1px solid var(--line);border-radius:7px;font:inherit;color:var(--ink);background:#fffdf9}
      .design .builderCustomText input:focus{outline:2px solid var(--accent);outline-offset:2px}
    `}</style>
  </section>;
}
