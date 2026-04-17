# Market Intel App

## ビジョン

対象（アプリ・人物・企業など）の情報と周辺環境を整理し、**今の立ち位置・過去の推移・次の一手** を導くインテリジェンスツール。

- **現在地の把握**: 対象と周辺環境（市場・競合・ユーザー）を一画面で整理
- **推移の確認**: 過去からどう変わったか、何がきっかけで変動したかを因果付きで振り返る
- **次の一手の予測**: 蓄積した因果パターンから成功確率の高いアクションを提示

詳細: `docs/vision.md`

## デプロイ

- GitHub Pages URL: https://kikaizaru-art.github.io/market-intel-app/
- **デプロイ方式**: GitHub Actions (`actions/deploy-pages`) — master push で自動デプロイ
- **Vite base path**: `./` (相対パス — GitHub Pages / Vercel 両対応)

## 開発

- `npm run dev` — ローカル開発サーバー (port 5173)
- `npm run build` — プロダクションビルド (dist/)
- `npm run collect` — 実データ収集 (Google Trends, Google Play, Ranking, Reddit, RSS, YouTube, Twitter/X)
- `npm run discover` — アプリ自動探索 & ドメイン設定生成 (新規ドメイン)
- `npm run discover:refresh` — 競合自動再探索 & 更新 (既存ドメイン)

## アーキテクチャ

- `src/dashboard/constants.js` — 共有定数 (カラーパレット, ラベル)
- `src/dashboard/utils.js` — 共有ユーティリティ (formatDate, isActive)
- `src/dashboard/components/shared/` — 共通UIコンポーネント (ChartTooltip, SentimentBar)
- `src/dashboard/components/PositionView.jsx` — 現在地タブ (KPI, 競合ポジション, マクロ環境)
- `src/dashboard/components/HistoryView.jsx` — 推移タブ (トレンド, ランキング, レビュー, イベント, ニュース)
- `src/dashboard/components/ActionsView.jsx` — 次の一手タブ (リスク/チャンス, 推奨アクション, AI分析, 因果関係)
- `src/dashboard/components/RecommendedActions.jsx` — 推奨アクションパネル (施策×効果集計, 現状マッチング)
- `src/dashboard/components/EventQuickInput.jsx` — 施策クイック記録UI (プロダクト/マーケ2レーン切替, 媒体・地域タグ, ワンタップ+メモ+自由記帳)
- `src/dashboard/components/QuickRecordPanel.jsx` — ActionsView 先頭の施策記録パネル (CausationView を開かなくても記録できる)
- `src/dashboard/components/LlmSettings.jsx` — LLM設定UI (Ollama接続, モデル選択)
- `src/collectors/` — データ収集モジュール (trends, store, store-ranking, community, news, youtube-channels, twitter, app-discover, competitor-discovery)
- `src/analyzers/` — 分析ロジック (trend, anomaly, causation, llmAnalyzer, actionRecommender)
- `src/analyzers/llmAnalyzer.js` — LLM分析モジュール (因果サマリー生成, 季節要因分析, テンプレートフォールバック)
- `src/analyzers/actionRecommender.js` — アクション推奨エンジン (施策記録の前後メトリクス変動 → 同時期の市場 baseline を差し引いた純効果で eventType / 媒体 / 地域 / レーン別に集計 → 現状と照合。`filters`/`groupBy` で多次元切替)
- `src/dashboard/services/storageBackend.js` — IndexedDB ストレージバックエンド (インメモリキャッシュ + 非同期永続化)
- `src/dashboard/services/patternStore.js` — パターン学習ストア (storageBackend 経由で IndexedDB に保存)
- `src/dashboard/services/llmService.js` — ローカルLLMサービス (Ollama接続, 設定永続化, プロバイダー抽象化)
- `src/framework/` — マルチドメインフレームワーク (domain, layers, collector-registry, causal-engine)

## 4層収集モデル

対象の周辺環境を4つのレイヤーで多層的に収集し、因果関係を蓄積・学習する。

