# Orbit Post（試作）

Game Boy 風の 160×144・4階調画面で、コックピット視点の宇宙を飛ぶ配達ゲームの試作です。
3D はソフトウェアラスタライザで描いています。面ごとのフラットシェーディングの明るさを
4×4 のベイヤーディザで 4 階調に落としています。BGM は Web Audio で鳴らす 4 チャンネルの
チップチューンです。外部ライブラリは使っていません。

**ブラウザで遊ぶ：https://sinme52.github.io/orbit-post/**

`index.html` をブラウザで開くだけでも遊べます。インストールやサーバーは不要です。

## ファイル
| ファイル | 内容 |
|---|---|
| `index.html` | ゲーム本体（描画・BGM・ステージ・説明ページをすべて含む 1 ファイル） |
| `build.mjs` | 公開用の完全な HTML と zip を `dist/` に作るスクリプト |
| `test/playthrough.js` | 全ステージを自動操縦で通しプレイするテスト |
| `package.json` | `npm run build` / `npm test` の定義（テストには Playwright を使う） |
| `LICENSE` | MIT ライセンス |

## ステージ
各ステージで 3 件配達するとクリアし、ワープで次の星系へ進みます。行ったことのある
ステージはタイトル画面で左右キーを押して選べます（ブラウザに保存されます）。

| # | 名前 | ドック | 特徴 |
|---|---|---|---|
| 1 | AURA | AURA DOCK / LUNA POST | 惑星と月。間に小惑星帯 |
| 2 | TALOS | TALOS DOCK / KEEL POST / ICE YARD | 環をもつ巨大ガス惑星。環の帯の中では船体が削れる。すき間（半径 1200〜1280）と内側は安全 |
| 3 | MIRE | MIRE GATE / FOG LAMP / DEEP WELL | 霧の星雲（距離フォグ）。漂う岩と、霧に隠れた暗い小惑星 |
| 4 | HELIOS | HELIOS RING / FLARE LAB / SHADE POST | 恒星が点光源。半径 1150 より内側は熱で船体が傷む。恒星のまわりを岩が回る |
| 5 | NADIR | NADIR DOCK / EDGE POST / LAST LIGHT | 中心のブラックホールが重力で船を横に流す（GRAV 計）。光る降着円盤の中は船体が焼け、半径 220 の穴に入ると戻れない |

5 ステージを終えるとエンディングです。故郷の AURA を背景にエピローグが流れ、最後に THE END が出ます。
エンディングの途中で A か START を押すと THE END まで飛ばせます。THE END から START でタイトルに戻り、ステージ 1 が選ばれた状態になります。

## BGM
- 4 チャンネル構成：パルス波（デューティ比 25%）のメロディ、パルス波（12.5%）のアルペジオ、三角波のベース、ノイズのドラム
- 曲はタイトル、ドック、各ステージ（5 曲）、ステージクリアのジングル、エンディング
- 曲データは `TRACKS`（`index.html` 内）に文字列で書いています。メロディは「音名:16分音符の数」、
  コードは 1 小節に 1 つ、ベースとドラムは 16 ステップのパターンです
- オン・オフはタイトルの SELECT、または一時停止メニューで切り替えます。音は最初にキーかボタンを押したときから鳴ります

## 中身
- 解像度 160×144（3D 部分 160×120 ＋計器パネル 24 行）。表示は 30fps に固定
- Z バッファ付き三角形ラスタライザ、ニアクリップ、平行光源と点光源、距離フォグ
- 燃料：スラスターで速度を変えたときだけ減る（A で加速、B で減速。速度 1 変えるごとに `FUEL_PER_DV`%）。
  巡航中は減らない。燃料ゲージの縦線は、今の速度から止まるのに必要な燃料。燃料が切れると加速も減速もできずに漂い、
  8 秒以内にドックへ入れなければ給油船が来て、その場で 40% まで給油する（30CR）。出発点には戻されない
- ドッキング：速度 25 以下、扉に正対（約 37° 以内）、扉の中心に入ると成功
- 案内：目的地との間に惑星・恒星の熱・ブラックホール・ドックがあると、画面の目印が ◇ の経由点に変わり、
  回り道を案内します。最後の経由点はドックの正面です。コースを外れると 2 秒ごとに経路を引き直します
- ぶつかったとき：機首が表面に沿ってそれ、1 秒間は追加のダメージを受けません。低速でこすっただけなら 1 ダメージ
- 船体が大破すると最後のドックへえい航され、50CR を払う
- パレット 4 種（GREEN / SILVER / NIGHT / AMBER）
- スマホ用のタッチボタン（十字キー・A・B・SELECT・START）

## 操作
| キー | ボタン | 動作 |
|---|---|---|
| 矢印 / WASD | 十字キー | 機首の上下・左右。タイトルではステージ選択 |
| Z / J / Space | A | 加速 |
| X / K | B | 減速。B＋左右でロール |
| Shift | SELECT | 目標の切り替え。タイトルでは BGM のオン・オフ |
| Enter | START | 一時停止（上下で項目、左右で色と BGM を変更） |

## 公開用ファイルの作り方
`index.html` は claude.ai の Artifact として公開できる形（`<html>` や `<head>` を省いた形）で書いています。
`build.mjs` を実行すると、完全な HTML 文書に包んだ公開用ファイルが `dist/` にできます。

```bash
node build.mjs        # または npm run build
```

- `dist/orbit-post.zip`：`index.html`・`README.txt`・`LICENSE.txt` をルートに置いた zip。itch.io（HTML プロジェクト）にそのままアップロードできる
- `dist/orbit-post/`：同じ中身のフォルダ。GitHub Pages や Netlify などに置くだけで動く

## GitHub Pages での公開
`main` に push すると、`.github/workflows/pages.yml` が `build.mjs` で公開用ファイルを作り、
GitHub Pages に公開します（`orbit-post.zip` もダウンロード用に同じ場所へ置きます）。

最初の 1 回だけ、リポジトリの **Settings → Pages → Build and deployment → Source** を
**GitHub Actions** にしてください。その後は Actions タブの「Deploy to GitHub Pages」から手動でも実行できます。

## テスト
初回だけ `npm install` と `npx playwright install chromium` を実行してください。
`test/playthrough.js` は、画面の目印だけを追いかける自動操縦で全ステージを通しでプレイします。
キー入力と更新処理は本物を使い、時計だけを早回しします。ドック到着・船の喪失・ステージクリアを順に表示します。

```bash
node test/playthrough.js     # または npm test
```

公開用に作ったファイルを試すときは、`ORBIT_PAGE` に URL を渡します（例：`dist/orbit-post` を http で配信したもの）。

```bash
ORBIT_PAGE=http://127.0.0.1:8765/ node test/playthrough.js
```

## ライセンス
[MIT License](LICENSE) © 2026 Sinme52
