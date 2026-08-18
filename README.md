# 太陽シルバーサービス 事例集・チラシ作成アプリ

太陽シルバーサービス社内で、福祉用具レンタルチラシ・事例集・施設向け消耗品チラシを「写真と文章を入れるだけ」で作成するWebアプリです。

前セッションのSTEP3（ブラウン・ベージュ基調、左設定／中央A4／右詳細編集の3カラム）を土台に、認証・保存・共有権限・写真ライブラリ・テンプレート・AI文章補助・高品質出力・管理画面まで実装しています。

## 現在の状態

- `config.js` にSupabase設定がない場合は **ローカル確認モード** で動きます。
- ローカル確認モードでも、作成・編集・写真・自動保存・複製・テンプレート・ゴミ箱・権限の確認・PDF/PNG/JPEG/印刷まで試せます。
- Supabase / OpenAI の実プロジェクトへはまだ接続していません。実運用前に「本番接続手順」を行い、`docs/PRODUCTION_CHECKLIST.md` の確認が必要です。
- OpenAI APIキー、Supabase Service Role Key、社員パスワードはブラウザコードへ保存しない設計です。

## すぐ起動する

この配布物にはビルド済みの `dist/` が含まれています。

```bash
npm run dev
```

ブラウザで `http://localhost:4173` を開きます。

別PCでソースから再ビルドする場合は、Node.js とnpmを用意して以下を実行します。

```bash
npm install
npm run check
npm run dev
```

### ローカル確認用ログイン

初期確認ユーザーのパスワードは共通で `demo1234` です。

| 社員ID | 権限 |
|---|---|
| 1001 | 営業所管理者 |
| 1002 | 一般社員 |
| 2001 | 別営業所の一般社員 |
| 9001 | 全社管理者 |

管理画面から追加したローカル確認ユーザーは、入力したパスワードでログインできます。ローカル確認用パスワードも平文では保存せず、PBKDF2でハッシュ化してIndexedDBへ保存します。本番ではSupabase Authを使用します。

## 実装済みの主な機能

### ログイン・権限

- 社員ID＋パスワードでログイン
- 一般社員 / 営業所管理者 / 全社管理者
- 社員IDを内部認証用メールへ変換し、メールアドレスは画面へ表示しない
- 退職・休職者は削除ではなく `is_active=false` の利用停止
- 本番DBはRow Level Security（RLS）を使用

### 作品

- 新規作成を3ステップ化
- 作成モードを「レンタル / 事例集 / 消耗品」で切替
- 1 / 2 / 3 / 4 / 6 / 9枚（消耗品は1 / 2 / 3 / 4 / 6 / 9商品）レイアウト
- A4縦 / A4横
- タイトル、説明、商品名、品番、単位数、月額
- チラシ文言サンプルを226件収録（消耗品向け43件を含む）。タイトル・サブタイトル・写真/商品タイトル・説明文・フッターへワンタッチ挿入後、自由に手入力・修正可能
- 19営業所を選択でき、営業所名・住所・TEL・FAXをA4プレビュー／PDF／PNG／JPEG／印刷へ自動反映
- チラシ担当名・携帯番号は一度入力するとユーザー単位で記憶し、次回の新規作成へ自動入力（本番ではプロフィールへも保存）。入力直後に画面を離れた場合や、オフラインから復旧した場合も保存処理を再実行
- 1割 / 2割 / 3割負担の個別ON/OFFと自動計算
- 消耗品モードでは単位数・1〜3割負担を非表示
- 消耗品は13大分類・201種類の初期候補から選択でき、大分類/種類とも自由入力・変更可能
- 消耗品の商品名、品番、規格・容量、入数・包装、説明、価格を保存
- 消耗品価格はチラシ全体ON/OFF + 商品別ON/OFF
- 長い商品名は自動縮小と意味の切れ目での最大2行化を行い、手動改行も優先
- 写真の複数選択、ドラッグ＆ドロップ、一括配置
- 写真カードのドラッグ並び替え
- 縦長・横長写真に対応し、写真ごとに「写真全体を表示 / 枠いっぱいに表示」を切替
- 拡大縮小、上下左右位置、回転、差し替え、削除
- A4プレビュー上でタイトル、サブタイトル、写真タイトル、説明文、商品名、品番、単位数、フッター文言を直接編集
- 写真をA4上でクリックすると右側の写真調整へ切替
- 全画面プレビューでも文字を直接編集
- デザインスタイルとメインカラー
- 会社ロゴの表示 / 非表示を作品ごとに切替（PDF / PNG / JPEG / 印刷にも反映）
- 自動保存、保存状態表示、手動保存
- 元に戻す / やり直す
- 楽観的ロックによる競合検知
- 競合時の「最新状態を確認」「自分の内容を複製して残す」
- 複製して新規作成
- 自分だけ / 同じ営業所 / 会社全体の共有範囲
- ソフトデリート、ゴミ箱、復元、30日後の完全削除

