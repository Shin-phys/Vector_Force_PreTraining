import { h, dirLabel as DIR } from './dom.js';
import { forceLabel } from '../canvas/renderer.js';
import { CONFIG } from '../config.js';

/**
 * 描いた力の一覧（重なった矢印を指で選びにくい問題を回避する）。
 * 大きさを判定するときだけ、長さの段階を −／＋ で調整できる。
 */
export function renderForceList(host, forces, catalog, opts = {}) {
  const { onDelete, onLength, labelMode = 'name', showLength = false } = opts;
  host.textContent = '';
  if (!forces.length) {
    host.append(h('div', { class: 'fl-empty' }, 'まだ力を描いていません。'));
    return;
  }
  const last = CONFIG.LENGTH_STEPS.length - 1;
  forces.forEach((f, i) => {
    const meta = catalog.forces[f.type] || {};
    const color = meta.dummy ? 'var(--force-dummy)' : (f.body === 'b' ? 'var(--force-b)' : 'var(--force-a)');
    const step = f.step ?? CONFIG.DEFAULT_STEP;
    host.append(h('div', { class: 'fl-item' },
      h('span', { class: 'sw', style: `background:${color}` }),
      h('span', { class: 'nm' }, `${forceLabel(f, catalog, labelMode)}　（${DIR(f.angle)}向き）`),
      showLength && onLength ? h('span', { class: 'len' },
        h('button', { class: 'small', 'aria-label': '短くする', disabled: step <= 0, onclick: () => onLength(i, -1) }, '−'),
        h('b', {}, `${step + 1}/${last + 1}`),
        h('button', { class: 'small', 'aria-label': '長くする', disabled: step >= last, onclick: () => onLength(i, +1) }, '＋')
      ) : null,
      onDelete ? h('button', { class: 'del', onclick: () => onDelete(i) }, '削除') : null
    ));
  });
}
