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
- `npm run collect` — 実データ収集 (Google Trends, Google Play, Ranking, Reddit, RSS)
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
- `src/dashboard/components/EventQuickInput.jsx` — 施策クイック記録UI (ドメイン別プリセット, ワンタップ+メモ+自由記帳)
- `src/dashboard/components/LlmSettings.jsx` — LLM設定UI (Ollama接続, モデル選択)
- `src/collectors/` — データ収集モジュール (trends, store, store-ranking, community, news, app-discover, competitor-discovery)
- `src/analyzers/` — 分析ロジック (trend, anomaly, causation, llmAnalyzer, actionRecommender)
- `src/analyzers/llmAnalyzer.js` — LLM分析モジュール (因果サマリー生成, 季節要因分析, テンプレートフォールバック)
- `src/analyzers/actionRecommender.js` — アクション推奨エンジン (施策記録の前後メトリクス変動 → eventType別に効果集計 → 現状と照合)
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
2. 履歴蓄積: reviews(月次12ヶ月), trends(週次52週), ranking(日次90日), community(日次30日)
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

詳細: `docs/vision.md` の「既知の課題と次のアクション」

## ローカルLLM統合

- **バックエンド**: Ollama (localhost:11434) — ローカルで無料実行
- **対応モデル**: Ollama で利用可能な任意のモデル (llama3.2, gemma2 等)
- **機能**: 因果パターンの自然言語サマリー、季節要因分析
- **フォールバック**: LLM未接続時はテンプレートベースの分析を表示
- **設定**: IndexedDB に永続化、UI から接続先・モデル・Temperature を設定可能
- **起動方法**: `ollama serve` でサーバー起動 → ダッシュボードの「次の一手」タブで自動接続

## 競合自動探索 (competitor-discovery)

- **探索ソース**: Google Play の類似アプリ + キーワード検索 + 同開発者アプリ
- **スコアリング**: ポジション類似度 (60%) × 方向性類似度 (40%)
  - ポジション: カテゴリ一致、インストール数の近さ (対数)、レビュースコアの近さ
  - 方向性: 更新日の近さ (活発さ)、free/paid一致、レビュー数 (規模)
- **選定**: 上位 5〜10 件を自動選定 (`pinned: true` の手動追加は保持)
- **実行**: `DOMAIN=memento-mori npm run discover:refresh`
- **ドメイン設定**: `targets[].discovery` にスコア・ソース・発見日を記録
