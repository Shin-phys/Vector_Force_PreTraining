// 角度は「数学座標」（右=0°, 反時計回りが正, 上=90°, 下=270°）で扱う。
// SVGはy軸が下向きなので、画面へ変換する処理はこのファイルに閉じ込める。
import { CONFIG } from '../config.js';

export function norm360(a) { a = a % 360; return a < 0 ? a + 360 : a; }

/** 論理角度 → 画面角度（deg） */
export function toScreenAngle(a) { return -a; }

/** 論理角度の単位ベクトル（画面座標の増分） */
export function unitVec(a) {
  const r = a * Math.PI / 180;
  return { x: Math.cos(r), y: -Math.sin(r) };
}

/** 点 p から論理角度 a の向きに len 進んだ点（画面座標） */
export function pointAt(p, a, len) {
  const v = unitVec(a);
  return { x: p.x + v.x * len, y: p.y + v.y * len };
}

/** 画面座標の増分 → 論理角度 */
export function angleFromDelta(dx, dy) {
  return norm360(Math.atan2(-dy, dx) * 180 / Math.PI);
}

export function dist(p, q) { return Math.hypot(p.x - q.x, p.y - q.y); }

export function angleDiff(a, b) {
  const d = Math.abs(norm360(a) - norm360(b)) % 360;
  return d > 180 ? 360 - d : d;
}

export function perpAngle(a) { return norm360(a + 90); }

/**
 * 角度スナップ。step の倍数＋問題固有のアンカーを候補にし、最も近いものへ吸着する。
 * アンカーは優先度が高く、同程度に近い場合はアンカーを選ぶ。
 */
export function snapAngle(a, anchors = [], step = CONFIG.ANGLE_STEP) {
  const cands = [];
  for (let k = 0; k < 360 / step; k++) cands.push({ v: norm360(k * step), pri: 0 });
  for (const an of anchors) cands.push({ v: norm360(an), pri: 1 });
  let best = cands[0], bestD = 1e9;
  for (const c of cands) {
    const d = angleDiff(a, c.v) - c.pri * CONFIG.ANGLE_TOL * 0.5;
    if (d < bestD - 1e-9) { bestD = d; best = c; }
  }
  return norm360(best.v);
}

/** 長さを段階（0〜4）に丸める */
export function snapLengthStep(len) {
  const st = CONFIG.LENGTH_STEPS;
  let best = 0, bd = Infinity;
  for (let i = 0; i < st.length; i++) {
    const d = Math.abs(len - st[i]);
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}

export function lengthOfStep(step) {
  const st = CONFIG.LENGTH_STEPS;
  return st[Math.max(0, Math.min(st.length - 1, step))];
}
