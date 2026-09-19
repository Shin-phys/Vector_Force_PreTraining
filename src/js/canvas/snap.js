import { dist } from './geometry.js';
import { CONFIG } from '../config.js';

/** 図のSVGから作用点候補を集める */
export function collectSnaps(svgEl) {
  const out = [];
  svgEl.querySelectorAll('[data-snap]').forEach(el => {
    const id = el.getAttribute('data-snap');
    let x, y;
    if (el.hasAttribute('cx')) { x = +el.getAttribute('cx'); y = +el.getAttribute('cy'); }
    else { const b = el.getBBox(); x = b.x + b.width / 2; y = b.y + b.height / 2; }
    out.push({
      id, x, y,
      type: el.getAttribute('data-snap-type') || 'CONTACT',
      inward: el.hasAttribute('data-inward') ? +el.getAttribute('data-inward') : null,
      body: el.getAttribute('data-body') || id.split('-')[0],
      anchors: (el.getAttribute('data-anchors') || '').split(/[,\s]+/).filter(Boolean).map(Number)
    });
  });
  return out;
}

/**
 * 最も近い作用点候補。力の種類では絞り込まない（誤りを入力できるようにするため）。
 */
export function nearestSnap(snaps, p, radius = CONFIG.SNAP_RADIUS) {
  let best = null, bestD = Infinity;
  for (const s of snaps) {
    const d = dist(s, p);
    if (d < bestD) { bestD = d; best = s; }
  }
  return bestD <= radius ? best : null;
}

export function snapById(snaps, id) { return snaps.find(s => s.id === id) || null; }
