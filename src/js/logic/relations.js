import { CONFIG } from '../config.js';
import { itemForKey } from './judge.js';

/**
 * 大きさの関係（relations）を、矢印の長さの「段階」で判定する。
 * 段階が離散値なので許容誤差は使わない（= は同じ段階、< > は1段階以上の差）。
 * 対応する入力が無い関係は 'na'（判定しない）。
 */
export function judgeRelations(relations = [], judgedByPart = {}) {
  const inputFor = key => {
    for (const pid in judgedByPart) {
      const it = itemForKey(judgedByPart[pid], key);
      if (it) return it.input;
    }
    return null;
  };
  return relations.map(rel => {
    const ia = inputFor(rel.a), ib = inputFor(rel.b);
    if (!ia || !ib) return { ...rel, status: 'na' };

    let ok;
    if (ia.step != null && ib.step != null) {
      if (rel.op === '=') ok = ia.step === ib.step;
      else if (rel.op === '<') ok = ia.step < ib.step;
      else if (rel.op === '>') ok = ia.step > ib.step;
      else ok = true;
    } else {
      // 段階を持たない入力（古い保存データなど）への予備の判定
      const la = ia.length, lb = ib.length, base = Math.max(la, lb);
      const tol = rel.tolerance ?? CONFIG.EQ_TOL;
      if (rel.op === '=') ok = Math.abs(la - lb) / base <= tol;
      else if (rel.op === '<') ok = (lb - la) / base >= CONFIG.CMP_MIN;
      else if (rel.op === '>') ok = (la - lb) / base >= CONFIG.CMP_MIN;
      else ok = true;
    }
    return { ...rel, status: ok ? 'ok' : 'ng', sa: ia.step, sb: ib.step };
  });
}

export function relationText(rel, catalog, keyLabels = {}) {
  const A = keyLabels[rel.a] || rel.a, B = keyLabels[rel.b] || rel.b;
  const op = rel.op === '=' ? '＝' : (rel.op === '<' ? '＜' : '＞');
  return `${A} ${op} ${B}${rel.note ? `（${rel.note}）` : ''}`;
}

/**
 * 正解を重ねて表示するときの矢印の長さ（段階）を relations から決める。
 * 既定は中央の段階。`<` `>` `=` を順に当てはめて調整する。
 */
export function answerSteps(problem) {
  const mid = CONFIG.DEFAULT_STEP, last = CONFIG.LENGTH_STEPS.length - 1;
  const step = {};
  for (const part of problem.parts || []) for (const a of part.answers || []) step[a.key] = mid;
  const clamp = v => Math.max(0, Math.min(last, v));
  for (let pass = 0; pass < 3; pass++) {
    for (const r of problem.relations || []) {
      if (!(r.a in step) || !(r.b in step)) continue;
      if (r.op === '=') step[r.a] = step[r.b];
      else if (r.op === '<' && step[r.a] >= step[r.b]) step[r.a] = clamp(step[r.b] - 1);
      else if (r.op === '>' && step[r.a] <= step[r.b]) step[r.a] = clamp(step[r.b] + 1);
    }
  }
  return step;
}