- **L1 マクロ**: 市場全体の追い風・逆風 (トレンド、業界ニュース)
- **L2 競合**: ライバルの動き (順位、レビュー)
- **L3 ユーザー**: 自分のユーザーの声と行動 (レビュー、SNSセンチメント)
- **L4 因果**: 「こうしたらこうなった」の学習エンジン (自動蓄積・検証・信頼度更新)
- **ドメイン設定**: `config/domains/{domain}.json` で対象を定義。切替で同じ構造が動く
- **ドメイン切替**: ダッシュボードUIでドメイン選択可能 / `DOMAIN=stock npm run collect` でCLI切替
- 詳細設計: `docs/architecture.md`

## データフロー

1. `npm run collect` → `data/` に個別JSON + `data/history/{domain}.json` に履歴蓄積 + `public/data/collected.json` に統合出力
2. 履歴蓄積: reviews(月次12ヶ月), trends(週次52週), ranking(日次90日), community(日次30日), youtubeChannels(週次26週, 対象に `youtube_channel_id` がある時のみ), twitter(日次30日, ドメインに `twitter` ソースがある時のみ)
3. ダッシュボード起動時に `collected.json` を fetch
4. 実データがあれば上書き、なければ `generateData.js` のモックを使用
5. GitHub Actions (`collect.yml`) で毎日 JST 7:00 に自動収集・デプロイ

## 次の実装課題 (優先順)

1. ~~**因果ログの永続化**~~ — IndexedDB (インメモリキャッシュ付き) で堅牢に永続化済み。localStorage からの自動移行あり
2. ~~**自動検証の循環論法修正**~~ — イベント前後のトレンド推移で独立検証する方式に修正済み
3. ~~**文脈入力UI**~~ — ワンタップ4選択肢+メモ付き+自由記帳で因果文脈を付与、手動メモに昇格
4. ~~**ダッシュボード3タブ再構成**~~ — 現在地/推移/次の一手 の3タブに再構成済み (PositionView/HistoryView/ActionsView)
5. ~~**インフルエンサードメイン設計**~~ — ドメイン設定・モックデータ・UI登録・コレクタースタブ実装済み
6. ~~**競合自動探索 & 定期更新**~~ — ポジション×方向性スコアリングで5〜10件を自動選定、`discover:refresh` で更新
7. ~~**実データ収集パイプライン**~~ — 5コレクター (Trends/Store/Ranking/Community/News) + 履歴蓄積 + GitHub Actions 定期実行
8. ~~**ローカルLLM統合 (Phase 3)**~~ — Ollama ベースの因果サマリー生成 + 季節要因分析。未接続時はテンプレートフォールバック
9. ~~**推奨アクション (次の一手の本質機能)**~~ — 過去の施策記録 (eventType 付き) の前後でレビュー/トレンド変動を計測し、eventType 別に成功率・平均効果・信頼度を集計。現状 (リスク/チャンス) と照合して推奨/警告をランク表示
10. ~~**施策効果の市場補正 (外部要因の分離)**~~ — 施策前後の生の変動から同時期の市場平均 (競合アプリのレビュー変化 or 他ジャンルのトレンド変化) を差し引いた「純効果」で集計・ランク付け。「追い風に乗っただけ」を除外して真の施策効果を抽出
11. ~~**YouTube Data API 統合**~~ — インフルエンサードメインの L2 (競合チャンネル) が実データで動く。`channels.list` + `playlistItems.list` + `videos.list` で登録者数/総再生数/直近30日の投稿頻度・平均再生数を取得し、週次26週で履歴蓄積。`YOUTUBE_API_KEY` 未設定時はモック
12. ~~**Twitter/X 収集 (Nitter 経由)**~~ — 日本語ユーザーの会話量を L3 ユーザー層に追加。Nitter RSS (`/search/rss?f=tweets&q=...`) を複数インスタンスでフェイルオーバーしつつ取得。ドメイン設定 `layers.user.sources.twitter.keywords` がある場合のみ実行し、日次30日のスナップショット (ツイート数 / ユニーク著者 / 平均本文長) を `data/history/{domain}.json` の `twitter[]` に蓄積。ダッシュボードでは PositionView に統計パネル、HistoryView に「X (会話量)」タブを追加
13. ~~**施策レーン + 媒体/地域タグ (ゲーム運用ペルソナ対応)**~~ — 施策プリセットを「プロダクト(企画/開発)」「マーケ(広告運用)」2レーンに分割し、マーケ施策には媒体 (Meta/Google/TikTok/X/Unity/AppLovin/ASA/YouTube/インフル/TVCM) と地域 (JP/US/Asia/EU/Global) をタグ付け可能に。`actionRecommender` は `filters` と `groupBy` で多次元集計 (施策種別 / 媒体 / 地域 / レーン) に対応、`RecommendedActions` の UI でレーン・媒体・地域のフィルタチップと集計軸切替を提供
14. ~~**HistoryView 施策マーカー**~~ — 記録した施策 (causal notes) をトレンド週次・レビュー月次・ランキング日次の各チャート上にオーバレイ。影響別の色付きリファレンスライン + preset アイコンで「施策を打った日の前後でどう変動したか」を 1 画面で判定可能
15. ~~**ActionsView の UX 再構成 (分析者向け要素の折りたたみ)**~~ — `QuickRecordPanel` をタブ先頭に配置して日常的な施策記録を前面化。CausationView (自動検出・学習統計・手動メモ管理) は「詳細: 因果ログ」としてデフォルト折りたたみに変更
16. ~~**ドメイン別タブ構成 + ジャンル色テンプレ化**~~ — `config/domains/{domain}.json` の `tabs: [...]` でタブの取捨選択・順序を宣言可能。`genreColors` でジャンル色を上書き可能 (未指定ジャンルは PALETTE から順割り当て)。`layers.macro.sources.news-rss.feeds[].region` と `layers.competitor.sources.ad-intelligence` の schema 枠を追加 (コレクター実装は後続)
17. ~~**施策記録の一覧 & ワンクリック削除**~~ — `QuickRecordPanel` に直近の手動/クイック記録リストを追加。誤記録を CausationView を開かずに即削除 (2段階クリック)。ラベル/レーン/媒体/地域/影響度を1行コンパクト表示。`patternStore` に `deleteCausalNote` / `updateCausalNote` API を追加