### オフライン保護

- 約1.3秒のデバウンスでサーバー自動保存
- 約0.18秒のデバウンスでIndexedDBへローカル下書き保存
- オフライン表示
- 通信復旧時の自動同期
- ページ再読み込み後の復元
- ローカル下書きキーをユーザー単位に分離し、共用PCで別社員の下書きが混ざらないようにする

### 写真ライブラリ

- 商品写真 / 事例写真
- 自分だけ / 営業所 / 会社共有
- カテゴリー、メーカー、商品名、ファイル名検索
- JPEG / PNG / WebP のMIME検証と容量制限
- 元画像と軽量プレビューを分離
- Supabase Storageは非公開バケット
- 署名付きURLで閲覧
- 署名付きURL自体はDBへ保存せず、永続的な `mediaId` のみ保存
- 非公開写真を共有作品で使った場合、その作品の閲覧権限がある社員だけ作品内で画像取得可能。写真ライブラリへ勝手に公開はしない

### テンプレート

- 個人 / 営業所 / 全社テンプレート
- テンプレートから新規作成
- 現在の作品をテンプレートとして保存
- 検索、削除

### AI文章補助

Supabase Edge FunctionからOpenAI APIを呼びます。APIキーはブラウザへ出しません。

- AIで文章を整える
- メモから説明文を作る
- 入力されていない病名、身体状況、利用者属性、商品名、メーカー、品番、設置状況等を推測しない指示
- AI結果は自動上書きせず「AIからの提案」として表示
- 「この文章を使う」「やり直す」方式

### 出力

- 画面スクリーンショットではないA4専用レンダラー
- PNG
- JPEG
- PDF
- 直接印刷
- 高品質出力時は元画像を優先
- 出力前に、タイトル、写真、文章はみ出し、画像読込失敗を確認
- 具体的に「写真03…」のように修正箇所を表示

### 管理

- 営業所管理者: 自営業所社員、営業所情報
- 全社管理者: 全社員、全営業所、営業所追加、会社情報、会社ロゴ、カテゴリー
- 会社・営業所情報はA4へ自動反映
- チラシ担当名・携帯番号を作品とは別にユーザー設定として記憶し、作品作成時に自動入力
- 公式事業所一覧に基づく19営業所の初期データを同梱

## 技術構成

STEP3の既存コードが依存パッケージなしの `HTML + CSS + JavaScript` だったため、承認済みUIを壊さないことを優先し、別フレームワークへ全面移行せず **モジュール分割したTypeScript** へ移行しました。

- Frontend: TypeScript / Native ES Modules / HTML / CSS
- Build: TypeScript compiler
- Backend: Supabase Auth / PostgreSQL / Row Level Security / Storage / Edge Functions
- AI: OpenAI API（Supabase Edge Function経由）
- Local protection: IndexedDB
- PDF / image: 専用Canvasレンダラー（重い処理は出力時のみ）

主な構成:

```text
src/
  app/
  components/
  features/
    auth/
    flyers/
    editor/
    media/
    templates/
    admin/
  services/
  storage/
  types.ts
  utils/
supabase/
  migrations/202608180001_initial.sql
  migrations/202608180002_offices_contact_preferences.sql
  functions/ai-assist/
  functions/admin-users/
scripts/
  dev-server.mjs
  provision-admin.mjs
tests/
```

各写真の柔軟な編集状態は `flyers.editor_state JSONB` にまとめています。作品全体を1回の自動保存単位として扱い、9枚編集時に過剰な通信や中途半端な保存状態を増やさないためです。検索・権限・一覧に必要な項目は通常カラムに分けています。

