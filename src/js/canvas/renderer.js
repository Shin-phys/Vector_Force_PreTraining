import { CONFIG } from '../config.js';
import { pointAt, unitVec, perpAngle, norm360, lengthOfStep } from './geometry.js';
import { collectSnaps, snapById } from './snap.js';

const SVGNS = 'http://www.w3.org/2000/svg';
const el = (n, attrs = {}) => {
  const e = document.createElementNS(SVGNS, n);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  return e;
};

/** ラベル幅のおおよその見積もり（全角14px・半角8px） */
function textWidth(t) {
  let w = 0;
  for (const ch of t) w += ch.codePointAt(0) > 0x2e80 ? 14 : 8;
  return w;
}

/** ①②③… 矢印だけを描くモードで、図と一覧を対応づける番号 */
export function circledNumber(n) {
  return n >= 1 && n <= 20 ? String.fromCodePoint(0x2460 + n - 1) : `(${n})`;
}

const PAD = 3;
function labelBox(pos, tw, th) {
  const x = pos.anchor === 'start' ? pos.x : pos.anchor === 'end' ? pos.x - tw : pos.x - tw / 2;
  return { x: x - PAD, y: pos.y - th + 3 - PAD, w: tw + PAD * 2, h: th + PAD * 2 };
}
function overlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
function clampLabel(pos, tw, th) {
  const half = pos.anchor === 'start' ? 0 : pos.anchor === 'end' ? tw : tw / 2;
  const lo = 6 + half, hi = 594 - (tw - half);
  return {
    x: Math.max(Math.min(pos.x, hi), lo),
    y: Math.max(th, Math.min(pos.y, 394)),
    anchor: pos.anchor
  };
}

let defsInjected = false;
export async function injectDefs(url = 'assets/parts/defs.svg') {
  if (defsInjected) return;
  const txt = await (await fetch(url)).text();
  const holder = document.createElement('div');
  holder.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
  holder.innerHTML = txt;
  document.body.appendChild(holder);
  defsInjected = true;
}

/** 力の戸籍表記 */
export function forceLabel(f, catalog, mode = 'name') {
  const meta = catalog.forces[f.type] || { label: f.type };
  const src = catalog.sources[f.from] || { label: f.from || '?', short: f.from || '?' };
  if (meta.dummy) return meta.label;
  if (mode === 'symbol') {
    const sym = meta.symbol || 'F';
    const b = (f.body || 'a').toUpperCase();
    return `${sym}_${b}←${src.short || src.label}`;
  }
  return `${src.label}から受ける${meta.label}`;
}

export class FigureRenderer {
  constructor(host) {
    this.host = host;
    this.svg = null;
    this.snaps = [];
    this.catalog = { forces: {}, sources: {} };
    this.labelMode = 'name';
  }

  async mount(figureUrl) {
    await injectDefs();
    const txt = await (await fetch(figureUrl)).text();
    this.host.innerHTML = txt;
    this.svg = this.host.querySelector('svg');
    this.svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    this.snaps = collectSnaps(this.svg);
    this.markerLayer = el('g', { id: 'snap-layer' });
    this.forceLayer = el('g', { id: 'force-layer' });
    this.ghostLayer = el('g', { id: 'ghost-layer' });
    this.svg.append(this.markerLayer, this.forceLayer, this.ghostLayer);
    return this.svg;
  }

  /** 画面座標 → SVGユーザー座標 */
  toUser(clientX, clientY) {
    const pt = this.svg.createSVGPoint();
    pt.x = clientX; pt.y = clientY;
    const m = this.svg.getScreenCTM().inverse();
    const p = pt.matrixTransform(m);
    return { x: p.x, y: p.y };
  }

  snapPoint(id) { return snapById(this.snaps, id); }

  /** 作用点候補の可視化 */
  showSnapMarkers(show, nearId = null, bodyFilter = null) {
    this.markerLayer.textContent = '';
    if (!show) return;
    for (const s of this.snaps) {
      if (bodyFilter && s.body !== bodyFilter) continue;
      this.markerLayer.appendChild(el('circle', {
        cx: s.x, cy: s.y, r: s.id === nearId ? 9 : 6,
        class: 'snap-marker' + (s.id === nearId ? ' near' : '')
      }));
    }
  }

