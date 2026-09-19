/** 誤入力 → 誤概念コードの収集 */

const DUMMY_DEFAULT = {
  DUMMY_MOTION_FORCE: 'MC_MOTION_FORCE',
  DUMMY_RISING_FORCE: 'MC_RISING_FORCE',
  DUMMY_CENTRIPETAL: 'MC_CENTRIPETAL_AS_FORCE',
  DUMMY_RESTORING: 'MC_RESTORING_AS_FORCE',
  DUMMY_COMPONENT: 'MC_GRAVITY_COMPONENT_AS_FORCE',
  DUMMY_INERTIA: 'MC_INERTIA_IN_GROUND_FRAME',
  DUMMY_CENTRIFUGAL: 'MC_CENTRIFUGAL_IN_GROUND_FRAME',
  DUMMY_TRANSMITTED_PUSH: 'MC_HAND_REACHES_B',
  DUMMY_WEIGHT_TRANSMITTED: 'MC_WEIGHT_NOT_TRANSMITTED'
};

export function collectCodes(problem, part, judged, snapMap = {}, relResults = []) {
  const map = { ...(problem.misconception || {}), ...(part.misconception || {}) };
  const codes = [];
  const add = c => { if (c && !codes.includes(c)) codes.push(c); };

  // 1) 問題固有の対応表
  for (const it of judged.items) {
    if (map[it.input.type]) add(map[it.input.type]);
    if (it.verdict === 'EXTRA') {
      add(map[`EXTRA_SOURCE:${it.input.from}@${part.id}`]);
      add(map[`EXTRA_SOURCE:${it.input.from}`]);
      add(map[`EXTRA_TYPE:${it.input.type}`]);
    }
    if (it.answerKey) add(map[`${it.verdict}:${it.answerKey}`]);
  }
  for (const m of judged.missing) add(map[`MISSING:${m.key}`]);

  // 2) 既定のルール
  for (const it of judged.items) {
    const t = it.input.type;
    if (DUMMY_DEFAULT[t]) add(DUMMY_DEFAULT[t]);
    if (it.crossBody) add('MC_WRONG_BODY');
    if (it.verdict === 'WRONG_POINT') {
      const st = (snapMap[it.input.snap] || {}).type;
      if (st === 'CENTER' && t === 'NORMAL_FORCE') add('MC_NORMAL_AT_CENTER');
      if (st === 'CENTER' && t === 'TENSION') add('MC_TENSION_AT_CENTER');
      if (st === 'CENTER' && t === 'ELASTIC') add('MC_TENSION_AT_CENTER');
    }
    if (it.verdict === 'WRONG_ANGLE') {
      if (t === 'NORMAL_FORCE') add((problem.tags || []).includes('斜面') ? 'MC_NORMAL_VERTICAL_ON_SLOPE' : 'MC_FRICTION_DIRECTION');
      if (t.startsWith('FRICTION')) add('MC_FRICTION_DIRECTION');
      if (t === 'TENSION') add('MC_TENSION_NOT_ALONG_STRING');
      if (t === 'ELASTIC') add('MC_ELASTIC_DIRECTION');
    }
  }
  for (const m of judged.missing) {
    if (m.type === 'GRAVITY') add('MC_MISSING_GRAVITY');
    if (m.type === 'NORMAL_FORCE') add('MC_MISSING_NORMAL');
  }
  if (judged.extra > 0) add(map.EXTRA_ANY);
  for (const r of relResults) if (r.status === 'ng') add(r.mc || (String(r.note || '').includes('作用') ? 'MC_ACTION_REACTION_EQUAL' : null));

  // 3) 総括（他に具体的な指摘がないときだけ）
  if (!codes.length) {
    if (judged.extra > 0) add('MC_EXTRA_ANY');
    if (judged.missing.length > 0) add('MC_MISSING_ANY');
  }
  return codes;
}

/** 力は合っていて大きさだけ誤っているときのヒント */
export const MAGNITUDE_HINT =
  '力の種類・作用点・向きは合っています。矢印の長さをくらべましょう（つりあう力、作用・反作用の力は同じ長さ）。一覧の −／＋ で調整できます。';

/** 段階ヒント */
export const HINTS = [
  '①　重力は描きましたか？　地球上の物体には必ず重力がはたらきます。',
  '②　この物体に「触れているもの」は何ですか？　触れているものの数だけ、接触による力があります。',
  '③　接触しているところを図で確かめましょう（作用点の候補を強調表示しました）。'
];
