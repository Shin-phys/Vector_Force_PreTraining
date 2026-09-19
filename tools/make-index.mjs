#!/usr/bin/env node
// data/problems/ から data/index.json を作り直す:  node tools/make-index.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const UNITS = [
  ['mech-basic', 'A', '力学基礎編', '物理基礎'],
  ['mech-standard', 'B', '力学標準編', '物理基礎〜物理'],
  ['rigid', 'C', '剛体編', '物理'],
  ['circular', 'D', '円運動・単振動・万有引力編', '物理'],
  ['noninertial', 'E', '非慣性系編', '物理'],
  ['fluid', 'F', '流体・気体の圧力編', '物理基礎・物理'],
  ['em', 'G', '電磁気編', '物理'],
  ['advanced', 'H', '難関大・発展編', '物理']
];

const problems = [];
for (const [key, , , course] of UNITS) {
  const dir = path.join(ROOT, 'data/problems', key);
  if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort()) {
    const p = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    problems.push({
      id: p.id, title: p.title, unit: p.unit, course: p.course || course,
      tags: p.tags || [], path: `data/problems/${key}/${f}`,
      partCount: p.parts.length, sceneSet: p.sceneSet ?? null,
      parts: p.parts.map(pt => ({ id: pt.id, answerCount: (pt.answers || []).length }))
    });
  }
}
const out = {
  version: 1,
  units: UNITS.filter(([k]) => problems.some(p => p.unit === k))
    .map(([key, code, label, course]) => ({ key, code, label, course })),
  problems
};
fs.writeFileSync(path.join(ROOT, 'data/index.json'), JSON.stringify(out, null, 2) + '\n');
console.log(`data/index.json を書き出しました（${problems.length} 題）`);