  /** 作用点の丸の中心（輪郭の内側に接するようにずらす） */
  dotCenter(snap) {
    if (!snap) return { x: 0, y: 0 };
    if (snap.type === 'CENTER' || snap.inward === null) return { x: snap.x, y: snap.y };
    const v = unitVec(snap.inward);
    return { x: snap.x + v.x * CONFIG.DOT_R, y: snap.y + v.y * CONFIG.DOT_R };
  }

  /**
   * 重なるベクトルのオフセット。
   * 作用点が違っても「同じ直線上」にある力（水平面上の重力と垂直抗力など）を同じ組とみなし、
   * 直交方向へずらす。論理データは変更しない。
   */
  _offsets(forces) {
    const info = forces.map(f => {
      const snap = this.snapPoint(f.snap);
      if (!snap) return null;
      const c = this.dotCenter(snap);
      const a180 = ((Math.round(f.angle) % 180) + 180) % 180;
      const n = unitVec(perpAngle(a180));
      return { key: `${a180}|${Math.round((c.x * n.x + c.y * n.y) / 5)}`, n };
    });
    const groups = new Map();
    info.forEach((v, i) => {
      if (!v) return;
      if (!groups.has(v.key)) groups.set(v.key, []);
      groups.get(v.key).push(i);
    });
    const off = forces.map(() => ({ x: 0, y: 0 }));
    for (const idxs of groups.values()) {
      if (idxs.length < 2) continue;
      idxs.forEach((idx, k) => {
        const d = (k - (idxs.length - 1) / 2) * CONFIG.OVERLAP_OFFSET;
        off[idx] = { x: info[idx].n.x * d, y: info[idx].n.y * d };
      });
    }
    return off;
  }

  drawForces(forces, opts = {}) {
    this.forceLayer.textContent = '';
    const offs = this._offsets(forces);
    const drawn = [];
    forces.forEach((f, i) => {
      const d = this._forceNode(f, offs[i], opts);
      if (d) { this.forceLayer.appendChild(d.node); drawn.push(d); }
    });
    // ラベルは矢印をすべて描いたあとで置く（矢印や他のラベルと重ならない位置を選ぶ）
    const taken = this._obstacles(drawn);
    drawn.forEach((d, i) => {
      const t = this._placeLabel(d.force, d.geom, opts, taken, i);
      if (t) d.node.appendChild(t);
    });
  }

  /** ラベルを避けさせたいもの：矢印の軸と、図にもともとある文字 */
  _obstacles(drawn) {
    const boxes = [];
    drawn.forEach((d, owner) => {
      const { c, tip } = d.geom;
      const n = Math.max(2, Math.ceil(Math.hypot(tip.x - c.x, tip.y - c.y) / 14));
      for (let k = 0; k <= n; k++) {
        const x = c.x + (tip.x - c.x) * k / n, y = c.y + (tip.y - c.y) * k / n;
        boxes.push({ x: x - 7, y: y - 7, w: 14, h: 14, owner });
      }
    });
    try {
      this.svg.querySelectorAll('text.fig-note, text.fig-label, [data-role="body"] [data-role="outline"]')
        .forEach(n => {
          const b = n.getBBox();
          boxes.push({ x: b.x, y: b.y, w: b.width, h: b.height, owner: -1 });
        });
    } catch (e) { /* 取得できなくても続行 */ }
    return boxes;
  }

