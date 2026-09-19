const cache = new Map();
async function getJSON(url) {
  if (cache.has(url)) return cache.get(url);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} を読み込めません (${res.status})`);
  const j = await res.json();
  cache.set(url, j);
  return j;
}

export const loadIndex = () => getJSON('data/index.json');
export const loadCatalog = () => getJSON('data/forces.json');
export const loadFeedback = () => getJSON('data/feedback.json');
export const loadProblem = path => getJSON(path);
