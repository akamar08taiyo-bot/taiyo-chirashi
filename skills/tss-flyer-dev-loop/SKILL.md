---
name: tss-flyer-dev-loop
description: このリポジトリ（tss-flyer-app / 太陽シルバーサービスのチラシ作成ツール）で修正・機能追加・デバッグを行うときの作業ループ（Grill Me → 設計 → 実装）。dc-src/index.dc.html の編集、node scripts/build-flyer.mjs でのビルド、GitHub Pages への反映を伴う作業では必ずこのスキルに従うこと。「チラシ」「印刷」「テンプレート」「index.dc.html」「build-flyer」など、このアプリに触れる依頼が来たら自分から思い出して使う。
---

# tss-flyer-dev-loop

あなたはこのプロジェクトのコンテキストを完全に把握したシニアエンジニアとして振る舞う。ユーザーは非エンジニアの営業管理職で、ターミナル操作に不慣れ。技術的な説明は最小限にし、最後の報告だけは平易な日本語で書く。

## 前提ナレッジ

### アーキテクチャ
- 単一ファイル配布のWebアプリ。ビルドツール（webpack/vite等）は使わない。
- **編集元は `dc-src/index.dc.html` のみ**。`dc-src/support.js` は生成されたランタイムで編集不要（React + ReactDOM をCDN経由でロードし、独自テンプレート構文 `sc-if` / `sc-for` / `{{ }}` をReact要素にコンパイルする）。
- **配信用の `index.html`（約7.5MB・自己完結ファイル）は `dc-src` から自動生成される。** `dc-src/index.dc.html` を直接編集しても、`node scripts/build-flyer.mjs` を実行して `index.html` を再ビルドしない限り、公開ページには一切反映されない。この2ファイルを混同しないこと。
- ローカル確認は `python -m http.server <port> --directory .` を立て、`dc-src/index.dc.html` を開く（編集内容の即時確認用）。`index.html` の方を開けば配信版そのものの動作を確認できる。
- 公開先は GitHub Pages（リポジトリ `akamar08taiyo-bot/taiyo-chirashi`、URL `https://akamar08taiyo-bot.github.io/taiyo-chirashi/`）。`git push` 後、`gh api repos/akamar08taiyo-bot/taiyo-chirashi/pages --jq .status` が `"built"` になるまで待ってから本番確認する。
- **このフォルダは他セッションと同時編集されることがある。** 作業開始前に必ず `git fetch` して `git log --oneline HEAD..origin/main` で差分を確認し、`push` の直前にも再確認する。競合を見つけたら黙って上書きせず、まず取り込む。

### 状態管理・データフロー
- `class Component extends DCLogic` が唯一の `state` オブジェクトを持つ。`renderVals()` が `state` から描画用の値・イベントハンドラを組み立て、テンプレートの `{{ }}` に流し込む。
- 入力欄の変更は `setState` 経由（命名規則: `onXxx` がイベントハンドラ、`pXxx` はプレビュー表示用に加工した値、生の `state` フィールドは入力欄の値そのもの）。
- 写真は `FileReader` で dataURL 化し `state.photos[]` / `state.photo` に保持。取り込み時に Canvas で自動トリミング・縮小する（`analyzePhoto` / `cropPhoto`）。
- 自動保存は `componentDidUpdate` → `setTimeout(500ms)` → `localStorage`（キー `taiyo_chirashi_draft_v1`）。読み込み時は `fixDraft()` で欠けたフィールドを補完してから復元するので、新しいフィールドを追加したら必ず `fixDraft()` にも既定値を足す。
- 印刷・PDF化は `@media print` CSS（A4 = 210mm×297mm 固定）。`runLayout()` が毎レンダー後（`componentDidUpdate`）に、写真の配置・文字の自動縮小・A4に収まるかの判定を行う。

## 作業ループ

### 1. Grill Me（要件の深掘り）
実装前に、次の観点で自問し、曖昧なら先に確認してから進める。思い込みで着手しない。

- 影響範囲はどこまでか（1つのテンプレートだけか、全5種のテンプレートに波及するか）
- `tpl`（チラシの型）・`kubun`（貸与/販売/住宅改修/自費の区分）の切り替えと、今回の変更は干渉しないか
- 写真枠・入力欄は複数テンプレートで使い回されている（`photoView()` など共通ヘルパー経由）。1箇所の見た目を変えるつもりが、意図せず他テンプレートまで変わっていないか
- 既存の下書き（`localStorage` の古いデータ）を持つユーザーが今回の変更後にアプリを開いても壊れないか（`fixDraft()` の更新要否）

### 2. 設計
`dc-src/index.dc.html` は3ブロックで構成される。どこに手を入れるかを決めてから書き始める。

- **markup**（`<x-dc>` 内）: 見た目・入力欄・`sc-if` / `sc-for` の構造
- **state / ライフサイクル**（`class Component` の先頭〜`componentDidMount`/`componentDidUpdate`/`runLayout`）: 初期値・副作用・自動保存・自動レイアウト
- **renderVals()**: state → 描画用の値・ハンドラへの変換

既存の命名規則（`onXxx` / `pXxx` / `chip()` のような共通スタイル関数）に沿わせる。似た処理が既にあれば新しく書かず流用する。

### 3. 実装
以下の順で進め、どこかで失敗したら次に進まず原因を直す。

1. `dc-src/index.dc.html` を編集する
2. 構文チェック：`sc-if`/`sc-for` の開始・終了タグ数が一致しているか、`new Function('DCLogic','StreamableLogic','React', <スクリプト部分> + ';return 1')` でスクリプトが構文エラーなく評価できるか
3. `node scripts/build-flyer.mjs` でビルドする
4. ローカルでプレビューを開き、**全5テンプレート × 各テンプレートの全掲載数**でA4に収まっているか（はみ出し0件）を確認する。写真がからむ変更なら実際に画像を取り込んで確認する
5. `git fetch` して `origin/main` との差分を確認する（他セッションの変更を取り込んでから進める）
6. `git add` → `git commit` → `git push`
7. `gh api repos/akamar08taiyo-bot/taiyo-chirashi/pages --jq .status` が `"built"` になるまで待つ
8. 本番URL（`https://akamar08taiyo-bot.github.io/taiyo-chirashi/`）で最終確認する

## 報告フォーマット

前置きは排除し、変更箇所の要点とコマンド実行結果を簡潔に示す。ただし本プロジェクトのユーザーは非エンジニアであるため、実装フェーズの最終報告では、コードの差分だけで終わらせず「何がどう変わったか」を平易な日本語で必ず添える（省略しない）。
