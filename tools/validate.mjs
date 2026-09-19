#!/usr/bin/env node
// JSONと対応SVGの整合性チェック:  node tools/validate.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = p => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));

let errors = 0, warns = 0;
const err = m => { console.error('  ✗ ' + m); errors++; };
const warn = m => { console.warn('  ! ' + m); warns++; };

const index = read('data/index.json');
const catalog = read('data/forces.json');
const feedback = read('data/feedback.json');
const FORCES = catalog.forces || catalog;
const SOURCES = catalog.sources || {};

console.log(`index.json: ${index.problems.length} 題 / 単元 ${index.units.length}`);

const seen = new Set();
for (const entry of index.problems) {
  console.log(`- ${entry.id} ${entry.title}`);
  if (seen.has(entry.id)) err(`id が重複しています: ${entry.id}`);
  seen.add(entry.id);
  if (!fs.existsSync(path.join(ROOT, entry.path))) { err(`問題ファイルがありません: ${entry.path}`); continue; }
  const p = read(entry.path);
  if (p.id !== entry.id) err(`index と JSON の id が一致しません (${entry.id} / ${p.id})`);
  if (!fs.existsSync(path.join(ROOT, p.figure))) { err(`図がありません: ${p.figure}`); continue; }

  const svg = fs.readFileSync(path.join(ROOT, p.figure), 'utf8');
  const snaps = new Map();
  for (const m of svg.matchAll(/data-snap="([^"]+)"[^>]*?/g)) snaps.set(m[1], true);
  for (const m of svg.matchAll(/data-snap="([^"]+)"([^>]*)>/g)) snaps.set(m[1], m[2]);
  if (!/viewBox="0 0 600 400"/.test(svg)) warn(`viewBox が 600x400 ではありません: ${p.figure}`);
  if (!/id="body-a"/.test(svg)) err(`id="body-a" がありません: ${p.figure}`);
  if (/<line[^>]+data-force/.test(svg)) err(`図の中に力の矢印が描かれています: ${p.figure}`);

  const keys = new Set();
  if (p.parts.length !== entry.partCount) err(`partCount が一致しません`);
  for (const part of p.parts) {
    const body = (part.targetBody || 'body-a').replace('body-', '');
    if (!svg.includes(`id="body-${body}"`)) err(`targetBody が図にありません: body-${body}`);
    for (const t of part.availableForces || []) if (!FORCES[t]) err(`未定義の力: ${t}`);
    for (const s of part.availableSources || []) if (!SOURCES[s]) err(`未定義の相手: ${s}`);
    for (const a of part.answers || []) {
      if (keys.has(a.key)) err(`answers の key が重複: ${a.key}`);
      keys.add(a.key);
      if (!FORCES[a.type]) err(`未定義の力: ${a.type}`);
      if (FORCES[a.type]?.dummy) err(`ダミーの力が正解になっています: ${a.type}`);
      if (!SOURCES[a.from]) err(`未定義の相手: ${a.from}`);
      if (!snaps.has(a.snap)) err(`data-snap がありません: ${a.snap} (${p.figure})`);
      else {
        const attrs = snaps.get(a.snap);
        if (typeof attrs === 'string' && !/data-snap-type/.test(attrs)) warn(`data-snap-type がありません: ${a.snap}`);
        if (typeof attrs === 'string' && /data-snap-type="(CONTACT|ATTACH)"/.test(attrs) && !/data-inward/.test(attrs))
          warn(`data-inward がありません: ${a.snap}`);
      }
      if (!(part.availableForces || []).includes(a.type)) err(`正解の力が名称パレットにありません: ${a.type}`);
      if (!(part.availableSources || []).includes(a.from)) err(`正解の相手が選択肢にありません: ${a.from}`);
      const anchors = p.angleAnchors || [];
      if (a.angle % 15 !== 0 && !anchors.includes(a.angle))
        err(`角度 ${a.angle}° は15°刻みでもアンカーでもありません (${a.key})`);
    }
    if (!(part.availableForces || []).some(t => FORCES[t]?.dummy))
      warn(`ダミーの力が1つも入っていません: ${p.id}:${part.id}`);
    // 作用点候補が正解の点だけになっていないか
    const answerSnaps = new Set((part.answers || []).map(a => a.snap));
    const bodySnaps = [...snaps.keys()].filter(k => k.split('-')[0] === body);
    if (bodySnaps.length <= answerSnaps.size)
      warn(`誤答用の作用点候補が足りません: ${p.id}:${part.id}（候補 ${bodySnaps.length} / 正解 ${answerSnaps.size}）`);
  }
  for (const r of p.relations || []) {
    if (!keys.has(r.a)) err(`relations の key がありません: ${r.a}`);
    if (!keys.has(r.b)) err(`relations の key がありません: ${r.b}`);
    if (!['=', '<', '>'].includes(r.op)) err(`relations の op が不正: ${r.op}`);
    if (r.mc && !feedback[r.mc]) err(`feedback に無い誤概念コード: ${r.mc}`);
  }
  const mc = { ...(p.misconception || {}) };
  for (const part of p.parts) Object.assign(mc, part.misconception || {});
  for (const [k, code] of Object.entries(mc)) {
    if (!feedback[code]) err(`feedback に無い誤概念コード: ${code}（${k}）`);
    const m = k.match(/^(WRONG_POINT|WRONG_ANGLE|WRONG_SOURCE|MISSING):(.+)$/);
    if (m && !keys.has(m[2])) err(`misconception のキーが answers にありません: ${k}`);
    const m2 = k.match(/^EXTRA_TYPE:(.+)$/);
    if (m2 && !FORCES[m2[1]]) err(`misconception の力が未定義: ${k}`);
  }
}

console.log(`\n結果: エラー ${errors} 件 / 警告 ${warns} 件`);
process.exit(errors ? 1 : 0);
