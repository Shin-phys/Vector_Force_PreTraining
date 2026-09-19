import { loadIndex, loadCatalog, loadFeedback } from './data/loader.js';
import * as store from './data/storage.js';
import { renderTop } from './ui/screenTop.js';
import { renderSelect } from './ui/screenSelect.js';
import { renderSolve } from './ui/screenSolve.js';
import { renderResult, renderTestResult } from './ui/screenResult.js';
import { h, clear } from './ui/dom.js';

const ctx = {
  app: document.getElementById('app'),
  index: null, catalog: null, feedback: null,
  settings: { labelMode: 'name', theme: 'auto', contrast: 'normal', judgeMagnitude: false },
  session: null,
  cleanup: null,

  go(name, params = {}) {
    if (ctx.cleanup) { try { ctx.cleanup(); } catch (e) {} ctx.cleanup = null; }
    window.scrollTo(0, 0);
    const run = async () => {
      if (name === 'top') return renderTop(ctx);
      if (name === 'select') return renderSelect(ctx, params);
      if (name === 'solve') return renderSolve(ctx);
      if (name === 'result') return renderResult(ctx, params);
      if (name === 'testResult') return renderTestResult(ctx);
    };
    run().catch(showError);
  },

  /** 出題キューはパート単位に展開する（2物体の問題は a→b を必ず連続で出す） */
  startSession(mode, problems, rangeLabel) {
    const queue = [];
    for (const p of problems) {
      const parts = p.parts && p.parts.length ? p.parts : [{ id: 'a', answerCount: 0 }];
      parts.forEach((pt, i) => queue.push({
        id: p.id, path: p.path, partIndex: i, partId: pt.id,
        partCount: parts.length, answerCount: pt.answerCount
      }));
    }
    ctx.session = {
      mode, queue, pos: 0, rangeLabel,
      inputs: {}, judged: {}, attempts: {}, codes: {}, snapMaps: {}, rel: {}
    };
    ctx.go('solve');
  },

  finishTest() { ctx.go('testResult'); }
};

function showError(err) {
  console.error(err);
  clear(ctx.app).append(h('div', { class: 'wrap' }, h('div', { class: 'card' },
    h('h2', {}, '読み込みに失敗しました'),
    h('p', {}, String(err && err.message || err)),
    h('p', { class: 'muted' }, 'ローカルサーバー経由で開いているか、data/ と assets/ のファイルが揃っているか確認してください。'),
    h('button', { class: 'primary', onclick: () => location.reload() }, '再読み込み'))));
}

async function boot() {
  const st = store.getSettings();
  Object.assign(ctx.settings, st);
  if (ctx.settings.theme === 'dark') document.documentElement.dataset.theme = 'dark';
  if (ctx.settings.contrast === 'high') document.documentElement.dataset.contrast = 'high';
  const [index, catalog, feedback] = await Promise.all([loadIndex(), loadCatalog(), loadFeedback()]);
  ctx.index = index;
  ctx.catalog = { forces: catalog.forces || catalog, sources: catalog.sources || {} };
  ctx.feedback = feedback;
  ctx.go('top');
}

if (location.protocol !== 'file:') boot().catch(showError);
window.__fdt = ctx;   // 動作確認用
