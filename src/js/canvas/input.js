import { CONFIG } from '../config.js';
import { angleFromDelta, snapAngle, dist, snapLengthStep, lengthOfStep } from './geometry.js';
import { nearestSnap } from './snap.js';

/**
 * 作図の入力。手順：名称を選ぶ → 相手を選ぶ → 作用点をタップ → 矢先へドラッグ。
 */
export class DrawInput {
  constructor(renderer, wrap, handlers = {}) {
    this.r = renderer;
    this.wrap = wrap;
    this.h = handlers;      // {getSelection, onCommit, onMessage, getAnchors}
    this.drag = null;
    this.enabled = false;
    this._bind();
  }

  _bind() {
    const svg = this.r.svg;
    this.onDown = e => this._down(e);
    this.onMove = e => this._move(e);
    this.onUp = e => this._up(e);
    svg.addEventListener('pointerdown', this.onDown);
    window.addEventListener('pointermove', this.onMove);
    window.addEventListener('pointerup', this.onUp);
    window.addEventListener('pointercancel', this.onUp);
  }

  destroy() {
    window.removeEventListener('pointermove', this.onMove);
    window.removeEventListener('pointerup', this.onUp);
    window.removeEventListener('pointercancel', this.onUp);
    this._hideMag();
  }

  enable(v) { this.enabled = v; }

  _down(e) {
    if (!this.enabled) return;
    const sel = this.h.getSelection?.() || {};
    if (this.h.requireSelection?.() !== false) {
      if (!sel.type) { this.h.onMessage?.('まず「力の名称」を選びましょう。'); return; }
      if (!sel.from) { this.h.onMessage?.('「何から受ける力か」を選びましょう。'); return; }
    }
    const p = this.r.toUser(e.clientX, e.clientY);
    const snap = nearestSnap(this.h.getSnaps?.() || this.r.snaps, p);
    if (!snap) { this.h.onMessage?.('作用点（○で示される位置）をタップしてください。'); return; }
    e.preventDefault();
    this.drag = { snap, angle: null, length: 0, pointerType: e.pointerType };
    this.r.showSnapMarkers(true, snap.id, this.h.getBody?.());
    if (e.pointerType === 'touch') this._showMag(e, snap);
    this.h.onMessage?.('矢先の位置までドラッグしてください。');
  }

  _move(e) {
    if (!this.drag) return;
    e.preventDefault();
    const p = this.r.toUser(e.clientX, e.clientY);
    const c = this.r.dotCenter(this.drag.snap);
    const len = dist(c, p);
    const raw = angleFromDelta(p.x - c.x, p.y - c.y);
    const anchors = (this.h.getAnchors?.() || []).concat(this.drag.snap.anchors || []);
    const ang = snapAngle(raw, anchors);
    this.drag.angle = ang;
    this.drag.raw = len;
    this.drag.step = snapLengthStep(len);
    this.drag.length = lengthOfStep(this.drag.step);
    const sel = this.h.getSelection() || {};
    this.r.drawGhost({
      type: sel.type, from: sel.from, snap: this.drag.snap.id, angle: ang,
      length: len < CONFIG.MIN_LEN ? Math.max(len, 12) : this.drag.length,
      body: this.h.getBody?.() || 'a'
    });
    if (this.h.showLengthGuide?.()) this.r.drawLengthTicks(this.drag.snap.id, ang, this.drag.step);
    if (this.drag.pointerType === 'touch') this._moveMag(e);
  }

  _up(e) {
    if (!this.drag) return;
    const d = this.drag;
    this.drag = null;
    this.r.clearGhost();
    this.r.showSnapMarkers(true, null, this.h.getBody?.());
    this._hideMag();
    if (d.angle === null || (d.raw ?? 0) < CONFIG.MIN_LEN) {
      this.h.onMessage?.('矢印が短すぎます。作用点から矢先へ向けてドラッグしてください。');
      return;
    }
    const sel = this.h.getSelection() || {};
    this.h.onCommit?.({
      type: sel.type || null, from: sel.from || null, snap: d.snap.id,
      angle: d.angle, step: d.step, length: d.length
    });
    this.h.onMessage?.('');
  }

  /* ---- スマホ用ルーペ ---- */
  _showMag(e, snap) {
    this._hideMag();
    const box = document.createElement('div');
    box.className = 'magnifier';
    const clone = this.r.svg.cloneNode(true);
    clone.removeAttribute('style');
    clone.setAttribute('width', '300'); clone.setAttribute('height', '200');
    clone.setAttribute('viewBox', `${snap.x - 60} ${snap.y - 40} 120 80`);
    clone.style.width = '300px'; clone.style.height = '200px';
    clone.style.left = '-98px'; clone.style.top = '-48px';
    box.appendChild(clone);
    this.wrap.appendChild(box);
    this.mag = box; this.magSvg = clone;
    this._moveMag(e);
  }

  _moveMag(e) {
    if (!this.mag) return;
    const r = this.wrap.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    this.mag.style.left = `${Math.max(4, Math.min(r.width - 108, x - 52))}px`;
    this.mag.style.top = `${Math.max(4, y - 128)}px`;
    const p = this.r.toUser(e.clientX, e.clientY);
    this.magSvg.setAttribute('viewBox', `${p.x - 60} ${p.y - 40} 120 80`);
  }

  _hideMag() { if (this.mag) { this.mag.remove(); this.mag = null; } }
}
