export function h(tag, props = {}, ...kids) {
  const e = document.createElement(tag);
  for (const k in props) {
    const v = props[k];
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k === 'text') e.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'dataset') Object.assign(e.dataset, v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    e.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return e;
}
export const clear = n => { n.textContent = ''; return n; };

const CARD = { 0: '右', 90: '上', 180: '左', 270: '下' };
const QUAD = [[0, 90, '右上'], [90, 180, '左上'], [180, 270, '左下'], [270, 360, '右下']];
/** 角度の読み方（例：右／右上（60°）） */
export function dirLabel(a) {
  const v = ((Math.round(a) % 360) + 360) % 360;
  if (CARD[v]) return CARD[v];
  const q = QUAD.find(([lo, hi]) => v > lo && v < hi);
  return `${q ? q[2] : ''}（${v}°）`;
}
