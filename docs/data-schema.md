# 問題データ（JSON）のスキーマ

## 1. 角度の規約

- **論理角度は数学座標**：右=0°、反時計回りが正、上=90°、下=270°
- SVGはy軸が下向きのため、描画時に変換する。変換は `src/js/canvas/geometry.js` に集約し、他のファイルでは扱わない
- 入力角度は15°刻みにスナップされる。問題固有のアンカー（斜面に平行・垂直など）は `angleAnchors` で追加できる
- したがって `answers[].angle` は**15の倍数**か `angleAnchors` に含まれる値でなければならない（`validate.mjs` が検査）

## 2. 問題ファイル

`data/problems/<単元>/<問題ID>.json`

```jsonc
{
  "id": "A17",
  "title": "接触した2物体を手で押す",
  "unit": "mech-basic",
  "course": "物理基礎",
  "figure": "assets/figures/mech-basic/A17.svg",
  "frame": "GROUND",              // GROUND（慣性系）／ACCELERATED（加速系）
  "observer": "電車内の観測者",    // ACCELERATED のとき画面上部に常時表示
  "sceneSet": null,               // 連続提示するセットのキー（同じ値の問題は順に出題）
  "sceneSetSummary": "…",         // セット最後の問題の結果画面に出す比較の要点（任意）
  "prompt": "なめらかな床の上で…",
  "tags": ["作用反作用", "垂直抗力", "2物体"],
  "angleAnchors": [60, 150, 240, 330],   // 任意。角度スナップに加えるアンカー

  "parts": [
    {
      "id": "a",
      "targetBody": "body-a",
      "prompt": "物体Aにはたらく力をすべて描きなさい。",
      "showPreviousPart": true,          // 既定 true（テストモードでは常に非表示）
      "availableForces": ["GRAVITY", "NORMAL_FORCE", "PUSH", "DUMMY_MOTION_FORCE"],
      "availableSources": ["EARTH", "FLOOR", "HAND", "BODY_B"],
      "answers": [
        { "key": "aG", "type": "GRAVITY", "from": "EARTH", "snap": "a-center", "angle": 270 }
      ],
      "misconception": { }                // パート固有の対応表（問題全体の設定を上書き）
    }
  ],

  "relations": [
    { "a": "aR", "op": "=", "b": "bP", "note": "作用・反作用",
      "tolerance": 0.15, "mc": "MC_ACTION_REACTION_EQUAL" }
  ],

  "misconception": {
    "DUMMY_TRANSMITTED_PUSH": "MC_HAND_REACHES_B",
    "EXTRA_SOURCE:HAND@b": "MC_HAND_REACHES_B",
    "WRONG_POINT:aN": "MC_NORMAL_AT_CENTER",
    "EXTRA_TYPE:FRICTION_STATIC": "MC_FRICTION_WHEN_SMOOTH",
    "EXTRA_ANY": "MC_EXTRA_ANY"
  },

  "explanation": "手が直接触れているのはAだけです。…"
}
```

### フィールド

| フィールド | 内容 |
|---|---|
| `parts[].availableForces` | 名称パレットに出す力。**ダミー（`DUMMY_*`）を、その問題で検出したい誤概念のものだけ混ぜる** |
| `parts[].availableSources` | 「何から受ける力か」の選択肢。誤答用の相手も混ぜる |
| `answers[].key` | 問題内で一意。`relations` と `misconception` から参照する |
| `answers[].snap` | 図の `data-snap` のid |
| `relations[].op` | `=` `<` `>`。矢印の長さの**段階**（0〜4）で判定する。`=` は同じ段階、`<` `>` は1段階以上の差。`tolerance` は段階を持たない古い入力への予備 |
| `relations[].mc` | 関係が成り立たないときに返す誤概念コード |

### `misconception` のキー

