import { h, clear } from './dom.js';
import * as store from '../data/storage.js';
import { CONFIG } from '../config.js';
import { levelPicker, levelNote } from './levelPick.js';

export function renderSelect(ctx, { mode }) {
  const st = store.load();
  const all = ctx.index.problems;
  const state = { unit: null, tag: null };
  const tags = [...new Set(all.flatMap(p => p.tags || []))].sort();

  const listHost = h('div', { class: 'plist' });
  const magNote = h('p', { class: 'step-note' }, levelNote(ctx.settings.level || 'arrow'));
  const countLabel = h('p', { class: 'muted' });

  const filtered = () => all.filter(p =>
    (!state.unit || p.unit === state.unit) && (!state.tag || (p.tags || []).includes(state.tag)));

  function paint() {
    const list = filtered();
    countLabel.textContent = `${list.length} 題`;
    clear(listHost);
    for (const p of list) {
      const done = st.progress[p.id]?.cleared;
      listHost.append(h('button', {
        class: 'pitem', onclick: () => ctx.startSession(mode, [p], `${p.id} ${p.title}`)
      },
        h('span', { class: 'id' }, p.id),
        h('span', { class: 'ttl' }, p.title,
          h('span', { class: 'tagline' }, ' ', (p.tags || []).join('・'))),
        h('span', { class: 'mark' }, done ? '✓' : '')
      ));
    }
  }

  const chipRow = (items, kind, labelOf) => h('div', { class: 'chips' },
    items.map(v => h('button', {
      class: 'chip', 'aria-pressed': 'false', dataset: { v },
      onclick: e => {
        state[kind] = state[kind] === v ? null : v;
        e.currentTarget.parentElement.querySelectorAll('.chip')
          .forEach(c => c.setAttribute('aria-pressed', String(c.dataset.v === state[kind])));
        paint();
      }
    }, labelOf(v))));

  const root = h('div', { class: 'wrap' },
    h('div', { class: 'card' },
      h('div', { class: 'row between' },
        h('h1', {}, mode === 'test' ? 'テスト：出題範囲' : '練習：出題範囲'),
        h('button', { class: 'ghost small', onclick: () => ctx.go('top') }, 'TOPへ')),
      h('div', { class: 'pal-label' }, '単元'),
      chipRow(ctx.index.units.map(u => u.key), 'unit',
        k => { const u = ctx.index.units.find(x => x.key === k); return `${u.code} ${u.label}`; }),
      h('div', { class: 'pal-label' }, 'タグ'),
      chipRow(tags, 'tag', t => t),
      h('div', { class: 'pal-label' }, '判定のレベル'),
      levelPicker(ctx, magNote),
      magNote,
      h('div', { class: 'row', style: 'margin-top:12px' },
        h('button', {
          class: 'primary',
          onclick: () => {
            const list = filtered();
            if (!list.length) return;
            ctx.startSession(mode, list, rangeLabel(state, ctx));
          }
        }, 'この範囲を順に解く'),
        h('button', {
          onclick: () => {
            const list = shuffle(filtered()).slice(0, CONFIG.RANDOM_COUNT);
            if (!list.length) return;
            ctx.startSession(mode, list, `ランダム${list.length}題`);
          }
        }, `ランダム${CONFIG.RANDOM_COUNT}題`),
        countLabel
      )
    ),
    h('div', { class: 'card' }, h('h2', {}, '問題を選ぶ'), listHost)
  );
  paint();
  clear(ctx.app).append(root);
}

function rangeLabel(state, ctx) {
  const u = state.unit ? ctx.index.units.find(x => x.key === state.unit)?.label : null;
  return [u, state.tag].filter(Boolean).join('／') || '全問';
}

function shuffle(a) {
  const b = a.slice();
  for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
  return b;
}
