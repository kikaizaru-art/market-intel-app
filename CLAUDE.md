# Market Intel App (Memento Mori)

## ビジョン

メメントモリ (MementoMori: AFKRPG) の情報と周辺環境を整理し、**今の立ち位置・過去の推移・次の一手** を導くインテリジェンスツール。

- **現在地の把握**: 対象と周辺環境（市場・競合・ユーザー）を一画面で整理
- **推移の確認**: 過去からどう変わったか、何がきっかけで変動したかを因果付きで振り返る
- **次の一手の予測**: 蓄積した因果パターンから成功確率の高いアクションを提示

詳細: `docs/vision.md`

## スコープ

- **対象アプリ**: メメントモリ固定 (`config/domains/memento-mori.json`)
- 他アプリの追加は将来の別機能として切り出す予定
- インフルエンサードメインは別アプリ (`influencer-intel-app`) に分離済み
- keiba / stock / game-market ドメインも一旦凍結 (必要になれば git 履歴から復活)

## デプロイ

- GitHub Pages URL: https://kikaizaru-art.github.io/market-intel-app/
- **デプロイ方式**: GitHub Actions (`actions/deploy-pages`) — master push で自動デプロイ
- **Vite base path**: `./` (相対パス — GitHub Pages / Vercel 両対応)

## 開発

- `npm run dev` — ローカル開発サーバー (port 5173)
- `npm run build` — プロダクションビルド (dist/)
- `npm run collect` — 実データ収集 (Google Trends, Google Play, Ranking, Reddit, RSS, Twitter/X)
- `npm run discover` — アプリ自動探索 & ドメイン設定生成 (将来の他アプリ追加用に保持)
- `npm run discover:refresh` — 競合自動再探索 & 更新

## アーキテクチャ

- `src/dashboard/constants.js` — 共有定数 (カラーパレット, ラベル)
- `src/dashboard/utils.js` — 共有ユーティリティ (formatDate, isActive)
- `src/dashboard/components/shared/` — 共通UIコンポーネント (ChartTooltip, SentimentBar)
- `src/dashboard/components/PositionView.jsx` — 現在地タブ (KPI, 競合ポジション, マクロ環境)
- `src/dashboard/components/HistoryView.jsx` — 推移タブ (トレンド, ランキング, レビュー, イベント, ニュース)
- `src/dashboard/components/ActionsView.jsx` — 次の一手タブ (リスク/チャンス, 推奨アクション, AI分析, 因果関係)
- `src/dashboard/components/RecommendedActions.jsx` — 推奨アクションパネル (施策×効果集計, 現状マッチング)
- `src/dashboard/components/EventQuickInput.jsx` — 施策クイック記録UI (プロダクト/マーケ2レーン切替, 媒体・地域タグ, ワンタップ+メモ+自由記帳)
- `src/dashboard/components/QuickRecordPanel.jsx` — ActionsView 先頭の施策記録パネル
- `src/dashboard/components/LlmSettings.jsx` — LLM設定UI (Ollama接続, モデル選択)
- `src/collectors/` — データ収集モジュール
- `src/analyzers/` — 分析ロジック
- `src/framework/` — ドメイン設定ローダー・因果エンジン

## 4層収集モデル

- **L1 マクロ**: ゲーム市場全体の追い風・逆風 (Trends, 業界ニュース)
- **L2 競合**: 競合アプリの動き (順位、レビュー)
- **L3 ユーザー**: ユーザーの声と行動 (レビュー、Reddit、Twitter/X)
- **L4 因果**: 「こうしたらこうなった」の学習エンジン

## データフロー

1. `npm run collect` → `data/` に個別JSON + `data/history/memento-mori.json` に履歴蓄積 + `public/data/collected.json` に統合出力
2. 履歴蓄積: reviews(月次12ヶ月), trends(週次52週), ranking(日次90日), community(日次30日), twitter(日次30日)
3. ダッシュボード起動時に `collected.json` を fetch
4. 実データがあれば上書き、なければ `generateData.js` のモックを使用
5. GitHub Actions (`collect.yml`) で毎日 JST 7:00 に自動収集・デプロイ

## ローカルLLM統合

- **バックエンド**: Ollama (localhost:11434) — ローカルで無料実行
- **機能**: 因果パターンの自然言語サマリー、季節要因分析
- **フォールバック**: LLM未接続時はテンプレートベースの分析を表示
- **設定**: IndexedDB に永続化、UI から接続先・モデル・Temperature を設定可能

## Twitter/X 収集 (Nitter 経由)

- **経路**: Nitter インスタンス群の RSS を順に試行してフェイルオーバー
- **無効化**: `NITTER_DISABLE=1` 環境変数で即座にモックへフォールバック
- **履歴**: `data/history/memento-mori.json` の `twitter[]` に日次30日分
