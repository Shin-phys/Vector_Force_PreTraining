import { h, clear, dirLabel as DIR } from './dom.js';
import { FigureRenderer, forceLabel } from '../canvas/renderer.js';
import { relationText, answerSteps } from '../logic/relations.js';
import { lengthOfStep } from '../canvas/geometry.js';
import { summarize, makeCode } from '../logic/score.js';
import { loadProblem } from '../data/loader.js';
import * as store from '../data/storage.js';

const VD_LABEL = {
  CORRECT: '正しい', WRONG_POINT: '作用点が違う', WRONG_ANGLE: '向きが違う',
  WRONG_SOURCE: '相手が違う', EXTRA: '余分な力', MISSING: '描かれていない'
};
const isLastPart = (problem, part) => problem.parts[problem.parts.length - 1].id === part.id;

/** 自分の図と正解の重ね合わせ */
export async function renderOverlay(host, problem, part, inputs, judged, ctx) {
  const r = new FigureRenderer(host);
  await r.mount(problem.figure);
  r.catalog = ctx.catalog;
  const body = (part.targetBody || 'body-a').replace('body-', '');
  const mine = inputs.map(f => {
    const it = judged?.items.find(x => x.input === f);
    return { ...f, verdict: it?.verdict };
  });
  const st = answerSteps(problem);
  const answers = (part.answers || []).map(a => ({
    ...a, body, state: 'answer', step: st[a.key], length: lengthOfStep(st[a.key])
  }));
  r.drawForces([...answers, ...mine], { labelMode: ctx.settings.labelMode });
  return r;
}

export async function renderResult(ctx, p) {
  const { problem, part, judged, relResults, codes, ok, forcesOk, step } = p;
  const rels = (relResults || []).filter(r => r.status !== 'na');
  const heading = ok ? '正解です'
    : (forcesOk ? '力は正しく描けています。大きさだけ見直しましょう' : 'ここを見直しましょう');
  const s = ctx.session;
  const key = `${problem.id}:${part.id}`;
  const inputs = s.inputs[key] || [];
  const figHost = h('div');
  const wrap = h('div', { class: 'figure-wrap' }, figHost);
  const keyLabels = Object.fromEntries((part.answers || []).map(a => [a.key, forceLabel(a, ctx.catalog, 'symbol')]));
  for (const pp of problem.parts) for (const a of (pp.answers || [])) keyLabels[a.key] = forceLabel({ ...a, body: (pp.targetBody || 'body-a').replace('body-', '') }, ctx.catalog, 'symbol');

  const isLastStep = s.pos === s.queue.length - 1;

  const root = h('div', { class: 'wrap' },
    h('div', { class: 'card' },
      h('div', { class: 'row between' },
        h('h1', {}, heading),
        h('span', { class: 'muted' }, `${problem.id}　${part.prompt}`)),
      wrap,
      h('p', { class: 'legend' },
        '自分の図：', h('i', { style: 'background:var(--ok)' }), '正しい　',
        h('i', { style: 'background:var(--ng)' }), '誤り　／　正解：',
        h('i', { style: 'background:var(--force-answer)' }), '破線')
    ),
    h('div', { class: 'card' },
      h('h2', {}, '判定'),
      h('table', {},
        h('thead', {}, h('tr', {}, h('th', {}, '描いた力'), h('th', {}, '相手'), h('th', {}, '向き'), h('th', {}, '判定'))),
        h('tbody', {},
          ...judged.items.map(it => h('tr', {},
            h('td', {}, (ctx.catalog.forces[it.input.type] || {}).label || it.input.type),
            h('td', {}, (ctx.catalog.sources[it.input.from] || {}).label || it.input.from),
            h('td', {}, DIR(it.input.angle)),
            h('td', { class: `v-${it.verdict}` }, VD_LABEL[it.verdict]))),
          ...judged.missing.map(m => h('tr', {},
            h('td', {}, (ctx.catalog.forces[m.type] || {}).label || m.type),
            h('td', {}, (ctx.catalog.sources[m.from] || {}).label || m.from),
            h('td', {}, DIR(m.angle)),
            h('td', { class: 'v-MISSING' }, VD_LABEL.MISSING)))
        )),
      rels.length ? h('div', {},
        h('h3', {}, '大きさの関係'),
        ...rels.map(rr => {
          const A = keyLabels[rr.a] || rr.a;
          const now = rr.sa === rr.sb ? '同じ長さで描かれています'
            : `${A} の方が${rr.sa > rr.sb ? '長く' : '短く'}描かれています`;
          return h('p', { class: rr.status === 'ng' ? 'v-WRONG_ANGLE' : 'v-CORRECT' },
            `${relationText(rr, ctx.catalog, keyLabels)} … ${rr.status === 'ok' ? '合っています' : `いまは${now}`}`);
        })
      ) : null
    ),
    codes?.length ? h('div', { class: 'card' },
      h('h2', {}, '解説'),
      ...codes.map(c => h('div', { class: 'mc-note' }, ctx.feedback[c] || c))
    ) : null,
    problem.explanation ? h('div', { class: 'card' }, h('h2', {}, 'この場面のポイント'), h('p', {}, problem.explanation)) : null,
    (problem.sceneSetSummary && isLastPart(problem, part)) ? h('div', { class: 'card' },
      h('h2', {}, '連続した場面をくらべる'), h('p', {}, problem.sceneSetSummary)) : null,
    h('div', { class: 'sticky-actions' },
      h('button', {
        class: 'ghost', onclick: () => { s.inputs[key] = []; s.attempts[key] = 0; ctx.go('solve'); }
      }, 'この問いをもう一度'),
      !isLastStep ? h('button', { class: 'primary', onclick: () => { s.pos += 1; ctx.go('solve'); } }, '次へ') : null,
      isLastStep ? h('button', { class: 'primary', onclick: () => ctx.go('top') }, 'TOPへ') : null,
      h('button', { class: 'ghost', onclick: () => ctx.go('select', { mode: s.mode }) }, '問題一覧へ')
    )
  );
  clear(ctx.app).append(root);
  await renderOverlay(figHost, problem, part, inputs, judged, ctx);
}