詳細: `docs/vision.md` の「既知の課題と次のアクション」

## ローカルLLM統合

- **バックエンド**: Ollama (localhost:11434) — ローカルで無料実行
- **対応モデル**: Ollama で利用可能な任意のモデル (llama3.2, gemma2 等)
- **機能**: 因果パターンの自然言語サマリー、季節要因分析
- **フォールバック**: LLM未接続時はテンプレートベースの分析を表示
- **設定**: IndexedDB に永続化、UI から接続先・モデル・Temperature を設定可能
- **起動方法**: `ollama serve` でサーバー起動 → ダッシュボードの「次の一手」タブで自動接続

## YouTube Channels 収集 (youtube-channels)

- **用途**: インフルエンサードメインの L2 競合クリエイター + ゲームドメインの配信先行指標
- **API**: YouTube Data API v3 (`channels.list` / `playlistItems.list` / `videos.list`)
- **取得内容**:
  - 登録者数 / 総再生数 / 投稿本数 (累積)
  - 直近アップロード最大50本の視聴/いいね/コメント数
  - 直近30日の投稿数・平均再生数・エンゲージメント率
- **実行条件**: 対象 (`config/domains/{domain}.json` の `targets[].identifiers.youtube_channel_id`) に YouTube チャンネルIDがある場合のみ 6番目のコレクターとして自動実行
- **認証**: `YOUTUBE_API_KEY` 環境変数で APIキーを渡す。未設定時はモックデータで動作継続
- **クォータ**: 1チャンネルあたり 3 units, 無料枠 10,000/日で 3,000 チャンネル/日まで
- **履歴**: `data/history/{domain}.json` の `youtubeChannels[channelId][]` に週次26週のスナップショットを保持 (月曜起点)

