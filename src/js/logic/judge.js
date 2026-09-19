import { CONFIG } from '../config.js';
import { angleDiff } from '../canvas/geometry.js';

export const VERDICTS = ['CORRECT', 'WRONG_POINT', 'WRONG_ANGLE', 'WRONG_SOURCE', 'EXTRA', 'MISSING'];

const sameAngle = (a, b) => angleDiff(a, b) <= CONFIG.ANGLE_TOL;

/**
 * 入力集合と正解集合を1対1に対応させる。
 * 同じ名称（type）のものだけを対応候補とし、作用点・向き・相手の一致数が多い組を優先する。
 */
export function judgePart(part, inputs, snapMap = {}) {
  const answers = part.answers || [];
  const pairs = [];
  inputs.forEach((inp, i) => {
    answers.forEach((ans, j) => {
      if (inp.type !== ans.type) return;
      const p = inp.snap === ans.snap;
      const a = sameAngle(inp.angle, ans.angle);
      const s = inp.from === ans.from;
      pairs.push({ i, j, score: (p ? 4 : 0) + (a ? 3 : 0) + (s ? 2 : 0), p, a, s });
    });
  });
  pairs.sort((x, y) => y.score - x.score);

  const usedIn = new Set(), usedAns = new Set();
  const matched = [];
  for (const pr of pairs) {
    if (usedIn.has(pr.i) || usedAns.has(pr.j)) continue;
    usedIn.add(pr.i); usedAns.add(pr.j);
    matched.push(pr);
  }

  const items = inputs.map((inp, i) => {
    const pr = matched.find(m => m.i === i);
    const snapInfo = snapMap[inp.snap] || {};
    const crossBody = snapInfo.body && part.bodyKey && snapInfo.body !== part.bodyKey;
    if (!pr) {
      return { input: inp, answerKey: null, verdict: 'EXTRA', flags: {}, crossBody };
    }
    const ans = answers[pr.j];
    let verdict = 'CORRECT';
    if (!pr.p) verdict = 'WRONG_POINT';
    else if (!pr.a) verdict = 'WRONG_ANGLE';
    else if (!pr.s) verdict = 'WRONG_SOURCE';
    return {
      input: inp, answerKey: ans.key, answer: ans, verdict,
      flags: { point: !pr.p, angle: !pr.a, source: !pr.s }, crossBody
    };
  });

  const missing = answers.filter((_, j) => !usedAns.has(j));
  const correct = items.filter(it => it.verdict === 'CORRECT').length;

  return {
    items, missing,
    total: answers.length,
    correct,
    extra: items.filter(it => it.verdict === 'EXTRA').length,
    allCorrect: correct === answers.length && items.length === answers.length
  };
}

/** 入力の中から答えキーに対応するものを引く */
export function itemForKey(judged, key) {
  return judged.items.find(it => it.answerKey === key) || null;
}
