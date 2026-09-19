import { h } from './dom.js';
import * as store from '../data/storage.js';

/** 判定のレベル。①から順に負荷を足していく */
export const LEVELS = [
  { key: 'arrow', label: '① 矢印だけ', note: '作用点と向きだけを判定します。力の名称や「何から受ける力か」は選びません。まずは力を過不足なく挙げられるようにする段階です。' },
  { key: 'named', label: '② 名称と相手も', note: '力の名称と「何から受ける力か」まで選ばせ、判定します。' },
  { key: 'magnitude', label: '③ 大きさも', note: '矢印の長さ（5段階）で、つりあいや作用・反作用などの大小関係まで判定します。' }
];

export const levelNote = key => (LEVELS.find(l => l.key === key) || LEVELS[0]).note;

/** 3段の切り替え。note 要素を渡すと説明文も書き換える */
export function levelPicker(ctx, note, onChange) {
  const box = h('div', { class: 'level-pick' },
    LEVELS.map(l => h('button', {
      class: 'chip', 'aria-pressed': String((ctx.settings.level || 'arrow') === l.key),
      dataset: { level: l.key },
      onclick: () => {
        ctx.settings.level = l.key;
        store.setSetting('level', l.key);
        box.querySelectorAll('.chip').forEach(c =>
          c.setAttribute('aria-pressed', String(c.dataset.level === l.key)));
        if (note) note.textContent = l.note;
        onChange?.(l.key);
      }
    }, l.label))
  );
  return box;
}
