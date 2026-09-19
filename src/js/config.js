export const CONFIG = {
  SNAP_RADIUS: 24,      // 作用点の吸着半径（SVGユーザー単位）
  ANGLE_STEP: 15,       // 角度スナップの刻み（度）
  ANGLE_TOL: 5,         // アンカーが近接する場合のみ使う許容誤差（度）
  DOT_R: 7,             // 作用点の丸の半径
  MIN_LEN: 28,          // これより短いドラッグは確定しない
  LENGTH_STEPS: [40, 65, 90, 115, 140],  // 矢印の長さは5段階に丸める
  DEFAULT_STEP: 2,
  OVERLAP_OFFSET: 6,    // 重なるベクトルを直交方向へずらす量
  HEAD_LEN: 14,
  HEAD_W: 11,
  EQ_TOL: 0.15,         // 段階が無い古いデータを読んだときの予備（"=" の許容比）
  CMP_MIN: 0.10,
  RANDOM_COUNT: 5,
  HINT_MAX: 3,
  STORAGE_KEY: 'fdt-v1'
};
