/** テストモードの集計。力の正誤と大きさの関係は別に数える */
export function summarize(records) {
  // records: [{problemId, partId, judged, codes, relResults}]
  let forceTotal = 0, forceCorrect = 0, relTotal = 0, relCorrect = 0;
  const problemParts = {}, problemMag = {};
  const mc = {};
  for (const r of records) {
    forceTotal += r.judged.total;
    forceCorrect += r.judged.correct;
    problemParts[r.problemId] = problemParts[r.problemId] || [];
    problemParts[r.problemId].push(r.judged.allCorrect);
    for (const rr of r.relResults || []) {
      if (rr.status === 'na') continue;
      relTotal++;
      if (rr.status === 'ok') relCorrect++;
      else (problemMag[r.problemId] = problemMag[r.problemId] || []).push(rr);
    }
    for (const c of r.codes || []) mc[c] = (mc[c] || 0) + 1;
  }
  const problemIds = Object.keys(problemParts);
  const problemCorrect = problemIds.filter(id => problemParts[id].every(Boolean)).length;
  const partialOnly = problemIds.filter(id => problemParts[id].some(Boolean) && !problemParts[id].every(Boolean));
  return {
    problemTotal: problemIds.length,
    problemCorrect,
    partialProblems: partialOnly,
    forceTotal, forceCorrect,
    relTotal, relCorrect,
    magProblems: Object.keys(problemMag),
    misconceptions: Object.entries(mc).sort((a, b) => b[1] - a[1])
  };
}

export function makeCode() {
  const s = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 4; i++) out += s[Math.floor(Math.random() * s.length)];
  return out;
}
