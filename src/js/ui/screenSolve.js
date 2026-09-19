import { h, clear } from './dom.js';
import { FigureRenderer } from '../canvas/renderer.js';
import { DrawInput } from '../canvas/input.js';
import { judgePart } from '../logic/judge.js';
import { judgeRelations } from '../logic/relations.js';
import { collectCodes, HINTS, MAGNITUDE_HINT } from '../logic/feedback.js';
import { loadProblem } from '../data/loader.js';
import { ForcePalette } from './forcePalette.js';
import { renderForceList } from './forceList.js';
import * as store from '../data/storage.js';
import { CONFIG } from '../config.js';

let uidSeq = 1;

export async function renderSolve(ctx) {
  const s = ctx.session;
  const step = s.queue[s.pos];
  const problem = await loadProblem(step.path);
  const part = problem.parts[step.partIndex];
  part.bodyKey = (part.targetBody || 'body-a').replace('body-', '');
  const key = `${problem.id}:${part.id}`;
  s.inputs[key] = s.inputs[key] || [];
  s.attempts[key] = s.attempts[key] || 0;
  const isLastPart = step.partIndex === problem.parts.length - 1;
  const magOn = !!ctx.settings.judgeMagnitude && (problem.relations || []).length > 0;
  const isLastStep = s.pos === s.queue.length - 1;

  const figHost = h('div');
  const wrap = h('div', { class: 'figure-wrap' },
    problem.frame === 'ACCELERATED'
      ? h('div', { class: 'frame-banner' }, `この図は ${problem.observer || '加速している観測者'} から見た図です`)
      : null,
    figHost);
  const hintbar = h('div', { class: 'hintbar' });
  const palHost = h('div');
  const listHost = h('div', { class: 'force-list' });
  const actions = h('div', { class: 'sticky-actions' });

  const root = h('div', { class: 'wrap' },
    h('div', { class: 'card' },
      h('div', { class: 'solve-head' },
        h('span', { class: 'pid' }, problem.id),
        h('strong', {}, problem.title),
        h('span', { class: 'spacer' }),
        h('span', { class: 'muted' }, `${s.pos + 1} / ${s.queue.length}`),
        h('button', { class: 'ghost small', onclick: () => ctx.go('top') }, '中断')),
      problem.prompt ? h('p', { class: 'muted' }, problem.prompt) : null,
      h('p', { class: 'prompt' }, part.prompt),
      wrap, hintbar),
    h('div', { class: 'card' }, palHost),
    h('div', { class: 'card' },
      h('div', { class: 'row between' }, h('h3', {}, '描いた力'),
        h('button', {
          class: 'ghost small', onclick: () => { s.inputs[key].pop(); paint(); }
        }, '1手戻る')),
      listHost),
    actions
  );
  clear(ctx.app).append(root);

  /* ---- 図と入力 ---- */
  const r = new FigureRenderer(figHost);
  await r.mount(problem.figure);
  r.catalog = ctx.catalog;
  r.labelMode = ctx.settings.labelMode;
  const snapMap = Object.fromEntries(r.snaps.map(sn => [sn.id, sn]));
  r.showSnapMarkers(true, null, part.bodyKey);

  // 名称と相手を選んだら、図が画面外にあってもすぐ触れるように戻す（スマホで効く）
  const palette = new ForcePalette(palHost, ctx.catalog, sel => {
    hintbar.textContent = '';
    if (sel.type && sel.from) {
      const rect = wrap.getBoundingClientRect();
      if (rect.top < 0 || rect.bottom > window.innerHeight) {
        wrap.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    }
  });
  palette.render(part);

  const input = new DrawInput(r, wrap, {
    getSelection: () => palette.get(),
    getBody: () => part.bodyKey,
    getSnaps: () => r.snaps.filter(sn => sn.body === part.bodyKey),
    getAnchors: () => problem.angleAnchors || [],
    showLengthGuide: () => magOn,
    onMessage: m => { hintbar.textContent = m; },
    onCommit: f => {
      s.inputs[key].push({ ...f, body: part.bodyKey, uid: `u${uidSeq++}` });
      palette.clearSelection();
      paint();
    }
  });
  input.enable(true);

  function prevForces() {
    if (s.mode === 'test') return [];
    if (step.partIndex === 0) return [];
    if (part.showPreviousPart === false) return [];
    const out = [];
    for (let i = 0; i < step.partIndex; i++) {
      const pp = problem.parts[i];
      (s.inputs[`${problem.id}:${pp.id}`] || []).forEach(f => out.push({ ...f, state: 'prev' }));
    }
    return out;
  }

  function paint() {
    r.drawForces([...prevForces(), ...s.inputs[key]], { labelMode: ctx.settings.labelMode });
    renderForceList(listHost, s.inputs[key], ctx.catalog, {
      labelMode: ctx.settings.labelMode,
      showLength: magOn,
      onDelete: i => { s.inputs[key].splice(i, 1); paint(); },
      onLength: (i, d) => {
        const f = s.inputs[key][i];
        const last = CONFIG.LENGTH_STEPS.length - 1;
        f.step = Math.max(0, Math.min(last, (f.step ?? CONFIG.DEFAULT_STEP) + d));
        f.length = CONFIG.LENGTH_STEPS[f.step];
        paint();
      }
    });
  }
  paint();

  /* ---- ボタン ---- */
  const judgeNow = () => {
    const judged = judgePart(part, s.inputs[key], snapMap);
    s.judged[key] = judged;
    const byPart = {};
    problem.parts.forEach(pp => {
      const k2 = `${problem.id}:${pp.id}`;
      if (s.judged[k2]) byPart[k2] = s.judged[k2];
    });
    const relResults = magOn ? judgeRelations(problem.relations, byPart) : [];
    const codes = collectCodes(problem, part, judged, snapMap, relResults);
    s.codes[key] = codes;
    s.snapMaps[problem.id] = snapMap;
    s.rel[problem.id] = relResults;
    return { judged, relResults, codes };
  };

  if (s.mode === 'practice') {
    actions.append(
      h('button', {
        class: 'primary', onclick: () => {
          if (!s.inputs[key].length) { hintbar.textContent = '力を1つ以上描いてください。'; return; }
          const { judged, relResults, codes } = judgeNow();
          const relNg = relResults.some(x => x.status === 'ng');
          const forcesOk = judged.allCorrect;
          const ok = forcesOk && !relNg;
          s.attempts[key] += 1;
          if (ok) {
            markProgress();
            ctx.go('result', { problem, part, judged, relResults, codes: [], snapMap, ok: true, forcesOk, step });
            return;
          }
          store.recordCodes(codes);
          if (s.attempts[key] < 2) {
            // 力は合っていて大きさだけ誤りなら、長さについてのヒントを返す
            hintbar.textContent = forcesOk
              ? MAGNITUDE_HINT
              : 'もう一度確認してみましょう。 ' + HINTS[Math.min(s.attempts[key] - 1, HINTS.length - 1)];
            if (!forcesOk && s.attempts[key] - 1 >= 2) r.showSnapMarkers(true, null, part.bodyKey);
            return;
          }
          markProgress();
          ctx.go('result', { problem, part, judged, relResults, codes, snapMap, ok: false, forcesOk, step });
        }
      }, '判定する'),
      h('button', { class: 'ghost', onclick: () => { s.inputs[key] = []; paint(); } }, '全部消す')
    );
  } else {
    actions.append(
      s.pos > 0 ? h('button', { onclick: () => { judgeNow(); s.pos -= 1; ctx.go('solve'); } }, '前へ') : null,
      !isLastStep
        ? h('button', {
          class: 'primary', onclick: () => { judgeNow(); s.pos += 1; ctx.go('solve'); }
        }, '次へ')
        : h('button', {
          class: 'primary', onclick: () => {
            judgeNow();
            const blank = s.queue.filter(q => {
              const k2 = `${q.id}:${q.partId}`;
              return !(s.inputs[k2] || []).length;
            });
            if (blank.length && !confirm(`未解答が ${blank.length} 件あります。提出しますか？`)) return;
            ctx.finishTest();
          }
        }, '提出して採点する'),
      h('button', { class: 'ghost', onclick: () => { s.inputs[key] = []; paint(); } }, '全部消す')
    );
  }

  function markProgress() {
    const cleared = problem.parts.every(pp => s.judged[`${problem.id}:${pp.id}`]?.allCorrect)
      && !(s.rel[problem.id] || []).some(x => x.status === 'ng');
    store.recordAttempt(problem.id, cleared);
  }

  ctx.debug = { renderer: r, part, problem, input, session: s };   // 動作確認用
  ctx.cleanup = () => input.destroy();
}
