import { CONFIG } from '../config.js';

const EMPTY = { version: 1, progress: {}, misconceptionCount: {}, testResults: [], settings: {} };

export function load() {
  try {
    const raw = localStorage.getItem(CONFIG.STORAGE_KEY);
    if (!raw) return structuredClone(EMPTY);
    return { ...structuredClone(EMPTY), ...JSON.parse(raw) };
  } catch (e) { return structuredClone(EMPTY); }
}

export function save(state) {
  try { localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* 保存できなくても続行 */ }
}

export function recordAttempt(problemId, cleared) {
  const s = load();
  const p = s.progress[problemId] || { cleared: false, attempts: 0 };
  p.attempts += 1;
  p.cleared = p.cleared || cleared;
  p.lastAt = new Date().toISOString();
  s.progress[problemId] = p;
  save(s);
  return s;
}

export function recordCodes(codes = []) {
  const s = load();
  for (const c of codes) s.misconceptionCount[c] = (s.misconceptionCount[c] || 0) + 1;
  save(s);
}

export function recordTest(result) {
  const s = load();
  s.testResults.unshift(result);
  s.testResults = s.testResults.slice(0, 30);
  save(s);
}

export function setSetting(k, v) { const s = load(); s.settings[k] = v; save(s); return s; }
export function getSettings() { return load().settings || {}; }
export function reset() { try { localStorage.removeItem(CONFIG.STORAGE_KEY); } catch (e) {} }
