# 太陽シルバーサービス チラシ作成ツール（レンタル）

ケアマネジャー様向けの福祉用具チラシを、写真と文章を入れるだけで作成・印刷する静的Webアプリです。
公開URL：https://akamar08taiyo-bot.github.io/taiyo-chirashi/

## ファイル構成

| パス | 内容 |
|---|---|
| `index.html` | 配信用の自己完結ファイル（`dc-src` から自動生成。直接編集しない） |
| `dc-src/index.dc.html` | **編集用ソース。ここだけを直します** |
| `dc-src/support.js` | ランタイム（編集不要） |
| `scripts/build-flyer.mjs` | `dc-src` の内容を `index.html` に反映するスクリプト |
| `skills/tss-flyer-dev-loop/` | 開発時の作業手順 |

## 編集と反映

```sh
# dc-src/index.dc.html を編集したら
npm run build   # = node scripts/build-flyer.mjs
```

詳しくは `dc-src/README.md` を参照してください。

※ 以前のTypeScript版（old.html・src/・dist/ など）は使用していないため削除しました。必要な場合はGitの履歴から参照できます。