  _placeLabel(f, geom, opts, taken, owner = -1) {
    const mode = f.labelMode || opts.labelMode || this.labelMode;
    if (opts.labels === false || mode === 'none') return null;
    const isNum = mode === 'number';
    const txt = isNum ? circledNumber(f.num || 1) : forceLabel(f, this.catalog, mode);
    const tw = isNum ? 22 : textWidth(txt);
    const th = isNum ? 22 : 17;
    const { tip, u, pv, c } = geom;
    const mid = { x: (c.x + tip.x) / 2, y: (c.y + tip.y) / 2 };
    const along = u.x < -0.25 ? 'end' : (u.x > 0.25 ? 'start' : 'middle');
    const side = pv.x > 0.25 ? 'start' : (pv.x < -0.25 ? 'end' : 'middle');
    const gap = isNum ? 14 : 17;
    const other = side === 'start' ? 'end' : (side === 'end' ? 'start' : 'middle');
    const at = (d, q, anchor) => ({ x: tip.x + u.x * d + pv.x * q, y: tip.y + u.y * d + pv.y * q, anchor });
    const cands = [
      at(gap, 0, along),
      at(gap, 20, along), at(gap, -20, along),
      at(gap + 26, 0, along),
      at(gap + 26, 26, along), at(gap + 26, -26, along),
      at(gap + 54, 0, along),
      { x: mid.x + pv.x * 24, y: mid.y + pv.y * 24, anchor: side },
      { x: mid.x - pv.x * 24, y: mid.y - pv.y * 24, anchor: other }
    ];

    let best = null, bestHit = Infinity;
    for (const cd of cands) {
      const pos = clampLabel(cd, tw, th);
      const box = labelBox(pos, tw, th);
      // 自分の矢印の軸は避けなくてよい（ラベルは矢先の先に置くため）
      const hit = taken.reduce((n, b) => n + (b.owner !== owner && overlaps(box, b) ? 1 : 0), 0);
      if (hit === 0) { best = { pos, box }; break; }
      if (hit < bestHit) { bestHit = hit; best = { pos, box }; }
    }
    taken.push({ ...best.box, owner: -1 });
    const t = el('text', {
      class: isNum ? 'lbl num' : 'lbl',
      x: best.pos.x, y: best.pos.y, 'text-anchor': isNum ? 'middle' : best.pos.anchor
    });
    t.textContent = txt;
    return t;
  }

  drawGhost(f) {
    this.ghostLayer.textContent = '';
    if (!f) return;
    const d = this._forceNode({ ...f, state: 'ghost' }, { x: 0, y: 0 }, { labels: false });
    if (d) this.ghostLayer.appendChild(d.node);
  }

  clearGhost() { this.ghostLayer.textContent = ''; }

  /** ドラッグ中に長さの段階を示す目盛り（大きさを判定するときだけ出す） */
  drawLengthTicks(snapId, angle, activeStep) {
    const snap = this.snapPoint(snapId);
    if (!snap) return;
    const c = this.dotCenter(snap);
    const pv = unitVec(perpAngle(angle));
    CONFIG.LENGTH_STEPS.forEach((L, i) => {
      const q = pointAt(c, angle, L);
      const h = i === activeStep ? 9 : 5;
      this.ghostLayer.appendChild(el('line', {
        class: 'len-tick' + (i === activeStep ? ' on' : ''),
        x1: q.x - pv.x * h, y1: q.y - pv.y * h,
        x2: q.x + pv.x * h, y2: q.y + pv.y * h
      }));
    });
  }

  _forceNode(f, offset = { x: 0, y: 0 }, opts = {}) {
    const snap = this.snapPoint(f.snap);
    if (!snap) return null;
    const meta = this.catalog.forces[f.type] || {};
    const c0 = this.dotCenter(snap);
    const pv = unitVec(perpAngle(f.angle));
    const c = { x: c0.x + (offset.x || 0), y: c0.y + (offset.y || 0) };
    const len = f.length || lengthOfStep(f.step ?? CONFIG.DEFAULT_STEP);
    const tip = pointAt(c, f.angle, len);
    const back = pointAt(tip, f.angle + 180, CONFIG.HEAD_LEN);
    const w = CONFIG.HEAD_W / 2;
    const hp = [
      `${tip.x},${tip.y}`,
      `${back.x + pv.x * w},${back.y + pv.y * w}`,
      `${back.x - pv.x * w},${back.y - pv.y * w}`
    ].join(' ');

    const cls = ['force', `body-${f.body || 'a'}`];
    if (meta.dummy) cls.push('is-dummy');
    if (f.state) cls.push(`state-${f.state}`);
    if (f.selected) cls.push('sel');
    if (f.verdict) cls.push(`vd-${f.verdict}`);
    const g = el('g', { class: cls.join(' '), 'data-uid': f.uid || '' });

    g.appendChild(el('line', { class: 'shaft', x1: c.x, y1: c.y, x2: back.x, y2: back.y }));
    g.appendChild(el('polygon', { class: 'head', points: hp }));
    g.appendChild(el('circle', { class: 'dot', cx: c.x, cy: c.y, r: CONFIG.DOT_R }));
    return { node: g, force: f, geom: { c, tip, pv, u: unitVec(f.angle) } };
  }
}
