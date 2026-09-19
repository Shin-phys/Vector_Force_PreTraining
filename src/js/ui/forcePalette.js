import { h } from './dom.js';

/** 力の名称と「何から受ける力か」の選択UI */
export class ForcePalette {
  constructor(host, catalog, onChange) {
    this.host = host; this.catalog = catalog; this.onChange = onChange;
    this.type = null; this.from = null;
  }

  render(part) {
    this.part = part;
    this.type = null; this.from = null;
    this.host.textContent = '';
    const fs = part.availableForces || [];
    const ss = part.availableSources || [];

    this.host.append(
      h('div', { class: 'pal-label' }, '① 力の名称'),
      this.typeBox = h('div', { class: 'chips' },
        fs.map(t => {
          const meta = this.catalog.forces[t] || { label: t };
          return h('button', {
            class: 'chip' + (meta.dummy ? ' dummy' : ''), 'aria-pressed': 'false',
            dataset: { type: t }, onclick: () => this.pick('type', t)
          }, meta.label);
        })
      ),
      h('div', { class: 'pal-label' }, '② 何から受ける力か'),
      this.fromBox = h('div', { class: 'chips' },
        ss.map(s => {
          const meta = this.catalog.sources[s] || { label: s };
          return h('button', {
            class: 'chip', 'aria-pressed': 'false',
            dataset: { from: s }, onclick: () => this.pick('from', s)
          }, meta.label);
        })
      ),
      h('div', { class: 'pal-label' }, '③ 作用点をタップ →　矢先までドラッグ')
    );
  }

  pick(kind, v) {
    this[kind] = this[kind] === v ? null : v;
    const box = kind === 'type' ? this.typeBox : this.fromBox;
    box.querySelectorAll('.chip').forEach(c => {
      c.setAttribute('aria-pressed', String(c.dataset[kind] === this[kind]));
    });
    this.onChange?.(this.get());
  }

  get() { return { type: this.type, from: this.from }; }
  clearSelection() { this.pick('type', null); this.pick('from', null); }
}
