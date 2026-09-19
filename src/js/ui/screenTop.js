import { h, clear } from './dom.js';
import * as store from '../data/storage.js';

export function renderTop(ctx) {
  const st = store.load();
  const total = ctx.index.problems.length;
  const cleared = ctx.index.problems.filter(p => st.progress[p.id]?.cleared).length;
  const mcTop = Object.entries(st.misconceptionCount || {}).sort((a, b) => b[1] - a[1]).slice(0, 3);

  const root = h('div', { class: 'wrap' },
    h('div', { class: 'card' },
      h('h1', {}, '力の作図トレーナー'),
      h('p', { class: 'muted' }, '作用点・向き・大きさ・力の名称・力を及ぼす相手を、自分で描いて確かめる練習です。'),
      h('div', { class: 'bar' }, h('i', { style: `width:${total ? (cleared / total * 100).toFixed(1) : 0}%` })),
      h('p', { class: 'muted' }, `クリア ${cleared} / ${total} 題`)
    ),
    h('div', { class: 'top-actions' },
      h('button', { class: 'big-btn', onclick: () => ctx.go('select', { mode: 'practice' }) },
        h('strong', {}, '練習（一問一答）'),
        h('span', {}, '1問ずつ判定。誤りはヒント→解説の順に返します')),
      h('button', { class: 'big-btn', onclick: () => ctx.go('select', { mode: 'test' }) },
        h('strong', {}, 'テスト'),
        h('span', {}, 'まとめて解答し、最後に採点と誤概念の集計を出します'))
    ),
    mcTop.length ? h('div', { class: 'card' },
      h('h2', {}, 'これまでに多かったつまずき'),
      ...mcTop.map(([code, n]) => h('div', { class: 'mc-note' },
        h('strong', {}, `${n}回　`), ctx.feedback[code] || code))
    ) : null,
    st.testResults?.length ? h('div', { class: 'card' },
      h('h2', {}, '最近のテスト結果'),
      h('table', {},
        h('thead', {}, h('tr', {}, h('th', {}, '日時'), h('th', {}, '範囲'), h('th', {}, '点数'), h('th', {}, '確認コード'))),
        h('tbody', {}, ...st.testResults.slice(0, 5).map(r => h('tr', {},
          h('td', {}, new Date(r.at).toLocaleString('ja-JP')),
          h('td', {}, r.range || '—'),
          h('td', {}, `${r.score} / ${r.full}`),
          h('td', {}, r.code))))
      )
    ) : null,
    h('div', { class: 'card' },
      h('h2', {}, '設定'),
      h('div', { class: 'row' },
        h('button', {
          class: 'chip', 'aria-pressed': String(!!ctx.settings.judgeMagnitude),
          onclick: e => {
            ctx.settings.judgeMagnitude = !ctx.settings.judgeMagnitude;
            store.setSetting('judgeMagnitude', ctx.settings.judgeMagnitude);
            e.target.setAttribute('aria-pressed', String(ctx.settings.judgeMagnitude));
          }
        }, '大きさも判定する'),
        h('button', {
          class: 'chip', 'aria-pressed': String(ctx.settings.labelMode === 'symbol'),
          onclick: e => {
            ctx.settings.labelMode = ctx.settings.labelMode === 'symbol' ? 'name' : 'symbol';
            store.setSetting('labelMode', ctx.settings.labelMode);
            e.target.setAttribute('aria-pressed', String(ctx.settings.labelMode === 'symbol'));
          }
        }, '記号表記（W_A←地球）'),
        h('button', {
          class: 'chip', 'aria-pressed': String(ctx.settings.theme === 'dark'),
          onclick: e => {
            ctx.settings.theme = ctx.settings.theme === 'dark' ? 'auto' : 'dark';
            store.setSetting('theme', ctx.settings.theme);
            document.documentElement.dataset.theme = ctx.settings.theme === 'dark' ? 'dark' : '';
            e.target.setAttribute('aria-pressed', String(ctx.settings.theme === 'dark'));
          }
        }, 'ダークモードを固定'),
        h('button', {
          class: 'chip', 'aria-pressed': String(ctx.settings.contrast === 'high'),
          onclick: e => {
            ctx.settings.contrast = ctx.settings.contrast === 'high' ? 'normal' : 'high';
            store.setSetting('contrast', ctx.settings.contrast);
            document.documentElement.dataset.contrast = ctx.settings.contrast === 'high' ? 'high' : '';
            e.target.setAttribute('aria-pressed', String(ctx.settings.contrast === 'high'));
          }
        }, 'ハイコントラスト')
      ),
      h('p', { class: 'muted' },
        '「大きさも判定する」を入れると、矢印の長さ（5段階）で力の大小関係まで判定します。'
        + 'まずは力を過不足なく挙げられるようにしたい段階では、切ったまま使ってください。'),
      h('p', { class: 'muted' }, '進捗はこの端末のブラウザに保存されます（ログイン不要）。'),
      h('button', {
        class: 'ghost small', onclick: () => {
          if (confirm('進捗と結果をすべて消します。よろしいですか？')) { store.reset(); ctx.go('top'); }
        }
      }, '進捗を消す')
    )
  );
  clear(ctx.app).append(root);
}
