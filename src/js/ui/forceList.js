import { h, dirLabel as DIR } from './dom.js';
import { forceLabel, circledNumber } from '../canvas/renderer.js';
import { CONFIG } from '../config.js';

const SIDE = { 90: '下側', 270: '上側', 0: '左側', 180: '右側' };

/** 名称を使わないモードで、作用点を言葉にする */
export function snapText(sn) {
  if (!sn) return '作用点';
  if (sn.type === 'CENTER') return '重心';
  const base = sn.type === 'ATTACH' ? '取付点' : '接触点';
  const side = SIDE[Math.round(sn.inward ?? -1)];
  return side ? `${base}（${side}）` : base;
}

/**
 * 描いた力の一覧（重なった矢印を指で選びにくい問題を回避する）。
 * 矢印だけのモードでは番号と作用点で示し、名称を使うモードでは戸籍表記で示す。
 * 大きさを判定するときだけ、長さの段階を −／＋ で調整できる。
 */
export function renderForceList(host, forces, catalog, opts = {}) {
  const { onDelete, onLength, labelMode = 'name', showLength = false, snapInfo = {} } = opts;
  host.textContent = '';
  if (!forces.length) {
    host.append(h('div', { class: 'fl-empty' }, 'まだ力を描いていません。'));
    return;
  }
  const numbered = labelMode === 'number';
  const last = CONFIG.LENGTH_STEPS.length - 1;
  forces.forEach((f, i) => {
    const meta = catalog.forces[f.type] || {};
    const color = meta.dummy ? 'var(--force-dummy)' : (f.body === 'b' ? 'var(--force-b)' : 'var(--force-a)');
    const step = f.step ?? CONFIG.DEFAULT_STEP;
    const text = numbered
      ? `${snapText(snapInfo[f.snap])} から ${DIR(f.angle)}向き`
      : `${forceLabel(f, catalog, labelMode)}　（${DIR(f.angle)}向き）`;
    host.append(h('div', { class: 'fl-item' },
      numbered
        ? h('span', { class: 'num', style: `color:${color}` }, circledNumber(i + 1))
        : h('span', { class: 'sw', style: `background:${color}` }),
      h('span', { class: 'nm' }, text),
      showLength && onLength ? h('span', { class: 'len' },
        h('button', { class: 'small', 'aria-label': '短くする', disabled: step <= 0, onclick: () => onLength(i, -1) }, '−'),
        h('b', {}, `${step + 1}/${last + 1}`),
        h('button', { class: 'small', 'aria-label': '長くする', disabled: step >= last, onclick: () => onLength(i, +1) }, '＋')
      ) : null,
      onDelete ? h('button', { class: 'del', onclick: () => onDelete(i) }, '削除') : null
    ));
  });
}