## Twitter/X 収集 (twitter)

- **用途**: L3 ユーザー層の日本語会話量 — Reddit (英語圏) を補完
- **経路**: Nitter インスタンス群の RSS (`/search/rss?f=tweets&q=<keyword>`) を順に試行してフェイルオーバー
- **取得内容**: ツイート本文 / 著者ハンドル / 投稿日時 / 元リンク
- **集計**: ツイート数 / ユニーク著者 / 日あたりツイート数 / 平均本文長 / 日別バケット
- **実行条件**: ドメイン設定 `layers.user.sources.twitter.keywords` にキーワードがある場合のみ (7番目のコレクター)
- **無効化**: `NITTER_DISABLE=1` 環境変数で即座にモックへフォールバック
- **注意**: Nitter は非公式ミラーで運営者停止リスクあり。将来は X API / snscrape 等への切替を想定した薄いラッパ
- **履歴**: `data/history/{domain}.json` の `twitter[]` に日次30日分のスナップショットを保持

## 施策レーン + 媒体/地域タグ (ゲーム運用向け)

- **目的**: 開発/企画側の施策 (アプデ・ガチャ・コラボ) と広告運用側の施策 (クリエ差替・予算増減・新媒体投入) を分離して記録し、eventType 単独ではなく媒体・地域も軸に効果を計測できるようにする
- **レーン**: `lane: 'product' | 'marketing'` を各プリセットに付与。EventQuickInput で切替タブ表示 (複数レーンがある時のみ)
- **媒体タグ**: `media: ['meta', 'google', 'tiktok', ...]` — マーケ施策でのみ表示される複数選択チップ
- **地域タグ**: `region: 'jp' | 'us' | 'asia' | 'eu' | 'global'` — 全レーン共通の単一選択
- **集計軸**: `recommendActions({ groupBy })` で `'eventType' | 'media' | 'region' | 'lane'` を切替可能。`filters` でレーン・媒体・地域別に事前絞り込み
- **UI**: `RecommendedActions` がタグ付き記録があれば集計軸切替ボタンと絞り込みチップを自動表示
- **HistoryView 連携**: 記録した causal notes が `impact` 色でチャート (トレンド週次・レビュー月次・ランキング日次) 上にオーバレイされる

## ドメイン設定 (config/domains/{domain}.json) 拡張スキーマ

- `tabs: string[]` — 表示タブの順序と取捨選択。既定は `["position", "history", "actions"]`。`TAB_CATALOG` にないキーは無視
- `categories: string[]` — ジャンル/カテゴリ (業界ベンチマーク・色割り当てに使用)
- `genreColors: { [genre]: hex }` — ジャンル色の上書き。未指定は `GENRE_COLORS` (ハードコード) → `PALETTE` の順でフォールバック
- `layers.macro.sources.news-rss.feeds[].region` — ニュース RSS の地域タグ (将来の地域フィルタ UI 用)
- `layers.macro.sources.google-trends.regions: { [geo]: keywords[] }` — 地域別 Trends キーワード (将来実装)
- `layers.competitor.sources.ad-intelligence` — 競合広告動向監視コレクターの枠。現状は schema 定義のみで `providers: []`。将来 Meta Ad Library / TikTok Creative Center / SensorTower Ads などを統合予定

## 競合自動探索 (competitor-discovery)

- **探索ソース**: Google Play の類似アプリ + キーワード検索 + 同開発者アプリ
- **スコアリング**: ポジション類似度 (60%) × 方向性類似度 (40%)
  - ポジション: カテゴリ一致、インストール数の近さ (対数)、レビュースコアの近さ
  - 方向性: 更新日の近さ (活発さ)、free/paid一致、レビュー数 (規模)
- **選定**: 上位 5〜10 件を自動選定 (`pinned: true` の手動追加は保持)
- **実行**: `DOMAIN=memento-mori npm run discover:refresh`
- **ドメイン設定**: `targets[].discovery` にスコア・ソース・発見日を記録
