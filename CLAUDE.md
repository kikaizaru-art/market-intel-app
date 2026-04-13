# Market Intel App

## デプロイ

- GitHub Pages URL: https://kikaizaru-art.github.io/market-intel-app/
- **デプロイ方式**: GitHub Actions (`actions/deploy-pages`) — master push で自動デプロイ
- **Vite base path**: `./` (相対パス — GitHub Pages / Vercel 両対応)

## 開発

- `npm run dev` — ローカル開発サーバー (port 5173)
- `npm run build` — プロダクションビルド (dist/)
- `npm run collect` — 実データ収集 (Google Trends, Google Play, RSS, Meta Ads)

## アーキテクチャ

- `src/dashboard/constants.js` — 共有定数 (カラーパレット, ラベル)
- `src/dashboard/utils.js` — 共有ユーティリティ (formatDate, isActive)
- `src/dashboard/components/shared/` — 共通UIコンポーネント (ChartTooltip, SentimentBar)
- `src/dashboard/components/appinfo/` — AppInfoView のタブ分割コンポーネント
- `src/collectors/` — データ収集モジュール (trends, store, news, meta-ads)
- `src/analyzers/` — 分析ロジック (trend, anomaly, causation)
- `src/framework/` — マルチドメインフレームワーク (domain, layers, collector-registry, causal-engine)

## マルチドメイン設計

本質: **環境変数を多層的に収集し、因果関係を蓄積・学習する**。対象を差し替えれば同じ構造が動く。

- **4層モデル**: マクロ → 競合 → ユーザー → 因果関係 (全ドメイン共通)
- **ドメイン設定**: `config/domains/{domain}.json` でドメインを定義
- **ドメイン切替**: ダッシュボードUIでドメイン選択可能 / `DOMAIN=stock npm run collect` でCLI切替
- **因果ログ自動蓄積**: 全ドメインの中核価値。パターンDBが時間とともに精度向上
- 詳細設計: `docs/architecture.md`

## データフロー

1. `npm run collect` → `data/` に個別JSON + `public/data/collected.json` に統合出力
2. ダッシュボード起動時に `collected.json` を fetch
3. 実データがあれば上書き、なければ `generateData.js` のモックを使用
