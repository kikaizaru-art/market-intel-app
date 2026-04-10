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

## データフロー

1. `npm run collect` → `data/` に個別JSON + `public/data/collected.json` に統合出力
2. ダッシュボード起動時に `collected.json` を fetch
3. 実データがあれば上書き、なければ `generateData.js` のモックを使用
