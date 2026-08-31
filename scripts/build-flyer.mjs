/**
 * dc-src/index.dc.html の編集内容を、配信用の自己完結ファイル index.html に反映します。
 *
 *   node scripts/build-flyer.mjs
 *
 * index.html は「ランタイム(support.js)・フォント・ページ本体」を1ファイルに詰めた
 * 形式です。フォントとランタイムはそのまま使い回し、ページ本体（<helmet>の見た目CSS、
 * <x-dc>のマークアップ、<script data-dc-script>のロジック）だけを差し替えます。
 *
 * dc-src 側の onClick / <select> / <br> などの書き方は support.js が読み込み時に
 * 変換するため、ここでの変換は不要です。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bundlePath = path.join(root, 'index.html');
const srcPath = path.join(root, 'dc-src', 'index.dc.html');

const bundle = fs.readFileSync(bundlePath, 'utf8');
const src = fs.readFileSync(srcPath, 'utf8');

const TPL_RE = /(<script type="__bundler\/template">\n)([\s\S]*?)(\n  <\/script>)/;
const m = bundle.match(TPL_RE);
if (!m) throw new Error('index.html に __bundler/template が見つかりません');
const tpl = JSON.parse(m[2]);

const cut = (text, from, to, label) => {
  const a = text.indexOf(from);
  if (a < 0) throw new Error(label + ': "' + from + '" が見つかりません');
  const b = text.indexOf(to, a + from.length);
  if (b < 0) throw new Error(label + ': "' + to + '" が見つかりません');
  return { start: a, end: b + to.length, body: text.slice(a + from.length, b) };
};

// --- 既存バンドルから、埋め込みフォントの <style> までを取り出す ---
const helmetOpen = tpl.indexOf('<helmet>');
if (helmetOpen < 0) throw new Error('バンドルに <helmet> がありません');
const fontEnd = tpl.indexOf('</style>', helmetOpen);
if (fontEnd < 0) throw new Error('バンドルに埋め込みフォントの <style> がありません');
const headPart = tpl.slice(0, helmetOpen + '<helmet>\n'.length);
const fontStyle = tpl.slice(helmetOpen + '<helmet>\n'.length, fontEnd + '</style>\n'.length);

// --- 既存バンドルの末尾（</script> 以降）を取り出す ---
const lastScriptEnd = tpl.lastIndexOf('</script>');
if (lastScriptEnd < 0) throw new Error('バンドルに </script> がありません');
const tailPart = tpl.slice(lastScriptEnd);

// --- dc-src から、見た目CSS・マークアップ・ロジックを取り出す ---
const srcStyle = cut(src, '<style>', '</style>', 'dc-src の <style>');
const styleBlock = '<style>' + srcStyle.body + '</style>\n';

const afterHelmet = src.indexOf('</helmet>');
if (afterHelmet < 0) throw new Error('dc-src に </helmet> がありません');
const markupStart = afterHelmet + '</helmet>\n'.length;
const markupEnd = src.indexOf('</x-dc>');
if (markupEnd < 0) throw new Error('dc-src に </x-dc> がありません');
const markup = src.slice(markupStart, markupEnd);

const scriptStart = src.indexOf('<script type="text/x-dc"');
const scriptEnd = src.lastIndexOf('</script>');
if (scriptStart < 0 || scriptEnd < 0) throw new Error('dc-src にロジックの <script> がありません');
const scriptBlock = src.slice(scriptStart, scriptEnd + '</script>'.length);

const nextTpl =
  headPart +
  fontStyle +
  styleBlock +
  '</helmet>\n' +
  markup +
  '</x-dc>\n' +
  scriptBlock +
  '\n' +
  tailPart;

// --- 簡単な健全性チェック ---
const must = ['data-fit', 'data-fitlabel', 'data-print="sheet"', 'class Component', 'renderVals()'];
for (const token of must) {
  if (!nextTpl.includes(token)) throw new Error('生成結果に "' + token + '" が含まれていません');
}
if (nextTpl.length < tpl.length * 0.5) throw new Error('生成結果が極端に短いため中止しました');

// HTML の <script> 内に置くため、"</" はエスケープしておく（元のバンドルと同じ形式）
const payload = JSON.stringify(nextTpl).replace(/<\//g, '<\\u002F');
const nextBundle = bundle.replace(TPL_RE, (_all, head, _body, tail) => head + payload + tail);
fs.writeFileSync(bundlePath, nextBundle);

console.log('index.html を更新しました');
console.log('  ページ本体: ' + tpl.length.toLocaleString() + ' → ' + nextTpl.length.toLocaleString() + ' 文字');
console.log('  ファイル  : ' + Math.round(nextBundle.length / 1024) + ' KB');