| キー | 発火条件 |
|---|---|
| `<力の種類>` | その力を描いたとき（ダミーの検出に使う） |
| `WRONG_POINT:<key>` / `WRONG_ANGLE:<key>` / `WRONG_SOURCE:<key>` | その正解に対応づいた入力が、作用点／向き／相手で誤っていたとき |
| `MISSING:<key>` | その力が描かれていないとき |
| `EXTRA_TYPE:<力の種類>` | その力が余分な力として描かれたとき |
| `EXTRA_SOURCE:<相手>` / `EXTRA_SOURCE:<相手>@<パートid>` | その相手からの余分な力が描かれたとき |
| `EXTRA_ANY` | 余分な力が1つ以上あるとき |

問題ごとの対応表に無くても、次の既定ルールが働きます。

- `DUMMY_*` → 対応する誤概念コード（`src/js/logic/feedback.js` の `DUMMY_DEFAULT`）
- 垂直抗力・張力・弾性力を重心（`CENTER`）から描いた → 作用点の誤り
- 摩擦力・張力・弾性力の向き違い → 向きの誤り
- 重力・垂直抗力の描き忘れ → 不足の指摘

## 3. 力と相手の定義（`data/forces.json`）

```jsonc
{
  "forces": {
    "NORMAL_FORCE": { "label": "垂直抗力", "symbol": "N", "pointType": "CONTACT" },
    "INERTIAL":     { "label": "慣性力", "symbol": "F", "frameOnly": "ACCELERATED" },
    "DUMMY_MOTION_FORCE": { "label": "運動の向きの力（勢い・投げた力）", "dummy": true }
  },
  "sources": {
    "EARTH": { "label": "地球", "short": "地球" },
    "BODY_B": { "label": "物体B", "short": "B" }
  }
}
```

`label` は名称パレットと戸籍表記に、`short` は記号表記（`N_A←B`）に使われます。

## 4. 誤概念の解説文（`data/feedback.json`）

`"<誤概念コード>": "<解説文>"` のフラットなオブジェクトです。
新しいコードを足したら、問題JSONの `misconception` や `relations[].mc` から参照します。

## 5. 全問題一覧（`data/index.json`）

出題の起点。`tools/make-index.mjs` を使わず手で編集しても構いませんが、
問題を追加したら `partCount` と `parts[].answerCount` を合わせてください（`validate.mjs` が検査します）。

```jsonc
{
  "version": 1,
  "units": [{ "key": "mech-basic", "code": "A", "label": "力学基礎編", "course": "物理基礎" }],
  "problems": [
    { "id": "A17", "title": "…", "unit": "mech-basic", "course": "物理基礎",
      "tags": ["作用反作用"], "path": "data/problems/mech-basic/A17.json",
      "partCount": 2, "sceneSet": null,
      "parts": [{ "id": "a", "answerCount": 4 }, { "id": "b", "answerCount": 3 }] }
  ]
}
```

## 6. 矢印の長さと大きさの判定

矢印の長さは `CONFIG.LENGTH_STEPS`（既定 `[40, 65, 90, 115, 140]`）の5段階に丸められ、
入力データは `{ step, length }` の両方を持ちます。判定に使うのは `step` です。

大きさの判定は設定 `judgeMagnitude`（既定 `false`）で切り替わります。OFFのときは
`relations` を評価せず、長さの目盛りと −／＋ ボタンも表示しません。

`relations` を書くときの原則：**与えられた情報だけで大小が確定するものだけ**を定義します。
質量・摩擦係数が無いと決まらない大小（「手の押す力」と「AがBに及ぼす力」の比較など）は定義しません。

## 7. 進捗の保存（localStorage：キー `fdt-v1`）

```json
{
  "version": 1,
  "progress": { "A05": { "cleared": true, "attempts": 2, "lastAt": "2026-09-19T10:00:00+09:00" } },
  "misconceptionCount": { "MC_MOTION_FORCE": 5 },
  "testResults": [{ "at": "…", "range": "mech-basic", "score": 17, "full": 20, "code": "K7F2" }],
  "settings": { "labelMode": "name", "theme": "auto", "contrast": "normal", "judgeMagnitude": false }
}
```