export async function renderTestResult(ctx) {
  const s = ctx.session;
  const records = [];
  for (const q of s.queue) {
    const key = `${q.id}:${q.partId}`;
    const judged = s.judged[key] || { items: [], missing: [], total: q.answerCount || 0, correct: 0, extra: 0, allCorrect: false };
    const isLast = q.partIndex === (q.partCount || 1) - 1;
    records.push({
      problemId: q.id, partId: q.partId, judged, codes: s.codes[key] || [],
      relResults: isLast ? (s.rel[q.id] || []) : []
    });
  }
  const sum = summarize(records);
  const code = makeCode();
  const at = new Date().toISOString();
  store.recordTest({ at, range: s.rangeLabel, score: sum.problemCorrect, full: sum.problemTotal, code });
  for (const r of records) store.recordCodes([]);

  const reviewHost = h('div');
  const root = h('div', { class: 'wrap' },
    h('div', { class: 'card' },
      h('h1', {}, 'テスト結果'),
      h('p', { class: 'score' }, `${sum.problemCorrect} / ${sum.problemTotal} 題`),
      h('p', { class: 'muted' }, `力1本単位の部分点：${sum.forceCorrect} / ${sum.forceTotal} 本`),
      sum.relTotal ? h('p', { class: 'muted' }, `大きさの関係：${sum.relCorrect} / ${sum.relTotal}`) : null,
      sum.magProblems?.length ? h('p', { class: 'muted' }, `大きさを見直したい問題：${sum.magProblems.join('、')}`) : null,
      sum.partialProblems.length ? h('p', { class: 'muted' }, `一部のパートだけ正解：${sum.partialProblems.join('、')}`) : null,
      h('p', { class: 'muted' }, `${new Date(at).toLocaleString('ja-JP')}　範囲：${s.rangeLabel}　確認コード：${code}`)
    ),
    h('div', { class: 'card' },
      h('h2', {}, 'つまずきの集計'),
      sum.misconceptions.length
        ? h('div', {}, ...sum.misconceptions.map(([c, n]) => h('div', { class: 'mc-note' },
          h('strong', {}, `${n}件　`), ctx.feedback[c] || c)))
        : h('p', { class: 'muted' }, '目立った誤概念はありませんでした。')
    ),
    h('div', { class: 'card' }, h('h2', {}, '1問ずつの見直し'), reviewHost),
    h('div', { class: 'sticky-actions' },
      h('button', { class: 'primary', onclick: () => ctx.go('top') }, 'TOPへ'),
      h('button', { class: 'ghost', onclick: () => ctx.go('select', { mode: 'test' }) }, '別の範囲でもう一度')
    )
  );
  clear(ctx.app).append(root);

  for (const q of s.queue) {
    const key = `${q.id}:${q.partId}`;
    const problem = await loadProblem(q.path);
    const part = problem.parts[q.partIndex];
    const judged = s.judged[key];
    const box = h('details', { class: 'card', style: 'padding:10px 12px' },
      h('summary', {}, `${q.id}${problem.parts.length > 1 ? `（${q.partId}）` : ''}　${problem.title}　… ${judged?.allCorrect ? '○' : '×'}`));
    const figHost = h('div');
    box.append(h('div', { class: 'figure-wrap', style: 'margin-top:8px' }, figHost));
    if (problem.explanation) box.append(h('p', { class: 'muted' }, problem.explanation));
    reviewHost.append(box);
    box.addEventListener('toggle', async () => {
      if (box.open && !figHost.dataset.done) {
        figHost.dataset.done = '1';
        await renderOverlay(figHost, problem, part, s.inputs[key] || [], judged, ctx);
      }
    }, { once: false });
  }
}
