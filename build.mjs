// Builds a standalone release of Orbit Post: dist/orbit-post/ and dist/orbit-post.zip.
// index.html in this folder is written as a page fragment (no <html>/<head>/<body>) so it can be
// published as a claude.ai Artifact; this script wraps it into a complete HTML document.
// Usage: node orbit-post/build.mjs
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, 'index.html'), 'utf8');

const split = src.indexOf('<main');
if (split < 0) throw new Error('index.html: <main> not found');
const head = src.slice(0, split)
  .replace(/<meta charset="utf-8">\s*/i, '')
  .replace(/<meta name="claude:[^>]*>\s*/g, '')
  .trim();
const body = src.slice(split).trim();

const icon = 'data:image/svg+xml,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" shape-rendering="crispEdges">' +
  '<rect width="16" height="16" fill="#0f380f"/><circle cx="8" cy="8" r="5" fill="#8bac0f"/>' +
  '<rect x="1" y="7" width="14" height="2" fill="#9bbc0f"/><rect x="5" y="5" width="2" height="2" fill="#306230"/></svg>');

const html = `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="description" content="Game Boy風160×144・4階調の3D宇宙配達ゲーム。コックピットから5つの星系を飛び、荷物を届けます。">
<meta name="theme-color" content="#13151c">
<link rel="icon" href="${icon}">
<style>
html,body{margin:0;padding:0}
:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}
body{font-size:14px;-webkit-text-size-adjust:100%}
</style>
${head}
</head>
<body>
${body}
</body>
</html>
`;

const readme = `Orbit Post — 宇宙の配達便
=========================

Game Boy 風の 160×144・4階調画面で、コックピット視点の宇宙を飛ぶ配達ゲームです。
5つの星系を巡り、各ステージで荷物を3件届けるとクリア。最後にエンディングがあります。

■ 遊び方（手元で）
  index.html をブラウザで開くだけで遊べます。インストールやサーバーは不要です。
  ※ 音（BGM・効果音）は、最初にキーかボタンを押したときから鳴ります。

■ 公開のしかた
  中身は index.html 1 ファイルだけの静的サイトです（外部のゲームライブラリは不要）。
  どれか一つの方法でアップロードしてください。
  - itch.io : 「Kind of project」を HTML にして、この zip をそのままアップロード。
              「This file will be played in the browser」にチェック。
              埋め込みサイズは 1100×900 程度、「Mobile friendly」もオンにできます。
  - GitHub Pages / Netlify / Cloudflare Pages など :
              index.html をサイトのルート（またはサブフォルダ）に置くだけで動きます。

■ 操作
  十字キー / 矢印・WASD : 機首の上下・左右（タイトルではステージ選択）
  A / Z                 : 加速（スラスター噴射。燃料を使う）
  B / X                 : 減速（逆噴射。燃料を使う）。B＋左右でロール
  SELECT / Shift        : 目標の切り替え（タイトルでは BGM オン・オフ）
  START / Enter         : 一時停止（上下で項目、左右で画面の色と BGM を切り替え）
  スマホでは画面下のボタンで操作できます。

■ メモ
  - ページの説明文の書体は Google Fonts から読み込みます。オフラインでは別の書体で表示されますが、
    ゲーム画面には影響しません。
  - 行ったステージ・画面の色・BGM 設定はブラウザに保存されます（localStorage）。
`;

const out = join(here, 'dist');
rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, 'orbit-post'), { recursive: true });
writeFileSync(join(out, 'orbit-post', 'index.html'), html);
writeFileSync(join(out, 'orbit-post', 'README.txt'), readme);
// -X: no extra file attributes, -D: no directory entries -> index.html sits at the zip root
execFileSync('zip', ['-X', '-D', '-j', join(out, 'orbit-post.zip'), join(out, 'orbit-post', 'index.html'), join(out, 'orbit-post', 'README.txt')], { stdio: 'inherit' });
console.log('built', join(out, 'orbit-post.zip'));