## 本番接続手順

### 1. Supabaseプロジェクトを作成

Supabaseで新規プロジェクトを作成します。プロジェクトURL、ブラウザ公開用のAnon/Publishable Key、サーバー用Service Role Keyを取得します。

### 2. DB・RLS・Storageを作成

`supabase/migrations/` 配下のマイグレーションを番号順にすべてSupabaseへ適用します。`202608180002_offices_contact_preferences.sql` には19営業所の公式掲載情報と、担当名・携帯番号の記憶用カラム/RPCが含まれます。`202608180003_consumables_mode.sql` は消耗品カテゴリーを追加し、消耗品固有データは後方互換性を保ちながら `editor_state` JSONBへ保存します。

Supabase CLIを使う場合の例:

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

またはSupabase DashboardのSQL EditorからマイグレーションSQLを適用できます。

### 3. Edge Functionsを公開

```bash
supabase functions deploy ai-assist
supabase functions deploy admin-users
```

### 4. サーバー側シークレットを設定

`server.env.example` に必要な変数名があります。実値はGitへコミットしないでください。

最低限:

- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `APP_ORIGIN`
- `AUTH_EMAIL_DOMAIN`

Supabaseが自動提供するプロジェクト用環境変数以外に必要な値は、Edge FunctionのSecretsへ設定します。OpenAI APIキーやService Role Keyを `config.js` へ書くことは禁止です。

### 5. ブラウザ用 `config.js` を設定

`config.example.js` を参考に `config.js` を設定します。ここへ置けるのはブラウザ公開を前提とした値だけです。

```js
window.__TSS_CONFIG__ = {
  supabaseUrl: "https://YOUR_PROJECT.supabase.co",
  supabaseAnonKey: "YOUR_PUBLIC_ANON_OR_PUBLISHABLE_KEY",
  authEmailDomain: "auth.taiyo-silver.internal",
  aiFunctionName: "ai-assist",
  appName: "太陽シルバーサービス 事例集・チラシ作成"
};
```

### 6. 最初の全社管理者を作成

Service Role Keyと初期管理者パスワードは環境変数からのみ読み込みます。

```bash
# server.env.example の変数を安全な方法で環境変数へ設定した後
npm run provision-admin
```

スクリプトは社員IDから内部認証用メールを作りますが、社員画面には表示しません。

### 7. WebアプリをHTTPSで公開

静的ホスティングで以下を公開します。

- `index.html`
- `styles.css`
- `config.js`
- `dist/`
- `assets/`

ルーティングはURLハッシュ方式のため、通常はサーバー側のSPA rewriteは不要です。社内運用ではHTTPSを必須にしてください。

## テスト

```bash
npm run check
```

これは以下をまとめて実行します。

1. TypeScript型チェック
2. ビルド
3. Nodeテスト

3モード（レンタル / 事例集 / 消耗品）を含むフルブラウザE2Eを実施済みです。`npm run check` は型チェック・ビルド・テスト38/38すべて成功します。A4横×消耗品4商品の表示崩れ、A4横のズーム倍率、TypeScript 5.9系での型エラーを修正しました。実プリンタでのA4縦・横印刷も確認済みです。実Supabase / 実OpenAI接続のライブ確認のみ未実施です。詳細は `docs/QA_RESULTS.md` を参照してください。

本番Supabase / OpenAIを接続した後は、必ず `docs/PRODUCTION_CHECKLIST.md` を実施してください。本番RLS・Storage署名URL・Edge Functionのライブ確認は、実プロジェクトの認証情報がない現在の配布時点では未実施です。


## PNG印刷
編集画面の「PNGを印刷」から、高品質PNGをA4縦・横の用紙設定で直接印刷できます。


## Claude Codeへ引き継ぐ場合

- `docs/CLAUDE_CODE_MASTER_REQUIREMENTS.md`：全確定要件、消耗品201種類、受入テストまで含む完全版
- `docs/CLAUDE_CODE_IMPLEMENTATION_PROMPT.md`：Claude Codeへそのまま渡せる実装指示

この2ファイルとリポジトリ一式を同時に渡してください。
